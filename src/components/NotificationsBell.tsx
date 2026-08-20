import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import {
  listNotifications,
  markNotificationsRead,
  clearNotifications,
  type NotificationRow,
} from "@/lib/wiki.functions";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

export function NotificationsBell({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const doMark = useServerFn(markNotificationsRead);
  const doClear = useServerFn(clearNotifications);

  const notifications = useQuery<NotificationRow[]>({
    queryKey: ["notifications"],
    enabled,
    refetchInterval: 60_000,
    queryFn: () => listNotifications(),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled) return null;

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  async function markAll() {
    await doMark({ data: {} });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function clearAll() {
    await doClear();
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Уведомления"
        aria-expanded={open}
        className="relative flex shrink-0 items-center rounded-md border border-border bg-secondary p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 grid min-w-[1.05rem] place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold text-background">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Уведомления</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void markAll()}
                title="Отметить всё прочитанным"
                className="text-muted-foreground transition-colors hover:text-cyan"
              >
                <CheckCheck className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => void clearAll()}
                title="Очистить"
                className="text-muted-foreground transition-colors hover:text-magenta"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Пока ничего нового.</p>
          ) : (
            <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
              {items.slice(0, 20).map((n) => {
                const inner = (
                  <>
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </>
                );
                const cls = `block rounded-lg border p-3 ${
                  n.read_at ? "border-border bg-secondary/30" : "border-cyan/50 bg-secondary/60"
                }`;
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} onClick={() => setOpen(false)} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
