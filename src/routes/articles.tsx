import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Newspaper, Search, Tag } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { getArticles, getCategories } from "@/lib/wiki.functions";

const articlesQuery = (kind: "article" | "news" | undefined, category: string | undefined) =>
  queryOptions({
    queryKey: ["articles", kind ?? "all", category ?? "all"],
    queryFn: () => getArticles({ data: { kind, category } }),
  });

const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

export const Route = createFileRoute("/articles")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(articlesQuery(undefined, undefined)),
    ]);
  },
  head: () => {
    const title = "Все материалы — RepublicMC WIKI";
    const description = "Все статьи и новости энциклопедии сервера RepublicMC.";
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
  component: ArticlesPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ArticlesPage() {
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [kind, setKind] = useState<"all" | "article" | "news">("all");
  const [category, setCategory] = useState<string | "all">("all");
  const activeKind = kind === "all" ? undefined : kind;
  const activeCategory = category === "all" ? undefined : category;
  const { data: articles } = useQuery(articlesQuery(activeKind, activeCategory));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto max-w-7xl 2xl:max-w-[1600px] min-[1900px]:max-w-[1800px] px-4 py-8 sm:px-6">
        <div className="surface-card mb-6 p-5 sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-4xl">
            <span className="text-brand-gradient">Все материалы</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Статьи и новости RepublicMC: отыскивайте нужное и предлагайте правки.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "article", "news"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  kind === k
                    ? "border-cyan bg-secondary text-cyan"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "news" ? <Newspaper className="size-3.5" /> : <BookOpen className="size-3.5" />}
                {k === "all" ? "Все" : k === "news" ? "Новости" : "Статьи"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm outline-none focus:border-cyan"
            >
              <option value="all">Любая категория</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {articles?.length === 0 ? (
          <p className="surface-card p-5 text-sm text-muted-foreground">
            По выбранному фильтру пока ничего нет. Попробуйте другую категорию или напишите первую статью.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {(articles ?? []).map((a) => (
              <li key={a.slug}>
                <Link
                  to="/article/$slug"
                  params={{ slug: a.slug }}
                  className="surface-card flex h-full flex-col p-5 transition-shadow hover:glow-cyan"
                >
                  {a.cover_url ? (
                    <img
                      src={a.cover_url}
                      alt={a.title}
                      className="mb-3 h-32 w-full rounded-md object-cover"
                    />
                  ) : null}
                  <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                    {a.kind === "news" ? "Новость" : a.categories[0] ?? "Статья"}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-foreground">{a.title}</h3>
                  <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">{a.summary}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(a.updated_at)}</span>
                    <span className="flex items-center gap-1">
                      <Search className="size-3" /> {a.views}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
