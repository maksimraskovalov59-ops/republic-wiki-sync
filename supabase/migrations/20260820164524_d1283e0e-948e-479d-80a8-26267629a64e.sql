ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS blocked_by uuid;

-- protect_profile_fields: also protect moderation fields from self-edit
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.reputation := OLD.reputation;
    NEW.muted_until := OLD.muted_until;
    NEW.banned_until := OLD.banned_until;
    NEW.block_reason := OLD.block_reason;
    NEW.blocked_by := OLD.blocked_by;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text NOT NULL DEFAULT 'Администрация',
  action text NOT NULL,
  target_type text NOT NULL DEFAULT 'other',
  target_label text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read_admin ON public.admin_audit_log;
CREATE POLICY audit_read_admin ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_read_own ON public.notifications;
CREATE POLICY notifications_read_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- helper: is user muted or banned right now
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (COALESCE(muted_until, 'epoch'::timestamptz) > now()
        OR COALESCE(banned_until, 'epoch'::timestamptz) > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.block_writes_when_muted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL AND public.is_blocked(_uid) THEN
    RAISE EXCEPTION 'Ваш аккаунт ограничен модерацией: запись недоступна';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS comments_block_muted ON public.comments;
CREATE TRIGGER comments_block_muted BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_when_muted();
DROP TRIGGER IF EXISTS articles_block_muted ON public.articles;
CREATE TRIGGER articles_block_muted BEFORE INSERT ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_when_muted();
DROP TRIGGER IF EXISTS suggestions_block_muted ON public.edit_suggestions;
CREATE TRIGGER suggestions_block_muted BEFORE INSERT ON public.edit_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_when_muted();

-- notifications: article status change
CREATE OR REPLACE FUNCTION public.notify_article_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.author_id IS NULL OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'published' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.author_id, 'article_published', 'Материал опубликован',
            format('«%s» прошёл проверку и опубликован.', NEW.title), '/article/' || NEW.slug);
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.author_id, 'article_rejected', 'Материал отклонён',
            format('«%s»: %s', NEW.title, COALESCE(NEW.reject_reason, 'без указания причины')), '/cabinet');
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS articles_notify_status ON public.articles;
CREATE TRIGGER articles_notify_status AFTER UPDATE OF status ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.notify_article_status();

-- notifications: suggestion decision
CREATE OR REPLACE FUNCTION public.notify_suggestion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _slug text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT slug INTO _slug FROM public.articles WHERE id = NEW.article_id;
  IF NEW.status = 'accepted' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.author_id, 'suggestion_accepted', 'Правка принята',
            format('Ваша правка к «%s» принята.', NEW.title), '/article/' || COALESCE(_slug, ''));
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.author_id, 'suggestion_rejected', 'Правка отклонена',
            format('Правка к «%s»: %s', NEW.title, COALESCE(NEW.reject_reason, 'без указания причины')), '/cabinet');
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS suggestions_notify_status ON public.edit_suggestions;
CREATE TRIGGER suggestions_notify_status AFTER UPDATE OF status ON public.edit_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.notify_suggestion_status();

-- notifications: reputation votes
CREATE OR REPLACE FUNCTION public.notify_reputation_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _target uuid := COALESCE(NEW.target_id, OLD.target_id);
  _rep int;
BEGIN
  SELECT reputation INTO _rep FROM public.profiles WHERE id = _target;
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  VALUES (_target, 'reputation', 'Изменилась репутация',
          format('Ваша репутация теперь %s.', COALESCE(_rep, 0)), '/cabinet');
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS rep_votes_notify ON public.user_reputation_votes;
CREATE TRIGGER rep_votes_notify AFTER INSERT OR UPDATE OR DELETE ON public.user_reputation_votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_reputation_vote();

-- notifications: roles
CREATE OR REPLACE FUNCTION public.notify_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (NEW.user_id, 'role', 'Выданы права администратора',
            'Теперь вам доступна админ-панель вики.', '/admin');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (OLD.user_id, 'role', 'Права администратора сняты',
            'Доступ к админ-панели отключён.', '/cabinet');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
DROP TRIGGER IF EXISTS user_roles_notify ON public.user_roles;
CREATE TRIGGER user_roles_notify AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.notify_role_change();