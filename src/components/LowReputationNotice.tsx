import { AlertTriangle } from "lucide-react";
import { LOW_REPUTATION_THRESHOLD } from "@/lib/wiki.functions";

export function LowReputationNotice({
  reputation,
  variant = "article",
}: {
  reputation: number | null | undefined;
  variant?: "article" | "profile";
}) {
  if (reputation == null || reputation > LOW_REPUTATION_THRESHOLD) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-magenta/50 bg-magenta/10 px-3 py-2 text-xs text-magenta">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {variant === "article"
          ? "У автора низкая репутация — относитесь к материалу критически."
          : "У этого участника низкая репутация."}{" "}
        Это только предупреждение, никаких ограничений оно не даёт.
      </span>
    </div>
  );
}