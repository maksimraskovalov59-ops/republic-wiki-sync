import { Link, useRouter } from "@tanstack/react-router";
import { BookOpenText, Menu, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

const NAV = [
  { label: "Все статьи", to: "/articles" },
  { label: "Поиск", to: "/search" },
  { label: "Изменения", to: "/recent" },
  { label: "Правила", to: "/article/$slug", params: { slug: "pravila" } },
  { label: "Карта", to: "/article/$slug", params: { slug: "karta-servera" } },
  { label: "Дискорд", to: "/article/$slug", params: { slug: "discord" } },
] as const;

export function SiteHeader() {
  const { user, username, isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = router.state.location.pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:flex sm:justify-between sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <BookOpenText className="size-5 shrink-0 text-cyan" />
          <span className="truncate font-display text-lg font-extrabold tracking-tight">
            <span className="text-brand-gradient">REPUBLICMC</span>{" "}
            <span className="text-foreground">WIKI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 justify-self-end sm:gap-2">
          <div className="hidden items-center gap-1 md:flex">
            {NAV.map((item) =>
              "params" in item ? (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
          {isAdmin ? (
            <Link
              to="/admin"
              className="hidden shrink-0 items-center gap-1.5 rounded-md border border-magenta/60 px-3 py-2 text-sm text-magenta transition-shadow hover:glow-magenta sm:flex"
            >
              <ShieldCheck className="size-4 shrink-0" /> Админка
            </Link>
          ) : null}
          <Link
            to={user ? "/cabinet" : "/auth"}
            className="shrink-0 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-shadow hover:glow-cyan"
          >
            {loading ? "…" : user ? (username ?? "Кабинет") : "Войти"}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-border p-2 text-muted-foreground md:hidden"
            aria-label="Меню"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>
      </div>

      {open ? (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) =>
              "params" in item ? (
                <Link
                  key={item.label}
                  to={item.to}
                  params={item.params}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm ${
                    pathname === item.to ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm ${
                    pathname === item.to ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-magenta"
              >
                Админка
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
