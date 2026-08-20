import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "./supabase-public.server";

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const [news, popular] = await Promise.all([
    sb
      .from("articles")
      .select("slug,title,summary,categories,created_at,cover_url")
      .eq("status", "published")
      .eq("kind", "news")
      .order("created_at", { ascending: false })
      .limit(6),
    sb
      .from("articles")
      .select("slug,title,author_name,views,cover_url")
      .eq("status", "published")
      .eq("kind", "article")
      .order("views", { ascending: false })
      .limit(5),
  ]);
  return { news: news.data ?? [], popular: popular.data ?? [] };
});

export const getArticles = createServerFn({ method: "GET" })
  .inputValidator((data: { kind?: "article" | "news" | undefined; category?: string | undefined; limit?: number | undefined; offset?: number | undefined }) => data)
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    let q = sb
      .from("articles")
      .select("slug,title,summary,categories,kind,views,created_at,updated_at,cover_url,author_name")
      .eq("status", "published");
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.category) q = q.contains("categories", [data.category]);
    q = q.order("updated_at", { ascending: false });
    if (data.limit) q = q.limit(data.limit);
    if (data.offset) q = q.range(data.offset, data.offset + (data.limit ?? 12) - 1);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const { data } = await sb.from("articles").select("categories").eq("status", "published");
  const set = new Set<string>();
  (data ?? []).forEach((a) => a.categories?.forEach((c) => c && set.add(c)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
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
        .select("slug,title,cover_url")
        .eq("status", "published")
        .neq("slug", data.slug)
        .limit(4),
    ]);
    const { incrementArticleViews } = await import("./wiki-admin.server");
    void incrementArticleViews(data.slug);
    return { article, revisions: revisions.data ?? [], related: related.data ?? [] };
  });

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator((data: { q: string }) => data)
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const q = data.q.trim().replace(/[%_]/g, "\\$&");
    if (!q) return [];
    const pattern = `%${q}%`;
    const { data: rows } = await sb
      .from("articles")
      .select("slug,title,summary,kind,categories,cover_url")
      .eq("status", "published")
      .or(`title.ilike.${pattern},summary.ilike.${pattern},content.ilike.${pattern}`)
      .order("views", { ascending: false })
      .limit(20);
    return rows ?? [];
  });

export const getRecentChanges = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const [articles, revisions] = await Promise.all([
    sb
      .from("articles")
      .select("slug,title,kind,updated_at,author_name")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(20),
    sb
      .from("article_revisions")
      .select("note,created_at,editor_name,article_id,articles(slug,title,kind)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return { articles: articles.data ?? [], revisions: revisions.data ?? [] };
});

export const getComments = createServerFn({ method: "GET" })
  .inputValidator((data: { articleId: string }) => data)
  .handler(async ({ data }) => {
    const sb = createPublicClient();
    const { data: rows } = await sb
      .from("comments")
      .select("id,author_id,author_name,body,created_at")
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

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: comment } = await context.supabase
      .from("comments")
      .select("author_id,article_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!comment) return { ok: false as const, error: "Комментарий не найден" };

    const { userHasRole } = await import("./wiki-admin.server");
    const isAdmin = await userHasRole(context.userId, "admin");
    if (comment.author_id !== context.userId && !isAdmin) {
      return { ok: false as const, error: "Нельзя удалить чужой комментарий" };
    }
    const { error } = await context.supabase.from("comments").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: "Не удалось удалить комментарий" };
    return { ok: true as const };
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

export const getSignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bucket: "article-covers" | "article-media"; path: string }) => data)
  .handler(async ({ data, context }) => {
    const allowed = ["article-covers", "article-media"];
    if (!allowed.includes(data.bucket)) return { ok: false as const, error: "Недопустимый бакет" };
    const prefix = context.userId;
    if (!data.path.startsWith(`${prefix}/`)) {
      return { ok: false as const, error: "Путь должен начинаться с вашего ID пользователя" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from(data.bucket).createSignedUploadUrl(data.path);
    if (error) return { ok: false as const, error: "Не удалось создать ссылку для загрузки" };
    return { ok: true as const, signedUrl: signed!.signedUrl, path: data.path };
  });

export const createEditSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      articleId: string;
      title: string;
      summary: string;
      content: string;
      categories: string[];
      coverUrl?: string | null;
      note: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const title = data.title.trim();
    if (title.length < 2 || title.length > 200) {
      return { ok: false as const, error: "Название должно быть от 2 до 200 символов" };
    }
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await context.supabase.from("edit_suggestions").insert({
      article_id: data.articleId,
      author_id: context.userId,
      author_name: profile?.username ?? "Игрок",
      title,
      summary: data.summary.trim().slice(0, 500),
      content: data.content.trim(),
      categories: data.categories ?? [],
      cover_url: data.coverUrl ?? null,
      note: data.note.trim().slice(0, 200) || "Предложенная правка",
    });
    if (error) return { ok: false as const, error: "Не удалось отправить предложение" };
    return { ok: true as const };
  });

export const listEditSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userHasRole } = await import("./wiki-admin.server");
    const isAdmin = await userHasRole(context.userId, "admin");
    if (isAdmin) {
      const { data } = await context.supabase
        .from("edit_suggestions")
        .select("*, articles(slug, title, author_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as EditSuggestion[];
    }
    const [own, authored] = await Promise.all([
      context.supabase
        .from("edit_suggestions")
        .select("*, articles(slug, title, author_id)")
        .eq("author_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase.from("articles").select("id").eq("author_id", context.userId),
    ]);
    const ids = new Set((authored.data ?? []).map((a) => a.id));
    const byArticle = (own.data ?? []).filter((s) => ids.has(s.article_id));
    return [...(own.data ?? []), ...byArticle] as EditSuggestion[];
  });

export const approveEditSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { suggestionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { userHasRole } = await import("./wiki-admin.server");
    const isAdmin = await userHasRole(context.userId, "admin");
    if (!isAdmin) return { ok: false as const, error: "Только администратор может принять правку" };

    const { data: suggestion } = await context.supabase
      .from("edit_suggestions")
      .select("*, articles(id, slug, author_id)")
      .eq("id", data.suggestionId)
      .eq("status", "pending")
      .maybeSingle();
    if (!suggestion) return { ok: false as const, error: "Предложение не найдено" };

    const articleId = (suggestion as EditSuggestion).article_id;
    const { error: updErr } = await context.supabase
      .from("articles")
      .update({
        title: suggestion.title,
        summary: suggestion.summary,
        content: suggestion.content,
        categories: suggestion.categories,
        cover_url: suggestion.cover_url,
      })
      .eq("id", articleId);
    if (updErr) return { ok: false as const, error: "Не удалось обновить статью" };

    const { error: revErr } = await context.supabase.from("article_revisions").insert({
      article_id: articleId,
      editor_id: context.userId,
      editor_name: "Администрация",
      note: `Принята правка от ${suggestion.author_name}: ${suggestion.note}`,
    });
    if (revErr) return { ok: false as const, error: "Не удалось записать ревизию" };

    const { error: finErr } = await context.supabase
      .from("edit_suggestions")
      .update({ status: "accepted" })
      .eq("id", data.suggestionId);
    if (finErr) return { ok: false as const, error: "Не удалось закрыть предложение" };
    return { ok: true as const };
  });

export const rejectEditSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { suggestionId: string; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const { userHasRole } = await import("./wiki-admin.server");
    const isAdmin = await userHasRole(context.userId, "admin");
    if (!isAdmin) return { ok: false as const, error: "Только администратор может отклонить правку" };
    const { error } = await context.supabase
      .from("edit_suggestions")
      .update({ status: "rejected", reject_reason: data.reason.trim().slice(0, 500) || "Не соответствует правилам" })
      .eq("id", data.suggestionId);
    if (error) return { ok: false as const, error: "Не удалось отклонить предложение" };
    return { ok: true as const };
  });

export type SuggestionArticle = {
  slug: string;
  title?: string | null;
  author_id: string | null;
};

export type EditSuggestion = {
  id: string;
  article_id: string;
  author_id: string;
  author_name: string;
  title: string;
  summary: string;
  content: string;
  categories: string[];
  cover_url: string | null;
  note: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
  articles: SuggestionArticle | null;
};
