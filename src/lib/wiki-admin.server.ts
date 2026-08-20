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