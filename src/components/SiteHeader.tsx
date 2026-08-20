import { Link, useRouter } from "@tanstack/react-router";
import { BookOpenText, Menu, Palette, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { ThemePicker } from "@/components/ThemePicker";

const NAV = [
  { label: "Все статьи", to: "/articles" },
  { label: "Поиск", to: "/search" },
  { label: "Изменения", to: "/recent" },
  { label: "Правила", to: "/article/$slug", params: { slug: "pravila" } },
  { label: "Карта", to: "/article/$slug", params: { slug: "karta-servera" } },
  { label: "Сообщество", to: "/article/$slug", params: { slug: "soobshchestvo" } },
] as const;

export function SiteHeader() {
  const { user, username, isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const { theme, setTheme } = useTheme(!!user);
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!themeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!themeRef.current?.contains(e.target as Node)) setThemeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setThemeOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [themeOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl 2xl:max-w-[1600px] min-[1900px]:max-w-[1800px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 sm:flex sm:justify-between sm:gap-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <BookOpenText className="size-5 shrink-0 text-cyan" />
          <span className="truncate font-display text-sm font-extrabold tracking-tight sm:text-lg">
            <span className="text-brand-gradient">REPUBLICMC</span>{" "}
            <span className="text-foreground">WIKI</span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 justify-self-end sm:gap-2">
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
          <div className="relative" ref={themeRef}>
            <button
              type="button"
              onClick={() => setThemeOpen((v) => !v)}
              aria-label="Тема оформления"
              aria-expanded={themeOpen}
              className="flex shrink-0 items-center rounded-md border border-border bg-secondary p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Palette className="size-5" />
            </button>
            {themeOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-xl">
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  Тема оформления
                </p>
                <ThemePicker
                  value={theme}
                  onChange={(id) => {
                    setTheme(id);
                    setThemeOpen(false);
                  }}
                  canUsePremium={!!user}
                  columns={1}
                />
              </div>
            ) : null}
          </div>
          <Link
            to={user ? "/cabinet" : "/auth"}
            className="max-w-[7rem] shrink-0 truncate rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-shadow hover:glow-cyan sm:max-w-none sm:px-4"
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
