import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function ReputationVote({
  targetId,
  reputation,
  targetName,
}: {
  targetId: string;
  reputation: number;
  targetName: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const myVote = useQuery({
    queryKey: ["rep-vote", targetId, user?.id],
    enabled: !!user && user.id !== targetId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_reputation_votes")
        .select("value")
        .eq("target_id", targetId)
        .eq("voter_id", user!.id)
        .maybeSingle();
      return data?.value ?? 0;
    },
  });

  async function vote(value: 1 | -1) {
    if (!user || user.id === targetId) return;
    if ((myVote.data ?? 0) === value) {
      await supabase
        .from("user_reputation_votes")
        .delete()
        .eq("target_id", targetId)
        .eq("voter_id", user.id);
    } else {
      await supabase
        .from("user_reputation_votes")
        .upsert({ target_id: targetId, voter_id: user.id, value }, { onConflict: "voter_id,target_id" });
    }
    await queryClient.invalidateQueries();
  }

  const current = myVote.data ?? 0;
  const own = user?.id === targetId;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Повысить репутацию ${targetName}`}
        disabled={!user || own}
        onClick={() => void vote(1)}
        className={`grid size-8 place-items-center rounded-md border bg-secondary transition-colors disabled:opacity-40 ${
          current === 1 ? "border-cyan text-cyan" : "border-border text-muted-foreground"
        }`}
      >
        <ThumbsUp className="size-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold text-foreground">{reputation}</span>
      <button
        type="button"
        aria-label={`Понизить репутацию ${targetName}`}
        disabled={!user || own}
        onClick={() => void vote(-1)}
        className={`grid size-8 place-items-center rounded-md border bg-secondary transition-colors disabled:opacity-40 ${
          current === -1 ? "border-magenta text-magenta" : "border-border text-muted-foreground"
        }`}
      >
        <ThumbsDown className="size-4" />
      </button>
    </div>
  );
}