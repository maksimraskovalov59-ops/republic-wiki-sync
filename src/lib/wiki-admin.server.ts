import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Server-only role check. Runs with elevated privileges, so callers must
 *  already have a verified user id from the auth middleware. */
export async function userHasRole(userId: string, role: "admin" | "user") {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });
  if (error) return false;
  return Boolean(data);
}

/** Server-only view counter. */
export async function incrementArticleViews(slug: string) {
  await supabaseAdmin.rpc("increment_article_views", { _slug: slug });
}
/** Server-only audit trail writer. */
export async function logAdminAction(entry: {
  actorId: string;
  actorName: string;
  action: string;
  targetType: "user" | "article" | "comment" | "other";
  targetLabel: string;
  details?: string;
}) {
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    target_type: entry.targetType,
    target_label: entry.targetLabel,
    details: entry.details ?? "",
  });
}

/** Server-only notification writer. */
export async function notifyUser(entry: {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  link?: string | null;
}) {
  await supabaseAdmin.from("notifications").insert({
    user_id: entry.userId,
    kind: entry.kind,
    title: entry.title,
    body: entry.body ?? "",
    link: entry.link ?? null,
  });
}

/** Server-only moderation state read. */
export async function getBlockState(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("muted_until,banned_until,block_reason")
    .eq("id", userId)
    .maybeSingle();
  const now = Date.now();
  const muted = data?.muted_until ? new Date(data.muted_until).getTime() > now : false;
  const banned = data?.banned_until ? new Date(data.banned_until).getTime() > now : false;
  return {
    muted,
    banned,
    reason: data?.block_reason ?? null,
    mutedUntil: data?.muted_until ?? null,
    bannedUntil: data?.banned_until ?? null,
  };
}
