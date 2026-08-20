import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "./supabase-public.server";

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const [news, popular] = await Promise.all([
    sb
      .from("articles")
      .select("slug,title,summary,categories,created_at")
      .eq("status", "published")
      .eq("kind", "news")
      .order("created_at", { ascending: false })
      .limit(6),
    sb
      .from("articles")
      .select("slug,title,author_name,views")
      .eq("status", "published")
      .eq("kind", "article")
      .order("views", { ascending: false })
      .limit(5),
  ]);
  return { news: news.data ?? [], popular: popular.data ?? [] };
});

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const { data: article } = await sb
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!article) return { article: null, revisions: [], related: [] };
    const [revisions, related] = await Promise.all([
      sb
        .from("article_revisions")
        .select("editor_name,note,created_at")
        .eq("article_id", article.id)
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("articles")
        .select("slug,title")
        .eq("status", "published")
        .neq("slug", data.slug)
        .limit(4),
    ]);
    void sb.rpc("increment_article_views", { _slug: data.slug });
    return { article, revisions: revisions.data ?? [], related: related.data ?? [] };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data, context }) => {
    const expected = process.env["ADMIN_UNLOCK_PASSWORD"];
    if (!expected) return { ok: false as const, error: "Пароль администратора не настроен" };
    if (data.password !== expected) return { ok: false as const, error: "Неверный пароль" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) return { ok: false as const, error: "Не удалось выдать права" };
    return { ok: true as const };
  });

export const getComments = createServerFn({ method: "GET" })
  .inputValidator((data: { articleId: string }) => data)
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const { data: rows } = await sb
      .from("comments")
      .select("id,author_name,body,created_at")
      .eq("article_id", data.articleId)
      .order("created_at", { ascending: false })
      .limit(100);
    return rows ?? [];
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { articleId: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (body.length < 1 || body.length > 2000) {
      return { ok: false as const, error: "Комментарий должен быть от 1 до 2000 символов" };
    }
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await context.supabase.from("comments").insert({
      article_id: data.articleId,
      author_id: context.userId,
      author_name: profile?.username ?? "Игрок",
      body,
    });
    if (error) return { ok: false as const, error: "Не удалось отправить комментарий" };
    return { ok: true as const };
  });
