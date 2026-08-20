import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import {
  listNotifications,
  markNotificationsRead,
  clearNotifications,
  type NotificationRow,
} from "@/lib/wiki.functions";

export function NotificationsPanel({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const doMark = useServerFn(markNotificationsRead);
  const doClear = useServerFn(clearNotifications);

  const notifications = useQuery<NotificationRow[]>({
    queryKey: ["notifications"],
    enabled,
    queryFn: () => listNotifications(),
  });

  if (!enabled) return null;
  const items = notifications.data ?? [];

  async function markAll() {
    await doMark({ data: {} });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function clearAll() {
    await doClear();
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-cyan uppercase">
          <Bell className="size-4" /> Уведомления
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void markAll()}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs"
          >
            <CheckCheck className="size-3.5 text-cyan" /> Прочитано
          </button>
          <button
            type="button"
            onClick={() => void clearAll()}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs"
          >
            <Trash2 className="size-3.5 text-magenta" /> Очистить
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Уведомлений пока нет.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-3 ${
                n.read_at ? "border-border bg-secondary/30" : "border-cyan/50 bg-secondary/60"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString("ru-RU")}
                {n.link ? (
                  <>
                    {" · "}
                    <a href={n.link} className="text-cyan">
                      открыть
                    </a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
