import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink,
  LogOut,
  Palette,
  PencilLine,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { claimAdmin, getPublicProfile } from "@/lib/wiki.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";
import { LowReputationNotice } from "@/components/LowReputationNotice";
import { useTheme } from "@/hooks/useTheme";
import { ThemePicker } from "@/components/ThemePicker";

export const Route = createFileRoute("/_authenticated/cabinet")({
  head: () => {
    const title = "Кабинет участника — RepublicMC WIKI";
    const description =
      "Личный кабинет RepublicMC WIKI: ваши статьи, статусы модерации и подтверждение прав администратора.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Cabinet,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "text-muted-foreground border-border" },
  pending: { label: "На модерации", cls: "text-blue border-blue/60" },
  published: { label: "Опубликовано", cls: "text-cyan border-cyan/60" },
  rejected: { label: "Отклонено", cls: "text-magenta border-magenta/60" },
};

function Cabinet() {
  const { user, username, isAdmin, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doClaim = useServerFn(claimAdmin);
  const [password, setPassword] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const { theme, setTheme } = useTheme(!!user);
  const [profileForm, setProfileForm] = useState<{ bio: string; link: string; avatar_url: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,bio,link,avatar_url,reputation,created_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const stats = useQuery({
    queryKey: ["my-stats", username],
    enabled: !!username,
    queryFn: () => getPublicProfile({ data: { username: username! } }),
  });

  const form =
    profileForm ?? {
      bio: profile.data?.bio ?? "",
      link: profile.data?.link ?? "",
      avatar_url: profile.data?.avatar_url ?? "",
    };

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        bio: form.bio.slice(0, 500),
        link: form.link.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setProfileMsg("Не удалось сохранить профиль");
      return;
    }
    setProfileMsg("Профиль сохранён");
    await queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
  }

  const mine = useQuery({
    queryKey: ["my-articles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id,slug,title,status,kind,reject_reason,updated_at")
        .eq("author_id", user!.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    setClaimMsg(null);
    const res = await doClaim({ data: { password } });
    if (res.ok) {
      setPassword("");
      setClaimMsg("Права администратора подтверждены.");
      refresh();
    } else {
      setClaimMsg(res.error);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl 2xl:max-w-[1600px] min-[1900px]:max-w-[1800px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">Кабинет</p>
              <h1 className="mt-1 truncate text-2xl font-extrabold sm:text-3xl">
                <span className="text-brand-gradient">{username ?? user?.email}</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAdmin ? "Роль: администратор" : "Роль: участник"}
                {profile.data ? ` · репутация ${profile.data.reputation}` : ""}
              </p>
              {username && (
                <Link
                  to="/user/$username"
                  params={{ username }}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-cyan hover:underline"
                >
                  <ExternalLink className="size-3" /> Открыть публичный профиль
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/editor"
                className="glow-cyan flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-accent-foreground"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                <Plus className="size-4" /> Новая статья
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm"
              >
                <LogOut className="size-4 text-magenta" /> Выйти
              </button>
            </div>
          </div>

          <div className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">Мои материалы</h2>
            {mine.isLoading && <p className="mt-3 text-sm text-muted-foreground">Загрузка…</p>}
            {mine.data?.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Пока ничего нет. Создайте первую статью — она уйдёт на модерацию.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {(mine.data ?? []).map((a) => {
                const st = STATUS[a.status]!;
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.kind === "news" ? "Новость" : "Статья"} · /{a.slug}
                        {a.reject_reason ? ` · причина: ${a.reject_reason}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs ${st.cls}`}>
                        {st.label}
                      </span>
                      {(a.status !== "published" || isAdmin) && (
                        <Link
                          to="/editor"
                          search={{ id: a.id }}
                          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs"
                        >
                          <PencilLine className="size-3.5 text-cyan" /> Править
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <form onSubmit={saveProfile} className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-cyan uppercase">
              <UserCog className="size-4" /> Профиль
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Аватар, описание и ссылка видны всем на вашей публичной странице.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Ваш аватар"
                  className="size-16 rounded-xl border border-border object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid size-16 place-items-center rounded-xl border border-border bg-secondary text-lg font-bold text-muted-foreground">
                  {(username ?? "??").slice(0, 2).toUpperCase()}
                </div>
              )}
              <input
                value={form.avatar_url}
                onChange={(e) => setProfileForm({ ...form, avatar_url: e.target.value })}
                placeholder="Ссылка на аватар (URL картинки)"
                className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
              />
            </div>
            <textarea
              value={form.bio}
              onChange={(e) => setProfileForm({ ...form, bio: e.target.value })}
              maxLength={500}
              placeholder="О себе: ник в игре, чем занимаетесь на сервере…"
              className="mt-3 min-h-[100px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
            <input
              value={form.link}
              onChange={(e) => setProfileForm({ ...form, link: e.target.value })}
              placeholder="Ссылка (Telegram, сайт и т.д.)"
              className="mt-3 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-md border border-cyan/60 bg-secondary px-4 py-2 text-sm transition-shadow hover:glow-cyan disabled:opacity-50"
              >
                <Save className="size-4 text-cyan" /> {saving ? "Сохраняем…" : "Сохранить профиль"}
              </button>
              {profileMsg && <span className="text-xs text-muted-foreground">{profileMsg}</span>}
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-magenta uppercase">Моя статистика</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center justify-between gap-3">
                <span>Статей опубликовано</span>
                <span className="font-semibold text-foreground">{stats.data?.stats.published ?? 0}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Просмотров</span>
                <span className="font-semibold text-foreground">{stats.data?.stats.views ?? 0}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Правок</span>
                <span className="font-semibold text-foreground">{stats.data?.stats.revisions ?? 0}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Комментариев</span>
                <span className="font-semibold text-foreground">{stats.data?.stats.comments ?? 0}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span>Репутация</span>
                <span className="font-semibold text-foreground">{profile.data?.reputation ?? 0}</span>
              </li>
            </ul>
            <div className="mt-3">
              <LowReputationNotice reputation={profile.data?.reputation} variant="profile" />
            </div>
          </section>
          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-cyan uppercase">
              <Palette className="size-4" /> Тема оформления
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Светлая и тёмная доступны всем. Остальные палитры открыты для участников с аккаунтом.
            </p>
            <ThemePicker value={theme} onChange={setTheme} canUsePremium={!!user} columns={1} />
          </section>
          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-magenta uppercase">
              <ShieldCheck className="size-4" /> Права админа
            </h2>
            {isAdmin ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Права подтверждены. Доступна модерация статей и публикация новостей.
                </p>
                <Link
                  to="/admin"
                  className="glow-magenta mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-accent-foreground"
                  style={{ backgroundImage: "var(--gradient-accent)" }}
                >
                  <Sparkles className="size-4" /> Админ-панель
                </Link>
              </>
            ) : (
              <form onSubmit={submitClaim} className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Введите пароль администрации, чтобы открыть панель модерации.
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль администратора"
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-magenta"
                />
                <button
                  type="submit"
                  className="w-full rounded-md border border-magenta/60 bg-secondary px-3 py-2 text-sm font-medium transition-shadow hover:glow-magenta"
                >
                  Подтвердить права админа
                </button>
                {claimMsg && <p className="text-sm text-magenta">{claimMsg}</p>}
              </form>
            )}
          </section>

          <section className="surface-card p-5 text-sm text-muted-foreground">
            <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">Как это работает</h2>
            <ul className="mt-3 space-y-2">
              <li>· Любой участник может писать и редактировать статьи.</li>
              <li>· Все статьи проходят модерацию перед публикацией.</li>
              <li>· Новости публикуют только администраторы.</li>
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}
