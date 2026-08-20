import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Newspaper, Search, Sparkles, Star } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { getHomeData } from "@/lib/wiki.functions";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(homeQuery);
  },
  head: () => ({
    meta: [
      { title: "RepublicMC WIKI — энциклопедия сервера" },
      {
        name: "description",
        content:
          "Энциклопедия сервера RepublicMC: города, законы, экономика, политика и гайды от игроков.",
      },
      { property: "og:title", content: "RepublicMC WIKI — энциклопедия сервера" },
      {
        property: "og:description",
        content: "Города, законы, экономика и политика RepublicMC в одной вики.",
      },
    ],
  }),
  component: Index,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TAGS = [
  ["Узнай всё обо всём", false],
  ["Быстро", true],
  ["Качественно", false],
  ["Создавай", false],
  ["Бесплатно", false],
  ["Удобно", true],
  ["Делись опытом", false],
] as const;

function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...data.popular, ...data.news]
      .filter((item) => item.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, data]);
  const lucky = data.popular[0]?.slug ?? data.news[0]?.slug;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-cyan">
            <Newspaper className="size-5 shrink-0" /> Новости
          </h2>
          {data.news.length === 0 ? (
            <p className="surface-card p-4 text-xs text-muted-foreground">
              Новостей пока нет — администрация скоро что-нибудь опубликует.
            </p>
          ) : null}
          {data.news.map((n, i) => (
            <Link
              key={n.slug}
              to="/article/$slug"
              params={{ slug: n.slug }}
              className={`surface-card block p-4 transition-shadow hover:glow-cyan ${
                i === 0 ? "border-cyan/50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 text-[10px] tracking-widest text-muted-foreground uppercase">
                  {n.categories[0] ?? "Новость"}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(n.created_at)}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-foreground">{n.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>
            </Link>
          ))}
        </aside>

        <section className="flex min-w-0 flex-col items-center pt-6 text-center">
          <h1 className="text-5xl font-extrabold sm:text-7xl">
            <span className="text-brand-gradient">REPUBLICMC</span>
          </h1>
          <p className="mt-3 text-sm tracking-[0.3em] text-muted-foreground uppercase sm:text-base">
            Encyclopedia &amp; Wiki
          </p>

          <label className="glow-cyan mt-8 flex w-full items-center gap-3 rounded-xl border border-cyan/60 bg-card px-4 py-3 backdrop-blur">
            <Search className="size-5 shrink-0 text-cyan" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по статьям, городам и законам…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </label>

          {query.trim() ? (
            <div className="surface-card mt-3 w-full divide-y divide-border text-left">
              {results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Ничего не найдено</p>
              ) : (
                results.map((r) => (
                  <Link
                    key={r.slug}
                    to="/article/$slug"
                    params={{ slug: r.slug }}
                    className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {r.title}
                  </Link>
                ))
              )}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {TAGS.map(([label, accent]) => (
              <span
                key={label}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  accent
                    ? "border-magenta text-magenta"
                    : "border-border text-muted-foreground hover:border-cyan hover:text-foreground"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <aside className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-magenta">
            <Star className="size-5 shrink-0" /> Популярные статьи
          </h2>
          {data.popular.map((p) => (
            <Link
              key={p.slug}
              to="/article/$slug"
              params={{ slug: p.slug }}
              className="surface-card flex items-center gap-3 p-3 transition-shadow hover:glow-magenta"
            >
              <span
                className="size-11 shrink-0 rounded-md"
                style={{ backgroundImage: "var(--gradient-brand)", opacity: 0.7 }}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {p.title}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  by {p.author_name}
                  <Eye className="size-3 shrink-0" />
                  {p.views}
                </span>
              </span>
            </Link>
          ))}

          {lucky ? (
            <Link
              to="/article/$slug"
              params={{ slug: lucky }}
              className="glow-magenta flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-accent-foreground"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              <Sparkles className="size-4 shrink-0" /> Мне повезёт!
            </Link>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
