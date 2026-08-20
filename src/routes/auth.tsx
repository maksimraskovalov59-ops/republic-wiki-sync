import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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

  async function signInWithGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
    }
    // Если redirected == true, страница уже ушла на провайдера.
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
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
        <h1 className="text-center text-3xl font-extrabold">
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

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="surface-card mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-shadow hover:glow-cyan"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Войти через Google
        </button>

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
