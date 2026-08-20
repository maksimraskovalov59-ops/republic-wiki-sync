-- 1. profiles extra fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS reputation integer NOT NULL DEFAULT 0;

-- 2. reputation votes
CREATE TABLE IF NOT EXISTS public.user_reputation_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voter_id, target_id),
  CHECK (voter_id <> target_id)
);

GRANT SELECT ON public.user_reputation_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reputation_votes TO authenticated;
GRANT ALL ON public.user_reputation_votes TO service_role;

ALTER TABLE public.user_reputation_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rep_votes_public_read ON public.user_reputation_votes;
CREATE POLICY rep_votes_public_read ON public.user_reputation_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS rep_votes_insert_own ON public.user_reputation_votes;
CREATE POLICY rep_votes_insert_own ON public.user_reputation_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid() AND target_id <> auth.uid());

DROP POLICY IF EXISTS rep_votes_update_own ON public.user_reputation_votes;
CREATE POLICY rep_votes_update_own ON public.user_reputation_votes FOR UPDATE TO authenticated
  USING (voter_id = auth.uid()) WITH CHECK (voter_id = auth.uid());

DROP POLICY IF EXISTS rep_votes_delete_own ON public.user_reputation_votes;
CREATE POLICY rep_votes_delete_own ON public.user_reputation_votes FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

-- 3. recalc trigger
CREATE OR REPLACE FUNCTION public.recalc_reputation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
BEGIN
  _target := COALESCE(NEW.target_id, OLD.target_id);
  UPDATE public.profiles p
     SET reputation = COALESCE((SELECT SUM(v.value) FROM public.user_reputation_votes v WHERE v.target_id = _target), 0)
   WHERE p.id = _target;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_reputation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rep_votes_recalc ON public.user_reputation_votes;
CREATE TRIGGER rep_votes_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.user_reputation_votes
FOR EACH ROW EXECUTE FUNCTION public.recalc_reputation();

-- 4. profiles: keep reputation immutable from client updates
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.reputation := OLD.reputation;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_fields ON public.profiles;
CREATE TRIGGER profiles_protect_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 5. permanent creator admin
CREATE OR REPLACE FUNCTION public.is_creator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND lower(username) = 'thehapppyone'
  );
$$;

REVOKE ALL ON FUNCTION public.is_creator(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_creator_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' AND public.is_creator(OLD.user_id) THEN
    RAISE EXCEPTION 'Нельзя снять права администратора у создателя';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_creator_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_roles_protect_creator ON public.user_roles;
CREATE TRIGGER user_roles_protect_creator
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_creator_role();

-- grant creator admin automatically when the profile username matches
CREATE OR REPLACE FUNCTION public.grant_creator_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.username, '')) = 'thehapppyone' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_creator_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_grant_creator_admin ON public.profiles;
CREATE TRIGGER profiles_grant_creator_admin
AFTER INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_creator_admin();

-- backfill for an existing creator account
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role FROM public.profiles p
WHERE lower(p.username) = 'thehapppyone'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. admins can manage roles
DROP POLICY IF EXISTS user_roles_insert_admin ON public.user_roles;
CREATE POLICY user_roles_insert_admin ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;
CREATE POLICY user_roles_delete_admin ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));