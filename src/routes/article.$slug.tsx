import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Clock, Eye, MessageSquare, PencilLine, Send, Tag, Trash2, UserRound, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { addComment, deleteComment, getArticle, getComments, createEditSuggestion } from "@/lib/wiki.functions";
import { useAuth } from "@/hooks/useAuth";
import { Markdown, extractHeadings } from "@/components/Markdown";

export const Route = createFileRoute("/article/$slug")({
  loader: ({ params }) => getArticle({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const article = loaderData?.article;
    if (!article) {
      return {
        meta: [
          { title: "Статья не найдена — RepublicMC WIKI" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${article.title} — RepublicMC WIKI`;
    const description = article.summary || `Статья «${article.title}» в энциклопедии RepublicMC.`;
    const meta: { title: string }[] & ({ name: string; content: string } | { property: string; content: string })[] = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (article.cover_url?.startsWith("http")) {
      meta.push({ property: "og:image", content: article.cover_url });
      meta.push({ name: "twitter:image", content: article.cover_url });
    }
    return { meta };
  },
  component: ArticlePage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArticlePage() {
  const { article, revisions, related } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const send = useServerFn(addComment);
  const loadComments = useServerFn(getComments);
  const removeComment = useServerFn(deleteComment);
  const suggest = useServerFn(createEditSuggestion);

  const [comments, setComments] = useState<Awaited<ReturnType<typeof getComments>> | null>(null);
  const [body, setBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBody, setSuggestBody] = useState(article?.content ?? "");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  if (!article) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PixelField />
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-3xl font-extrabold">
            <span className="text-brand-gradient">Статья не найдена</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Материала «{slug}» ещё нет или он на модерации.
          </p>
          <Link
            to="/editor"
            search={{}}
            className="mt-6 inline-block rounded-lg px-5 py-3 text-sm font-semibold text-accent-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            Написать эту статью
          </Link>
        </main>
      </div>
    );
  }

  const headings = useMemo(() => extractHeadings(article.content), [article.content]);
  const articleId = article.id;

  async function refreshComments() {
    const rows = await loadComments({ data: { articleId } });
    setComments(rows);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setCommentError(null);
    const res = await send({ data: { articleId, body } });
    setSending(false);
    if (!res.ok) {
      setCommentError(res.error);
      return;
    }
    setBody("");
    await refreshComments();
  }

  async function handleDeleteComment(id: string) {
    if (!confirm("Удалить комментарий?")) return;
    const res = await removeComment({ data: { id } });
    if (!res.ok) {
      setCommentError(res.error);
      return;
    }
    setComments((prev) => prev?.filter((c) => c.id !== id) ?? []);
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault();
    setSuggestMsg(null);
    const res = await suggest({
      data: {
        articleId,
        title: article.title,
        summary: article.summary,
        content: suggestBody,
        categories: article.categories,
        coverUrl: article.cover_url,
        note: suggestNote || "Правка",
      },
    });
    if (!res.ok) {
      setSuggestMsg(res.error);
      return;
    }
    setSuggestMsg("Правка отправлена на рассмотрение администрации.");
    setSuggestBody(article.content);
    setSuggestNote("");
    setTimeout(() => setSuggestOpen(false), 1500);
  }


  const canEdit = isAdmin || (!!user && user.id === article.author_id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {headings.length > 0 ? (
            <nav className="surface-card p-4">
              <h2 className="mb-3 text-sm font-bold tracking-wide text-cyan uppercase">Оглавление</h2>
              <ol className="space-y-1 text-sm">
                {headings.map((h, i) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      className="flex gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <span className="text-magenta">{i + 1}.</span>
                      <span className="min-w-0">{h.text}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          {article.categories.length > 0 ? (
            <section className="surface-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-magenta uppercase">
                <Tag className="size-4 shrink-0" /> Категории
              </h2>
              <div className="flex flex-wrap gap-2">
                {article.categories.map((c) => (
                  <Link
                    key={c}
                    to="/category/$name"
                    params={{ name: c }}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-cyan hover:text-foreground"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="surface-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-cyan uppercase">
              <Clock className="size-4 shrink-0" /> Последние изменения
            </h2>
            {revisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Правок пока не было.</p>
            ) : (
              <ul className="space-y-3">
                {revisions.map((r) => (
                  <li key={r.created_at} className="border-l border-border pl-3">
                    <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                    <p className="text-sm text-foreground">{r.note}</p>
                    <p className="text-xs text-magenta">{r.editor_name}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <article className="surface-card min-w-0 p-5 sm:p-8">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            {article.kind === "news" ? "Новость" : article.categories[0] ?? "Статья"}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">
            <span className="text-brand-gradient">{article.title}</span>
          </h1>
          {article.summary ? (
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">{article.summary}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" /> Изменено {formatDate(article.updated_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <UserRound className="size-3.5 shrink-0" /> {article.author_name}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5 shrink-0" /> {article.views} просмотров
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-y border-border py-4">
            {canEdit ? (
              <Link
                to="/editor"
                search={{ id: article.id }}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm transition-shadow hover:glow-cyan"
              >
                <PencilLine className="size-4 shrink-0 text-cyan" /> Редактировать
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSuggestOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm transition-shadow hover:glow-cyan"
                >
                  <PencilLine className="size-4 shrink-0 text-cyan" /> Предложить правку
                </button>
                <Link
                  to={user ? "/editor" : "/auth"}
                  search={{}}
                  className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm transition-shadow hover:glow-cyan"
                >
                  <PencilLine className="size-4 shrink-0 text-cyan" />
                  {user ? "Новая статья" : "Войдите, чтобы писать"}
                </Link>
              </>
            )}
            <a
              href="#comments"
              onClick={() => void refreshComments()}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm transition-shadow hover:glow-magenta"
            >
              <MessageSquare className="size-4 shrink-0 text-magenta" /> Обсуждение
            </a>
          </div>

          {article.cover_url ? (
            <img
              src={article.cover_url}
              alt={article.title}
              className="mt-8 w-full rounded-lg border border-border object-cover"
            />
          ) : null}

          <div className="mt-8">
            <Markdown>{article.content}</Markdown>
          </div>

          {suggestOpen ? (
            <form onSubmit={submitSuggestion} className="surface-card mt-8 border border-cyan/40 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-cyan">Предложить правку</h3>
                <button type="button" onClick={() => setSuggestOpen(false)} className="text-muted-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Отправьте предложенный вариант текста. Администрация сможет сравнить изменения и принять или отклонить правку.
              </p>
              <textarea
                value={suggestBody}
                onChange={(e) => setSuggestBody(e.target.value)}
                rows={10}
                className="mt-3 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-mono outline-none focus:border-cyan"
              />
              <input
                value={suggestNote}
                onChange={(e) => setSuggestNote(e.target.value)}
                placeholder="Кратко: что изменилось?"
                className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
              />
              {suggestMsg && <p className="mt-2 text-sm text-cyan">{suggestMsg}</p>}
              <button
                type="submit"
                disabled={!suggestBody.trim()}
                className="glow-cyan mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                <Send className="size-4" /> Отправить правку
              </button>
            </form>
          ) : null}

          {related.length > 0 ? (
            <section className="mt-10 border-t border-border pt-6">
              <h2 className="text-lg font-bold text-foreground">См. также</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {related.map((l) => (
                  <li key={l.slug}>
                    <Link
                      to="/article/$slug"
                      params={{ slug: l.slug }}
                      className="block rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-cyan hover:text-foreground"
                    >
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="comments" className="mt-10 scroll-mt-24 border-t border-border pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">Обсуждение</h2>
              <button
                type="button"
                onClick={() => void refreshComments()}
                className="text-xs text-cyan hover:underline"
              >
                {comments === null ? "Показать комментарии" : "Обновить"}
              </button>
            </div>

            {user ? (
              <form onSubmit={submitComment} className="mt-4 space-y-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Поделитесь мнением или предложите правку…"
                  className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm outline-none focus:border-cyan"
                />
                {commentError ? <p className="text-xs text-destructive">{commentError}</p> : null}
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                  style={{ backgroundImage: "var(--gradient-brand)" }}
                >
                  <Send className="size-4 shrink-0" /> {sending ? "Отправка…" : "Отправить"}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                <Link to="/auth" className="text-cyan hover:underline">
                  Войдите
                </Link>{" "}
                чтобы комментировать, писать и редактировать статьи.
              </p>
            )}

            <ul className="mt-6 space-y-3">
              {(comments ?? []).map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="text-magenta">{c.author_name}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatDate(c.created_at)}</span>
                      {(isAdmin || c.author_id === user?.id) && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(c.id)}
                          className="text-destructive hover:text-foreground"
                          aria-label="Удалить комментарий"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-foreground">{c.body}</p>
                </li>
              ))}
              {comments !== null && comments.length === 0 ? (
                <li className="text-sm text-muted-foreground">Комментариев пока нет.</li>
              ) : null}
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
