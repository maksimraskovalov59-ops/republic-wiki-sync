import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Columns2,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  LinkIcon,
  List,
  Newspaper,
  Quote,
  Save,
  Send,
  SquarePen,
} from "lucide-react";
import { toast } from "sonner";
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

type ToolbarItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  before: string;
  after?: string;
};

const TOOLBAR: ToolbarItem[] = [
  { key: "h2", icon: Heading2, label: "H2", before: "## " },
  { key: "h3", icon: Heading3, label: "H3", before: "### " },
  { key: "bold", icon: Bold, label: "Жирный", before: "**", after: "**" },
  { key: "italic", icon: Italic, label: "Курсив", before: "*", after: "*" },
  { key: "list", icon: List, label: "Список", before: "- " },
  { key: "quote", icon: Quote, label: "Цитата", before: "> " },
  { key: "link", icon: LinkIcon, label: "Ссылка", before: "[", after: "](url)" },
];

type EditorMode = "edit" | "preview" | "split";

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
  const [mode, setMode] = useState<EditorMode>("edit");
  const [imageUrl, setImageUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile && mode === "split") setMode("edit");
  }, [isMobile, mode]);

  const isNews = (existing.data?.kind ?? kind) === "news";

  function getSelection() {
    const el = textareaRef.current;
    return el ? [el.selectionStart, el.selectionEnd] as const : [0, 0] as const;
  }

  function setSelection(start: number, end: number) {
    const el = textareaRef.current;
    if (!el) return;
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start, end);
    }, 0);
  }

  function insertMarkdown(before: string, after: string = "") {
    const el = textareaRef.current;
    if (!el) return;
    const [start, end] = getSelection();
    const selected = content.slice(start, end) || "текст";
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    setSelection(start + before.length, start + before.length + selected.length);
  }

  function insertImage() {
    if (!imageUrl.trim()) return;
    insertMarkdown("\n![", `](${imageUrl})\n`);
    setImageUrl("");
    setImageOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      insertMarkdown("  ");
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      insertMarkdown("**", "**");
    } else if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      insertMarkdown("*", "*");
    } else if (e.key === "k" || e.key === "K") {
      e.preventDefault();
      insertMarkdown("[", "](url)");
    }
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
      toast.error(error.message);
      return;
    }
    toast.success(
      status === "draft"
        ? "Черновик сохранён"
        : status === "published"
          ? "Материал опубликован"
          : "Материал отправлен на модерацию",
    );
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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-6xl">
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

        <div className="surface-card mt-6 space-y-4 p-4 sm:p-6">
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
            <div className="sticky top-0 z-20 rounded-t-md border border-border bg-secondary/90 px-2 py-2 backdrop-blur sm:px-3">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                {TOOLBAR.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => insertMarkdown(t.before, t.after ?? "")}
                    title={t.label}
                    className="flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-2.5"
                    aria-label={t.label}
                  >
                    <t.icon className="size-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setImageOpen((v) => !v)}
                  className="flex h-9 items-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-2.5"
                  aria-label="Вставить изображение"
                >
                  <ImagePlus className="size-4" /> <span className="hidden sm:inline">Картинка</span>
                </button>
                <div className="ml-auto flex items-center gap-1">
                  {isMobile ? null : (
                    <button
                      type="button"
                      onClick={() => setMode("split")}
                      className={`flex h-9 items-center gap-1 rounded px-2 text-xs transition-colors sm:px-2.5 ${
                        mode === "split" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"
                      }`}
                      aria-label="Разделить редактор и превью"
                    >
                      <Columns2 className="size-4" /> <span className="hidden sm:inline">Split</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                    className="flex h-9 items-center gap-1 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-2.5"
                    aria-label={mode === "edit" ? "Показать превью" : "Показать редактор"}
                  >
                    {mode === "edit" ? <Eye className="size-4" /> : <SquarePen className="size-4" />}
                    <span className="hidden sm:inline">{mode === "edit" ? "Превью" : "Редактор"}</span>
                  </button>
                </div>
              </div>
            </div>

            {imageOpen ? (
              <div className="flex items-center gap-2 border border-t-0 border-border bg-secondary/50 px-2 py-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... — ссылка на изображение"
                  className="min-w-0 flex-1 rounded border border-border bg-secondary px-2 py-1.5 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={insertImage}
                  disabled={!imageUrl.trim()}
                  className="rounded bg-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Вставить
                </button>
              </div>
            ) : null}

            <div
              className={`grid gap-0 ${
                mode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {mode !== "preview" && (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={18}
                  placeholder="## Заголовок\n\nТекст статьи. Поддерживаются **жирный**, *курсив*, списки, ссылки и изображения."
                  className="min-h-[55vh] w-full rounded-b-md border border-t-0 border-border bg-secondary px-3 py-2 font-mono text-base leading-6 outline-none focus:border-cyan sm:min-h-[420px] sm:text-sm lg:rounded-br-none"
                />
              )}
              {mode !== "edit" && (
                <div className="prose prose-sm min-h-[55vh] overflow-y-auto rounded-b-md border border-t-0 border-border bg-secondary/30 p-4 lg:rounded-bl-none">
                  <Markdown>{content}</Markdown>
                </div>
              )}
            </div>
          </div>

          {coverUrl.trim() && mode !== "preview" ? (
            <img src={coverUrl} alt="Обложка" className="h-40 w-full rounded-md border border-border object-cover" />
          ) : null}

          {msg && <p className="text-sm text-magenta">{msg}</p>}

          <div className="flex flex-wrap gap-2 pt-4">
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
