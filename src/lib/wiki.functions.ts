import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "./supabase-public.server";
import { CREATOR_USERNAME } from "./wiki-constants";

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

export const getRandomArticleSlug = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createPublicClient();
  const { data } = await sb.from("articles").select("slug").eq("status", "published");
  const slugs = data ?? [];
  if (slugs.length === 0) return null;
  const idx = Math.floor(Math.random() * slugs.length);
  const random = slugs[idx];
  if (!random) return null;
  return random.slug;
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
    if (!article)
      return { article: null, revisions: [], related: [], author: null } as {
        article: null;
        revisions: never[];
        related: never[];
        author: { username: string; reputation: number; avatar_url: string | null } | null;
      };
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
    const { data: author } = article.author_id
      ? await sb
          .from("profiles")
          .select("username,reputation,avatar_url")
          .eq("id", article.author_id)
          .maybeSingle()
      : { data: null };
    return {
      article,
      revisions: revisions.data ?? [],
      related: related.data ?? [],
      author: author ?? null,
    };
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

export type MemberRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  reputation: number;
  created_at: string;
  isAdmin: boolean;
  isCreator: boolean;
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q?: string | undefined }) => data)
  .handler(async ({ data, context }): Promise<MemberRow[]> => {
    const { userHasRole } = await import("./wiki-admin.server");
    if (!(await userHasRole(context.userId, "admin"))) return [];

    let query = context.supabase
      .from("profiles")
      .select("id,username,avatar_url,reputation,created_at")
      .order("created_at", { ascending: true })
      .limit(50);
    const q = (data.q ?? "").trim().replace(/[%_]/g, "\\$&");
    if (q) query = query.ilike("username", `%${q}%`);
    const { data: profiles } = await query;
    const rows = profiles ?? [];
    if (rows.length === 0) return [];

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("user_id,role")
      .in(
        "user_id",
        rows.map((r) => r.id),
      );
    const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      avatar_url: r.avatar_url,
      reputation: r.reputation,
      created_at: r.created_at,
      isAdmin: admins.has(r.id),
      isCreator: r.username.toLowerCase() === CREATOR_USERNAME.toLowerCase(),
    }));
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; makeAdmin: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { userHasRole } = await import("./wiki-admin.server");
    if (!(await userHasRole(context.userId, "admin"))) {
      return { ok: false as const, error: "Только администратор может менять права" };
    }
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("username")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) return { ok: false as const, error: "Участник не найден" };

    const isCreator = profile.username.toLowerCase() === CREATOR_USERNAME.toLowerCase();
    if (!data.makeAdmin && isCreator) {
      return { ok: false as const, error: "У создателя нельзя снять права администратора" };
    }
    if (!data.makeAdmin && data.userId === context.userId) {
      return { ok: false as const, error: "Нельзя снять права с самого себя" };
    }

    if (data.makeAdmin) {
      const { error } = await context.supabase
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) return { ok: false as const, error: "Не удалось выдать права" };
    } else {
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) return { ok: false as const, error: "Не удалось снять права" };
    }
    return { ok: true as const };
  });

export type PublicProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  link: string | null;
  reputation: number;
  created_at: string;
  isAdmin: boolean;
  isCreator: boolean;
  stats: {
    published: number;
    views: number;
    revisions: number;
    comments: number;
  };
  articles: { slug: string; title: string; summary: string; kind: string; views: number; updated_at: string }[];
  activity: { kind: "article" | "revision" | "comment"; label: string; slug: string | null; at: string }[];
};

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<PublicProfile | null> => {
    const sb = createPublicClient();
    const name = data.username.trim().replace(/[%_]/g, "\\$&");
    if (!name) return null;
    const { data: profile } = await sb
      .from("profiles")
      .select("id,username,avatar_url,bio,link,reputation,created_at")
      .ilike("username", name)
      .limit(1)
      .maybeSingle();
    if (!profile) return null;

    const [articles, revisions, comments] = await Promise.all([
      sb
        .from("articles")
        .select("slug,title,summary,kind,views,updated_at")
        .eq("author_id", profile.id)
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(30),
      sb
        .from("article_revisions")
        .select("note,created_at,articles(slug,title)")
        .eq("editor_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      sb
        .from("comments")
        .select("body,created_at,articles(slug,title)")
        .eq("author_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const arts = articles.data ?? [];
    const revs = revisions.data ?? [];
    const coms = comments.data ?? [];

    const activity: PublicProfile["activity"] = [
      ...arts.map((a) => ({
        kind: "article" as const,
        label: `Статья «${a.title}»`,
        slug: a.slug,
        at: a.updated_at,
      })),
      ...revs.map((r) => ({
        kind: "revision" as const,
        label: `Правка «${r.articles?.title ?? "статья"}»: ${r.note}`,
        slug: r.articles?.slug ?? null,
        at: r.created_at,
      })),
      ...coms.map((c) => ({
        kind: "comment" as const,
        label: `Комментарий к «${c.articles?.title ?? "статья"}»: ${c.body.slice(0, 80)}`,
        slug: c.articles?.slug ?? null,
        at: c.created_at,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 15);

    return {
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      bio: profile.bio ?? "",
      link: profile.link,
      reputation: profile.reputation,
      created_at: profile.created_at,
      isAdmin: false,
      isCreator: profile.username.toLowerCase() === CREATOR_USERNAME.toLowerCase(),
      stats: {
        published: arts.length,
        views: arts.reduce((sum, a) => sum + (a.views ?? 0), 0),
        revisions: revs.length,
        comments: coms.length,
      },
      articles: arts,
      activity,
    };
  });

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
