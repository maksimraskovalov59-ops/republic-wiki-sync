import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      setError("Проверьте почту — мы отправили ссылку для подтверждения аккаунта.");
      return;
    }
    void navigate({ to: "/cabinet", replace: true });
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

          <button
            type="submit"
            disabled={busy}
            className="glow-cyan flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            {mode === "in" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
            {busy ? "Секунду…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          ← На главную
        </Link>
      </main>
    </div>
  );
}
