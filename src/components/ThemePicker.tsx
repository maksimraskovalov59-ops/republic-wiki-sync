import { Check, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { THEMES, type ThemeId } from "@/lib/themes";

type Props = {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
  canUsePremium: boolean;
  columns?: 1 | 2;
};

export function ThemePicker({ value, onChange, canUsePremium, columns = 2 }: Props) {
  return (
    <div className={`mt-3 grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
      {THEMES.map((t) => {
        const locked = t.premium && !canUsePremium;
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={locked}
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
              active ? "border-cyan bg-secondary/60" : "border-border bg-secondary/30"
            } ${locked ? "cursor-not-allowed opacity-55" : "hover:bg-secondary/70"}`}
          >
            <span className="flex shrink-0 -space-x-1.5">
              {t.swatch.map((c) => (
                <span
                  key={c}
                  className="size-5 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {t.label}
                {locked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{t.description}</span>
            </span>
            {active ? <Check className="size-4 shrink-0 text-cyan" /> : null}
          </button>
        );
      })}
      {!canUsePremium ? (
        <p className={`text-xs text-muted-foreground ${columns === 2 ? "sm:col-span-2" : ""}`}>
          Дополнительные темы открываются после{" "}
          <Link to="/auth" className="text-cyan underline">
            регистрации
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
