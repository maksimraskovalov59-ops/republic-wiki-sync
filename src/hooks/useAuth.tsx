import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  username: string | null;
  isAdmin: boolean;
  refresh: () => void;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setUsername(null);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [profile, roles] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      setUsername(profile.data?.username ?? null);
      setIsAdmin((roles.data ?? []).some((r) => r.role === "admin"));
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, tick]);

  return {
    loading,
    session,
    user: session?.user ?? null,
    username,
    isAdmin,
    refresh: () => setTick((t) => t + 1),
  };
}