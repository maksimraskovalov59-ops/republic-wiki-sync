import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { searchArticles } from "@/lib/wiki.functions";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => {
    const title = "Поиск — RepublicMC WIKI";
    const description = "Поиск по статьям, новостям и материалам энциклопедии RepublicMC.";
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
  component: SearchPage,
});

function SearchPage() {
  const { q } = useSearch({ from: Route.id });
  const navigate = useNavigate({ from: Route.id });
  const [query, setQuery] = useState(q ?? "");
  const { data: results, isFetching } = useQuery({
    queryKey: ["search", q ?? ""],
    queryFn: () => searchArticles({ data: { q: q ?? "" } }),
    enabled: !!q && q.trim().length > 0,
  });

  useEffect(() => {
    setQuery(q ?? "");
  }, [q]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 xl:max-w-5xl py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold sm:text-4xl">
          <span className="text-brand-gradient">Поиск</span>
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { q: query.trim() } });
          }}
          className="surface-card mt-4 flex items-center gap-2 p-2"
        >
          <SearchIcon className="ml-2 size-5 text-cyan" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название, тема или текст статьи…"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            Найти
          </button>
        </form>

        {q ? (
          <div className="mt-6">
            {isFetching ? (
              <p className="text-sm text-muted-foreground">Поиск…</p>
            ) : results?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ничего не найдено.</p>
            ) : (
              <ul className="space-y-3">
                {(results ?? []).map((r) => (
                  <li key={r.slug} className="surface-card p-4">
                    <Link to="/article/$slug" params={{ slug: r.slug }} className="block">
                      <p className="text-xs tracking-widest text-muted-foreground uppercase">
                        {r.kind === "news" ? "Новость" : (r.categories?.[0] ?? "Статья")}
                      </p>
                      <p className="mt-1 font-semibold text-foreground">{r.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
