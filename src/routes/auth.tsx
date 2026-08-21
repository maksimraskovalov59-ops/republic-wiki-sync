import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import wikiMark from "@/assets/wiki-mark.png";

import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";

export const Route = createFileRoute("/auth")({
  head: () => {
    const title = "Вход и регистрация — RepublicMC WIKI";
    const description =
      "Войдите или создайте аккаунт RepublicMC WIKI, чтобы писать статьи, редактировать страницы и оставлять комментарии.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/cabinet", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { username },
              emailRedirectTo: `${window.location.origin}/cabinet`,
            },
          });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    if (!res.data.session) {
      setSuccess("Проверьте почту — мы отправили ссылку для подтверждения аккаунта.");
      return;
    }
    void navigate({ to: "/cabinet", replace: true });
  }

  async function signInWithProvider(provider: "github" | "discord") {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    }
    // Если ошибки нет — браузер уже уходит на страницу провайдера.
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Введите email, чтобы сбросить пароль.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess("Ссылка для сброса пароля отправлена на email.");
  }

  return (
    <div className="min-h-screen text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
        <img
          src={wikiMark}
          alt="Эмблема RepublicMC WIKI"
          width={1024}
          height={1024}
          className="glow-cyan mx-auto size-20 rounded-2xl border border-border object-cover sm:size-24"
        />
        <h1 className="mt-5 text-center text-3xl font-extrabold">
          <span className="text-brand-gradient">{mode === "in" ? "Вход" : "Регистрация"}</span>
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Аккаунт открывает комментарии, написание и редактирование статей.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/50 p-1">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === m ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "in" ? "Войти" : "Создать аккаунт"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void signInWithProvider("github")}
            disabled={busy}
            className="surface-card flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-shadow hover:glow-cyan disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.24-3.24-.13-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.88.12 3.18.77.84 1.24 1.92 1.24 3.24 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.83.58A11.99 11.99 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
            </svg>
            GitHub
          </button>
          <button
            type="button"
            onClick={() => void signInWithProvider("discord")}
            disabled={busy}
            className="surface-card flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-shadow hover:glow-magenta disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.32 4.37A19.8 19.8 0 0 0 15.43 3a13.9 13.9 0 0 0-.62 1.28 18.4 18.4 0 0 0-5.62 0A13.7 13.7 0 0 0 8.56 3 19.7 19.7 0 0 0 3.67 4.37C.56 9.05-.28 13.58.14 18.05a19.9 19.9 0 0 0 6.07 3.08c.47-.65.89-1.34 1.25-2.06a12.9 12.9 0 0 1-1.97-.95c.17-.12.33-.25.48-.38a14.2 14.2 0 0 0 12.06 0c.16.14.32.26.48.38-.63.37-1.29.69-1.98.95.36.72.78 1.41 1.25 2.06a19.86 19.86 0 0 0 6.08-3.08c.5-5.18-.85-9.67-3.54-13.68zM8.02 15.33c-1.18 0-2.15-1.09-2.15-2.43s.95-2.44 2.15-2.44c1.21 0 2.18 1.1 2.16 2.44 0 1.34-.96 2.43-2.16 2.43zm7.96 0c-1.18 0-2.15-1.09-2.15-2.43s.95-2.44 2.15-2.44c1.21 0 2.18 1.1 2.16 2.44 0 1.34-.95 2.43-2.16 2.43z" />
            </svg>
            Discord
          </button>
        </div>

        <form onSubmit={submit} className="surface-card mt-4 space-y-4 p-5">
          {mode === "up" && (
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground uppercase">Никнейм</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-cyan"
            />
          </label>

          {error && <p className="text-sm text-magenta">{error}</p>}
          {success && <p className="text-sm text-cyan">{success}</p>}

          <button
            type="submit"
            disabled={busy}
            className="glow-cyan flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            {mode === "in" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
            {busy ? "Секунду…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
          </button>

          {mode === "in" && (
            <button
              type="button"
              onClick={resetPassword}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Забыли пароль? Сбросить
            </button>
          )}
        </form>

        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          ← На главную
        </Link>
      </main>
    </div>
  );
}
