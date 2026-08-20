import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Eye, FolderTree, Newspaper, Search, Sparkles, Star } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import {
  getCategories,
  getHomeData,
  getRandomArticleSlug,
  getRecentChanges,
} from "@/lib/wiki.functions";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
});

const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => getCategories(),
});

const recentQuery = queryOptions({
  queryKey: ["recent"],
  queryFn: () => getRecentChanges(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(homeQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(recentQuery),
    ]);
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

const SECTIONS = [
  { label: "Все статьи", to: "/articles", hint: "Полный каталог материалов" },
  { label: "Изменения", to: "/recent", hint: "Свежие правки вики" },
  {
    label: "Правила",
    to: "/article/$slug",
    params: { slug: "pravila" },
    hint: "Законы и порядок сервера",
  },
  {
    label: "Карта",
    to: "/article/$slug",
    params: { slug: "karta-servera" },
    hint: "Города и территории",
  },
  {
    label: "Сообщество",
    to: "/article/$slug",
    params: { slug: "soobshchestvo" },
    hint: "Сайт и Telegram",
  },
] as const;

function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: recent } = useSuspenseQuery(recentQuery);
  const [query, setQuery] = useState("");
  const [spinning, setSpinning] = useState(false);
  const navigate = useNavigate({ from: "/" });
  const getRandom = useServerFn(getRandomArticleSlug);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...data.popular, ...data.news]
      .filter((item) => item.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, data]);

  const handleLucky = async () => {
    setSpinning(true);
    try {
      const slug = await getRandom();
      if (slug) navigate({ to: "/article/$slug", params: { slug } });
    } finally {
      setSpinning(false);
    }
  };

  const hasArticles = data.popular.length > 0 || data.news.length > 0;
  const totals = useMemo(() => {
    const views = data.popular.reduce((sum, p) => sum + (p.views ?? 0), 0);
    return { articles: recent.articles.length, views };
  }, [data.popular, recent.articles]);
  return (
    <div className="min-h-screen text-foreground">
      <PixelField />
      <SiteHeader />

      <main className="mx-auto grid max-w-7xl 2xl:max-w-[1600px] min-[1900px]:max-w-[1800px] gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[280px_minmax(0,1fr)_300px] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="order-3 space-y-3 lg:order-1">
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

        <section className="order-1 flex min-w-0 flex-col items-center text-center lg:order-2 lg:pt-6">
          <h1 className="text-4xl font-extrabold sm:text-6xl lg:text-7xl">
            <span className="text-brand-gradient">REPUBLICMC</span>
          </h1>
          <p className="mt-2 text-xs tracking-[0.3em] text-muted-foreground uppercase sm:mt-3 sm:text-base">
            Encyclopedia &amp; Wiki
          </p>

          <label className="glow-cyan mt-5 flex w-full items-center gap-3 rounded-xl border border-cyan/60 bg-card px-4 py-3 backdrop-blur sm:mt-8">
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

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground">Города</span>,{" "}
            <span className="text-foreground">законы</span>,{" "}
            <span className="text-foreground">экономика</span> и{" "}
            <span className="text-foreground">политика</span> RepublicMC — в одной вики.
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:mt-8 lg:grid-cols-4">
            {[
              { label: "Материалов", value: totals.articles },
              { label: "Просмотров", value: totals.views },
              { label: "Категорий", value: categories.length },
              { label: "Правок", value: recent.revisions.length },
            ].map((s) => (
              <div key={s.label} className="surface-card p-4">
                <span className="block text-2xl font-extrabold text-brand-gradient">{s.value}</span>
                <span className="mt-1 block text-[11px] tracking-widest text-muted-foreground uppercase">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {categories.length > 0 ? (
            <div className="surface-card mt-4 w-full p-5 text-left">
              <h2 className="flex items-center gap-2 text-base font-bold text-cyan">
                <FolderTree className="size-4 shrink-0" /> Категории
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link
                    key={c}
                    to="/category/$name"
                    params={{ name: c }}
                    className="rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-cyan hover:text-foreground"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="order-2 space-y-3 lg:order-3">
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

          {hasArticles ? (
            <button
              type="button"
              onClick={handleLucky}
              disabled={spinning}
              className="glow-magenta flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-70"
              style={{ backgroundImage: "var(--gradient-accent)" }}
            >
              <Sparkles className={`size-4 shrink-0${spinning ? " animate-spin" : ""}`} /> Мне повезёт!
            </button>
          ) : null}
        </aside>

        <section className="order-4 grid gap-6 lg:col-span-3 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="surface-card p-5 sm:p-6">
            <h2 className="text-lg font-bold text-cyan">Разделы вики</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Всё о сервере в одном месте — заходи в нужный раздел или начни с общего списка.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SECTIONS.map((s) =>
                "params" in s ? (
                  <Link
                    key={s.label}
                    to={s.to}
                    params={s.params}
                    className="rounded-lg border border-border bg-secondary/40 p-4 transition-colors hover:border-cyan"
                  >
                    <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{s.hint}</span>
                  </Link>
                ) : (
                  <Link
                    key={s.label}
                    to={s.to}
                    className="rounded-lg border border-border bg-secondary/40 p-4 transition-colors hover:border-cyan"
                  >
                    <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{s.hint}</span>
                  </Link>
                ),
              )}
            </div>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-magenta">
              <Clock className="size-5 shrink-0" /> Последние обновления
            </h2>
            <ul className="mt-4 space-y-2">
              {recent.articles.slice(0, 6).map((a) => (
                <li key={a.slug}>
                  <Link
                    to="/article/$slug"
                    params={{ slug: a.slug }}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 transition-colors hover:border-magenta"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {a.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {a.author_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(a.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/recent" className="mt-4 inline-block text-xs text-cyan hover:underline">
              Все изменения →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
