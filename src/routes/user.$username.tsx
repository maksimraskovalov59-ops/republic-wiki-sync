import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileText, GitPullRequest, MessageSquare, ShieldCheck, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { LowReputationNotice } from "@/components/LowReputationNotice";
import { ReputationVote } from "@/components/ReputationVote";
import { getPublicProfile } from "@/lib/wiki.functions";
import { CREATOR_USERNAME } from "@/lib/wiki-constants";

export const Route = createFileRoute("/user/$username")({
  head: ({ params }) => {
    const title = `${params.username} — участник RepublicMC WIKI`;
    const description = `Профиль участника ${params.username}: статьи, правки, комментарии и репутация в RepublicMC WIKI.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: UserProfilePage,
});

const ACTIVITY_ICON = {
  article: FileText,
  revision: GitPullRequest,
  comment: MessageSquare,
} as const;

function UserProfilePage() {
  const { username } = Route.useParams();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => getPublicProfile({ data: { username } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PixelField />
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-20 text-muted-foreground">Загрузка…</main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PixelField />
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Участник не найден</h1>
          <Link to="/articles" className="mt-6 inline-block rounded-md bg-secondary px-4 py-2 text-sm">
            Ко всем материалам
          </Link>
        </main>
      </div>
    );
  }

  const stats = [
    { label: "Статей опубликовано", value: profile.stats.published, icon: FileText },
    { label: "Просмотров", value: profile.stats.views, icon: TrendingUp },
    { label: "Правок", value: profile.stats.revisions, icon: GitPullRequest },
    { label: "Комментариев", value: profile.stats.comments, icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl 2xl:max-w-[1600px] min-[1900px]:max-w-[1800px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          <div className="surface-card flex flex-wrap items-center gap-4 p-5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Аватар ${profile.username}`}
                className="size-16 rounded-xl border border-border object-cover"
                loading="lazy"
              />
            ) : (
              <div className="grid size-16 place-items-center rounded-xl border border-border bg-secondary text-xl font-bold text-muted-foreground">
                {profile.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-extrabold sm:text-3xl">
                <span className="text-brand-gradient">{profile.username}</span>
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {profile.isCreator && (
                  <span className="flex items-center gap-1 rounded-full border border-magenta/60 px-2 py-0.5 text-magenta">
                    <ShieldCheck className="size-3" /> Создатель
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" /> с {new Date(profile.created_at).toLocaleDateString("ru-RU")}
                </span>
              </p>
            </div>
            <ReputationVote targetId={profile.id} reputation={profile.reputation} targetName={profile.username} />
          </div>

          <LowReputationNotice reputation={profile.reputation} variant="profile" />

          {profile.bio.trim() && (
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">О себе</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{profile.bio}</p>
              {profile.link && (
                <a
                  href={profile.link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-3 inline-block text-sm text-cyan underline"
                >
                  {profile.link}
                </a>
              )}
            </div>
          )}

          <div className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">Статьи участника</h2>
            {profile.articles.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Опубликованных статей пока нет.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {profile.articles.map((a) => (
                  <li key={a.slug} className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
                    <Link
                      to="/article/$slug"
                      params={{ slug: a.slug }}
                      className="text-sm font-semibold text-foreground hover:text-cyan"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {a.kind === "news" ? "Новость" : "Статья"} · {a.views} просмотров
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-magenta uppercase">Статистика</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {stats.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <s.icon className="size-3.5 text-cyan" /> {s.label}
                  </span>
                  <span className="font-semibold text-foreground">{s.value}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>Репутация</span>
                <span className="font-semibold text-foreground">{profile.reputation}</span>
              </li>
            </ul>
            {profile.username.toLowerCase() === CREATOR_USERNAME.toLowerCase() && (
              <p className="mt-3 text-xs text-muted-foreground">Создатель вики — права администратора постоянные.</p>
            )}
          </section>

          <section className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">Активность</h2>
            {profile.activity.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Пока нет активности.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {profile.activity.map((a, i) => {
                  const Icon = ACTIVITY_ICON[a.kind];
                  const at = new Date(a.at).toLocaleDateString("ru-RU");
                  return (
                    <li key={`${a.kind}-${i}`} className="flex items-start gap-2 text-muted-foreground">
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-cyan" />
                      <span className="min-w-0">
                        {a.slug ? (
                          <Link to="/article/$slug" params={{ slug: a.slug }} className="hover:text-cyan">
                            {a.label}
                          </Link>
                        ) : (
                          a.label
                        )}
                        <span className="block text-xs">{at}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}