import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { getArticles } from "@/lib/wiki.functions";

const categoryQuery = (category: string) =>
  queryOptions({
    queryKey: ["articles", "category", category],
    queryFn: () => getArticles({ data: { category } }),
  });

export const Route = createFileRoute("/category/$name")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(categoryQuery(params.name));
  },
  head: ({ params }) => {
    const title = `${params.name} — категория — RepublicMC WIKI`;
    const description = `Статьи и новости в категории «${params.name}» в энциклопедии RepublicMC.`;
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
  component: CategoryPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function CategoryPage() {
  const { name } = Route.useParams();
  const { data: articles } = useSuspenseQuery(categoryQuery(name));

  return (
    <div className="min-h-screen text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto max-w-7xl 2xl:max-w-[1600px] min-[1900px]:max-w-[1800px] px-4 py-8 sm:px-6">
        <div className="surface-card mb-6 p-5 sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-4xl">
            <span className="text-brand-gradient">{name}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Материалы в категории «{name}».{" "}
            <Link to="/articles" className="text-cyan hover:underline">
              Смотреть все материалы
            </Link>
          </p>
        </div>

        {articles.length === 0 ? (
          <p className="surface-card p-5 text-sm text-muted-foreground">
            В этой категории пока нет материалов.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {articles.map((a) => (
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
