import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";

export const Route = createFileRoute("/reset-password")({
  head: () => {
    const title = "Новый пароль — RepublicMC WIKI";
    const description = "Установите новый пароль для аккаунта RepublicMC WIKI.";
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") !== "recovery") {
      setError("Ссылка для сброса пароля недействительна. Запросите новую ссылку на странице входа.");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => void navigate({ to: "/auth", replace: true }), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
        <h1 className="text-center text-3xl font-extrabold">
          <span className="text-brand-gradient">Новый пароль</span>
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Придумайте новый пароль для входа в аккаунт.
        </p>

        {success ? (
          <div className="surface-card mt-6 p-5 text-center">
            <p className="text-sm text-cyan">Пароль обновлён. Перенаправляем на страницу входа…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="surface-card mt-6 space-y-4 p-5">
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground uppercase">Новый пароль</span>
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
              disabled={busy || !password.trim()}
              className="glow-cyan flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              <KeyRound className="size-4" />
              {busy ? "Сохранение…" : "Сохранить пароль"}
            </button>
          </form>
        )}

        <Link to="/auth" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          ← Ко входу
        </Link>
      </main>
    </div>
  );
}
