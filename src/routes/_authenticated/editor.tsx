import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/slug";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";

export const Route = createFileRoute("/_authenticated/editor")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { id?: string; kind?: "news" } => ({
    ...(typeof search['id'] === "string" ? { id: search['id'] as string } : {}),
    ...(search['kind'] === "news" ? { kind: "news" as const } : {}),
  }),
  head: () => {
    const title = "Редактор статьи — RepublicMC WIKI";
    const description =
      "Напишите или отредактируйте статью RepublicMC WIKI и отправьте её на модерацию администрации.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Editor,
});

function Editor() {
  const { id, kind } = Route.useSearch();
  const { user, username, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [categories, setCategories] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = useQuery({
    queryKey: ["article-edit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("articles").select("*").eq("id", id!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const a = existing.data;
    if (!a) return;
    setTitle(a.title);
    setSummary(a.summary);
    setContent(a.content);
    setCategories(a.categories.join(", "));
  }, [existing.data]);

  const isNews = (existing.data?.kind ?? kind) === "news";

  async function save(status: "draft" | "pending" | "published") {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    const payload = {
      title,
      summary,
      content,
      categories: categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      author_id: user.id,
      author_name: username ?? "Игрок",
      kind: isNews ? ("news" as const) : ("article" as const),
      status,
    };

    let error;
    let slug = existing.data?.slug;
    if (id) {
      ({ error } = await supabase.from("articles").update(payload).eq("id", id));
      if (!error) {
        await supabase.from("article_revisions").insert({
          article_id: id,
          editor_id: user.id,
          editor_name: username ?? "Игрок",
          note: status === "published" ? "Публикация правки" : "Правка отправлена на модерацию",
        });
      }
    } else {
      slug = slugify(title);
      const res = await supabase
        .from("articles")
        .insert({ ...payload, slug })
        .select("id")
        .maybeSingle();
      error = res.error;
      if (!error && res.data) {
        await supabase.from("article_revisions").insert({
          article_id: res.data.id,
          editor_id: user.id,
          editor_name: username ?? "Игрок",
          note: "Создание материала",
        });
      }
    }
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (status === "published" && slug) {
      void navigate({ to: "/article/$slug", params: { slug } });
      return;
    }
    void navigate({ to: "/cabinet" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          <span className="text-brand-gradient">
            {id ? "Редактирование" : isNews ? "Новая новость" : "Новая статья"}
          </span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAdmin
            ? "У вас права администратора: можно публиковать сразу."
            : "После отправки материал попадёт на модерацию администрации."}
        </p>

        <div className="surface-card mt-6 space-y-4 p-5 sm:p-6">
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Заголовок</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Краткое описание</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Категории (через запятую)
            </span>
            <input
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              placeholder="Города, Гайды, Экономика"
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">
              Текст статьи (## заголовок, - список)
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-cyan"
            />
          </label>

          {msg && <p className="text-sm text-magenta">{msg}</p>}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              disabled={busy || !title.trim()}
              onClick={() => void save("draft")}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Save className="size-4 text-blue" /> Сохранить черновик
            </button>
            <button
              disabled={busy || !title.trim()}
              onClick={() => void save(isAdmin ? "published" : "pending")}
              className="glow-cyan flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              <Send className="size-4" /> {isAdmin ? "Опубликовать" : "Отправить на модерацию"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
