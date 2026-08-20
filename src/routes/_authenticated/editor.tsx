import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Eye, ImagePlus, Newspaper, Save, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/lib/slug";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { ModerationBanner } from "@/components/ModerationBanner";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/_authenticated/editor")({
  validateSearch: (search: Record<string, unknown>): { id?: string; kind?: "news" } => ({
    ...(typeof search["id"] === "string" ? { id: search["id"] as string } : {}),
    ...(search["kind"] === "news" ? { kind: "news" as const } : {}),
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
  const [coverUrl, setCoverUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setCoverUrl(a.cover_url ?? "");
    setCategories(a.categories.join(", "));
  }, [existing.data]);

  const isNews = (existing.data?.kind ?? kind) === "news";

  function insertMarkdown(before: string, after: string = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || "текст";
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }

  function insertImage() {
    if (!imageUrl.trim()) return;
    insertMarkdown(`\n![`, `](${imageUrl})\n`);
    setImageUrl("");
    setImageOpen(false);
  }

  async function save(status: "draft" | "pending" | "published") {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    const payload = {
      title,
      summary,
      content,
      cover_url: coverUrl.trim() || null,
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
    <div className="min-h-screen text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 2xl:max-w-6xl py-8 sm:px-6">
        <div className="mb-4">
          <ModerationBanner enabled />
        </div>
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
              Ссылка на обложку (опционально)
            </span>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
          </label>

          <div>
            <div className="flex flex-wrap items-center gap-2 border border-border bg-secondary/50 px-2 py-2 text-xs">
              <button type="button" onClick={() => insertMarkdown("## ")} className="rounded px-2 py-1 hover:bg-secondary">
                H2
              </button>
              <button type="button" onClick={() => insertMarkdown("### ")} className="rounded px-2 py-1 hover:bg-secondary">
                H3
              </button>
              <button type="button" onClick={() => insertMarkdown("**", "**")} className="rounded px-2 py-1 hover:bg-secondary">
                Жирный
              </button>
              <button type="button" onClick={() => insertMarkdown("*", "*")} className="rounded px-2 py-1 hover:bg-secondary">
                Курсив
              </button>
              <button type="button" onClick={() => insertMarkdown("- ")} className="rounded px-2 py-1 hover:bg-secondary">
                Список
              </button>
              <button type="button" onClick={() => insertMarkdown("> ")} className="rounded px-2 py-1 hover:bg-secondary">
                Цитата
              </button>
              <button
                type="button"
                onClick={() => setImageOpen((v) => !v)}
                className="flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary"
              >
                <ImagePlus className="size-3.5" /> Картинка
              </button>
              <button
                type="button"
                onClick={() => setPreview((v) => !v)}
                className="ml-auto flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary"
              >
                <Eye className="size-3.5" /> {preview ? "Редактор" : "Превью"}
              </button>
            </div>

            {imageOpen ? (
              <div className="flex items-center gap-2 border border-t-0 border-border bg-secondary/50 px-2 py-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... — ссылка на изображение"
                  className="min-w-0 flex-1 rounded border border-border bg-secondary px-2 py-1 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={insertImage}
                  disabled={!imageUrl.trim()}
                  className="rounded bg-secondary px-3 py-1 text-xs disabled:opacity-50"
                >
                  Вставить
                </button>
              </div>
            ) : null}

            {preview ? (
              <div className="prose prose-sm min-h-[320px] rounded-b-md border border-t-0 border-border bg-secondary/30 p-4">
                <Markdown>{content}</Markdown>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                placeholder="## Заголовок\n\nТекст статьи. Поддерживаются **жирный**, *курсив*, списки, ссылки и изображения."
                className="w-full rounded-b-md border border-t-0 border-border bg-secondary px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-cyan"
              />
            )}
          </div>

          {coverUrl.trim() && !preview ? (
            <img src={coverUrl} alt="Обложка" className="h-40 w-full rounded-md border border-border object-cover" />
          ) : null}

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
            {isAdmin && !isNews ? (
              <Link
                to="/admin"
                className="ml-auto flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm"
              >
                <Newspaper className="size-4 text-magenta" /> Админка
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
