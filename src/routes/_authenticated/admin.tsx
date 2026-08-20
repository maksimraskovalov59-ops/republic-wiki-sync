import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Newspaper, PencilLine, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { PixelField } from "@/components/PixelField";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => {
    const title = "Админ-панель — RepublicMC WIKI";
    const description =
      "Модерация статей RepublicMC WIKI и публикация новостей сервера для администраторов вики.";
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
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});

  const pending = useQuery({
    queryKey: ["admin-pending"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id,slug,title,summary,author_name,kind,status,updated_at")
        .in("status", ["pending", "rejected"])
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const published = useQuery({
    queryKey: ["admin-published"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id,slug,title,kind,views,updated_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  async function moderate(id: string, status: "published" | "rejected") {
    await supabase
      .from("articles")
      .update({ status, reject_reason: status === "rejected" ? (reason[id] ?? "Не соответствует правилам") : null })
      .eq("id", id);
    await queryClient.invalidateQueries();
  }

  if (loading) {
    return <div className="min-h-screen bg-background p-10 text-muted-foreground">Загрузка…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PixelField />
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto size-10 text-magenta" />
          <h1 className="mt-4 text-2xl font-bold">Доступ только для администрации</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Подтвердите права администратора в кабинете.
          </p>
          <Link
            to="/cabinet"
            className="mt-6 inline-block rounded-md border border-border bg-secondary px-4 py-2 text-sm"
          >
            В кабинет
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PixelField />
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          <div className="surface-card p-5">
            <h1 className="text-2xl font-extrabold sm:text-3xl">
              <span className="text-brand-gradient">Админ-панель</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Модерация материалов и публикация новостей сервера.
            </p>
          </div>

          <div className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-cyan uppercase">Очередь модерации</h2>
            {pending.data?.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">Новых заявок нет.</p>
            )}
            <ul className="mt-3 space-y-3">
              {(pending.data ?? []).map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {a.kind === "news" ? "Новость" : "Статья"} · {a.author_name}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void moderate(a.id, "published")}
                      className="flex items-center gap-1.5 rounded-md border border-cyan/60 bg-secondary px-3 py-1.5 text-xs transition-shadow hover:glow-cyan"
                    >
                      <Check className="size-3.5 text-cyan" /> Опубликовать
                    </button>
                    <input
                      value={reason[a.id] ?? ""}
                      onChange={(e) => setReason((r) => ({ ...r, [a.id]: e.target.value }))}
                      placeholder="Причина отклонения"
                      className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs outline-none focus:border-magenta"
                    />
                    <button
                      onClick={() => void moderate(a.id, "rejected")}
                      className="flex items-center gap-1.5 rounded-md border border-magenta/60 bg-secondary px-3 py-1.5 text-xs transition-shadow hover:glow-magenta"
                    >
                      <X className="size-3.5 text-magenta" /> Отклонить
                    </button>
                    <Link
                      to="/editor"
                      search={{ id: a.id }}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs"
                    >
                      <PencilLine className="size-3.5 text-blue" /> Править
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card p-5">
            <h2 className="text-sm font-bold tracking-wide text-magenta uppercase">
              Опубликованные материалы
            </h2>
            <ul className="mt-3 space-y-2">
              {(published.data ?? []).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5"
                >
                  <Link
                    to="/article/$slug"
                    params={{ slug: a.slug }}
                    className="min-w-0 truncate text-sm text-foreground hover:text-cyan"
                  >
                    {a.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {a.kind === "news" ? "Новость" : "Статья"} · {a.views}
                    <Link to="/editor" search={{ id: a.id }} className="text-cyan">
                      править
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-cyan uppercase">
              <Newspaper className="size-4" /> Новости
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Новости может публиковать только администрация — они сразу попадают на главную.
            </p>
            <Link
              to="/editor"
              search={{ kind: "news" as const }}
              className="glow-cyan mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-accent-foreground"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              <Newspaper className="size-4" /> Добавить новость
            </Link>
          </section>
        </aside>
      </main>
    </div>
  );
}
