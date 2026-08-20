import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Edit3, MessageSquare, Tag, ThumbsUp, TrendingUp, User } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { Markdown } from "@/components/Markdown";
import { LowReputationNotice } from "@/components/LowReputationNotice";
import { ReputationVote } from "@/components/ReputationVote";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getArticle, addComment, deleteComment, getComments, createEditSuggestion } from "@/lib/wiki.functions";
type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  categories: string[];
  cover_url: string | null;
  author_name: string;
  created_at: string;
  views: number;
  kind: string;
  status: string;
  updated_at: string;
  author_id: string | null;
  reject_reason: string | null;
};

export const Route = createFileRoute("/article/$slug")({
  beforeLoad: ({ params }) => {
    if (params.slug === "discord") {
      throw redirect({
        to: "/article/$slug",
        params: { slug: "soobshchestvo" },
        replace: true,
      });
    }
  },
  head: ({ params }) => {
    const title = `${params.slug} — RepublicMC WIKI`;
    const description = `Статья вики RepublicMC: ${params.slug}.`;
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
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState({ title: "", summary: "", content: "", coverUrl: "", note: "" });
  const [categories, setCategories] = useState<string[]>([]);
  const doAddComment = useServerFn(addComment);
  const doDeleteComment = useServerFn(deleteComment);
  const doCreateSuggestion = useServerFn(createEditSuggestion);

  const { data: payload } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => getArticle({ data: { slug } }),
    staleTime: 5 * 60 * 1000,
  });
  const article = payload?.article ?? null;
  const revisions = payload?.revisions ?? [];
  const related = payload?.related ?? [];
  const author = payload?.author ?? null;

  const { data: comments } = useQuery({
    queryKey: ["comments", article?.id],
    enabled: !!article?.id,
    queryFn: () => getComments({ data: { articleId: article!.id } }),
  });

  async function handleComment() {
    if (!user || !article) return;
    const res = await doAddComment({ data: { articleId: article.id, body: commentBody } });
    if (!res.ok) return alert(res.error);
    setCommentBody("");
    await queryClient.invalidateQueries({ queryKey: ["comments", article.id] });
  }

  async function handleDeleteComment(id: string) {
    if (!article) return;
    const res = await doDeleteComment({ data: { id } });
    if (!res.ok) return alert(res.error);
    await queryClient.invalidateQueries({ queryKey: ["comments", article.id] });
  }

  async function openSuggestion() {
    if (!article) return;
    setSuggestionForm({
      title: article.title,
      summary: article.summary,
      content: article.content,
      coverUrl: article.cover_url ?? "",
      note: "",
    });
    setCategories(article.categories ?? []);
    setSuggesting(true);
  }

  async function submitSuggestion() {
    if (!article) return;
    const res = await doCreateSuggestion({
      data: {
        articleId: article.id,
        title: suggestionForm.title,
        summary: suggestionForm.summary,
        content: suggestionForm.content,
        categories,
        coverUrl: suggestionForm.coverUrl,
        note: suggestionForm.note,
      },
    });
    if (!res.ok) return alert(res.error);
    setSuggesting(false);
    alert("Предложение отправлено на модерацию");
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PixelField />
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Статья не найдена</h1>
          <p className="mt-2 text-sm text-muted-foreground">Материал ещё не опубликован или был удалён.</p>
          <Link to="/articles" className="mt-6 inline-block rounded-md bg-secondary px-4 py-2 text-sm">
            Ко всем материалам
          </Link>
        </main>
      </div>
    );
  }

  const articleData = article as Article;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          <div className="surface-card overflow-hidden">
            {articleData.cover_url && (
              <div className="relative h-48 w-full sm:h-64">
                <img
                  src={articleData.cover_url}
                  alt={articleData.title}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              </div>
            )}
            <div className="p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(articleData.categories ?? []).map((cat) => (
                  <Link
                    key={cat}
                    to="/category/$name"
                    params={{ name: cat }}
                    className="rounded-full border border-cyan/40 px-3 py-1 text-xs text-cyan"
                  >
                    <Tag className="mr-1 inline size-3 align-[-2px]" />
                    {cat}
                  </Link>
                ))}
              </div>

              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
                <span className="text-brand-gradient">{articleData.title}</span>
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {author ? (
                  <Link
                    to="/user/$username"
                    params={{ username: author.username }}
                    className="flex items-center gap-1 hover:text-cyan"
                  >
                    <User className="size-3.5" /> {author.username}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1">
                    <User className="size-3.5" /> {articleData.author_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" /> {new Date(articleData.created_at).toLocaleDateString("ru-RU")}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-3.5" /> {articleData.views} просмотров
                </span>
              </div>

              {author && (
                <div className="mt-4">
                  <LowReputationNotice reputation={author.reputation} />
                </div>
              )}

              <div className="mt-6 text-sm leading-7 text-foreground">
                <Markdown>{articleData.content}</Markdown>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => void openSuggestion()}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm transition-shadow hover:glow-cyan"
            >
              <Edit3 className="size-4 text-cyan" /> Предложить правку
            </button>
            {isAdmin && (
              <Link
                to="/editor"
                search={{ id: articleData.id }}
                className="flex items-center gap-2 rounded-md border border-cyan/60 bg-secondary px-4 py-2 text-sm transition-shadow hover:glow-cyan"
              >
                <Edit3 className="size-4 text-cyan" /> Редактировать
              </Link>
            )}
          </div>

          {suggesting && (
            <div className="mt-4 surface-card p-5">
              <h3 className="text-lg font-bold">Предложить правку</h3>
              <div className="mt-3 space-y-3">
                <input
                  value={suggestionForm.title}
                  onChange={(e) => setSuggestionForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  placeholder="Название"
                />
                <input
                  value={suggestionForm.summary}
                  onChange={(e) => setSuggestionForm((f) => ({ ...f, summary: e.target.value }))}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  placeholder="Краткое описание"
                />
                <textarea
                  value={suggestionForm.content}
                  onChange={(e) => setSuggestionForm((f) => ({ ...f, content: e.target.value }))}
                  className="min-h-[180px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  placeholder="Markdown-контент"
                />
                <input
                  value={suggestionForm.coverUrl}
                  onChange={(e) => setSuggestionForm((f) => ({ ...f, coverUrl: e.target.value }))}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  placeholder="URL обложки"
                />
                <input
                  value={categories.join(", ")}
                  onChange={(e) => setCategories(e.target.value.split(",").map((c) => c.trim()).filter(Boolean))}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  placeholder="Категории через запятую"
                />
                <input
                  value={suggestionForm.note}
                  onChange={(e) => setSuggestionForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  placeholder="Комментарий к правке"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void submitSuggestion()}
                    className="rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-white"
                  >
                    Отправить
                  </button>
                  <button
                    onClick={() => setSuggesting(false)}
                    className="rounded-md border border-border bg-secondary px-4 py-2 text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">История изменений</h2>
            {revisions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Пока нет изменений.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {revisions.map((r) => (
                  <li key={r.created_at} className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.editor_name}</span> · {r.note} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("ru-RU")}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-cyan uppercase">
              <MessageSquare className="size-4" /> Комментарии
            </h2>
            {user ? (
              <div className="mt-3">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Напишите комментарий..."
                  className="min-h-[80px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void handleComment()}
                  className="mt-2 rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-white"
                >
                  Отправить
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                <Link to="/auth" className="text-cyan underline">
                  Войдите
                </Link>
                , чтобы оставить комментарий.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {(comments ?? []).map((c) => (
                <li key={c.id} className="rounded-md border border-border bg-secondary/40 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.author_name}</span>
                    <span>{new Date(c.created_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                  {(c.author_id === user?.id || isAdmin) && (
                    <button
                      onClick={() => void handleDeleteComment(c.id)}
                      className="mt-2 text-xs text-magenta"
                    >
                      Удалить
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-magenta uppercase">Похожие материалы</h2>
            {related.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Нет похожих материалов.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to="/article/$slug"
                      params={{ slug: r.slug }}
                      className="group flex items-center gap-3 text-sm"
                    >
                      {r.cover_url ? (
                        <img src={r.cover_url} alt="" className="size-10 rounded-md object-cover" />
                      ) : (
                        <div className="grid size-10 place-items-center rounded-md bg-secondary text-muted-foreground">
                          <ThumbsUp className="size-4" />
                        </div>
                      )}
                      <span className="group-hover:text-cyan">{r.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
