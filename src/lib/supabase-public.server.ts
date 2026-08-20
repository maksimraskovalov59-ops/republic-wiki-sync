import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function createPublicClient() {
  // Prefer server env; fall back to the build-time inlined VITE_* vars so the app
  // works on hosts (Vercel, etc.) where only the VITE_ variables are configured.
  const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variable(s): set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY) in your hosting environment.",
    );
  }

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
