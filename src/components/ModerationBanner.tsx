import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { getMyModeration, type BlockState } from "@/lib/wiki.functions";

function fmt(iso: string | null) {
  if (!iso) return "бессрочно";
  const d = new Date(iso);
  if (d.getFullYear() > 2100) return "бессрочно";
  return `до ${d.toLocaleString("ru-RU")}`;
}

export function ModerationBanner({ enabled }: { enabled: boolean }) {
  const state = useQuery<BlockState>({
    queryKey: ["my-moderation"],
    enabled,
    queryFn: () => getMyModeration(),
  });

  const data = state.data;
  if (!enabled || !data || (!data.muted && !data.banned)) return null;

  return (
    <div className="surface-card border-magenta/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-magenta">
        <ShieldAlert className="size-4" />
        {data.banned ? "Аккаунт заблокирован" : "Режим только чтение (мут)"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.reason ?? "Нарушение правил вики"} · {fmt(data.banned ? data.bannedUntil : data.mutedUntil)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Публикация статей, правок и комментариев недоступна. По вопросам обращайтесь к администрации.
      </p>
    </div>
  );
}
