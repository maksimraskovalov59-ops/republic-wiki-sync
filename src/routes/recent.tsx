import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, GitPullRequest, Newspaper } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { getRecentChanges } from "@/lib/wiki.functions";

const recentQuery = queryOptions({
  queryKey: ["recent"],
  queryFn: () => getRecentChanges(),
});

export const Route = createFileRoute("/recent")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(recentQuery);
  },
  head: () => {
    const title = "Последние изменения — RepublicMC WIKI";
    const description = "Лента последних правок, новых статей и публикаций в энциклопедии RepublicMC.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: RecentPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RevisionItem {
  note: string;
  created_at: string;
  editor_name: string;
  article_id: string;
  articles?: { slug: string; title: string; kind: "article" | "news" } | null;
}

function RecentPage() {
  const { data } = useSuspenseQuery(recentQuery);
  const list = [
    ...(data.articles ?? []).map((a) => ({
      type: "article" as const,
      date: a.updated_at,
      title: a.title,
      slug: a.slug,
      kind: a.kind,
      author: a.author_name,
      note: a.kind === "news" ? "Опубликована новость" : "Опубликована или обновлена статья",
    })),
    ...(data.revisions ?? []).map((r: RevisionItem) => ({
      type: "revision" as const,
      date: r.created_at,
      title: r.articles?.title ?? "Без названия",
      slug: r.articles?.slug ?? "",
      kind: r.articles?.kind ?? "article",
      author: r.editor_name,
      note: r.note,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="surface-card mb-6 p-5 sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-4xl">
            <span className="text-brand-gradient">Последние изменения</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Лента новых статей, новостей и принятых правок.
          </p>
        </div>

        {list.length === 0 ? (
          <p className="surface-card p-5 text-sm text-muted-foreground">Пока нет изменений.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((item, i) => (
              <li key={i} className="surface-card flex items-start gap-3 p-4">
                <span className="mt-0.5 shrink-0 rounded-md bg-secondary p-1.5 text-cyan">
                  {item.type === "article" ? (
                    item.kind === "news" ? <Newspaper className="size-4" /> : <Clock className="size-4" />
                  ) : (
                    <GitPullRequest className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(item.date)}</span>
                    <span>·</span>
                    <span>{item.kind === "news" ? "Новость" : "Статья"}</span>
                    <span>·</span>
                    <span className="text-magenta">{item.author}</span>
                  </div>
                  {item.slug ? (
                    <Link
                      to="/article/$slug"
                      params={{ slug: item.slug }}
                      className="mt-1 block truncate text-sm font-semibold text-foreground hover:text-cyan"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.title}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
