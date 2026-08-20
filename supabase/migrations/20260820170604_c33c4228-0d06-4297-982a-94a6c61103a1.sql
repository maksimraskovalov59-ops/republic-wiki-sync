CREATE OR REPLACE FUNCTION public.recalc_reputation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _target uuid;
BEGIN
  _target := COALESCE(NEW.target_id, OLD.target_id);
  PERFORM set_config('app.allow_profile_system_update', 'on', true);
  UPDATE public.profiles p
     SET reputation = COALESCE((SELECT SUM(v.value) FROM public.user_reputation_votes v WHERE v.target_id = _target), 0)
   WHERE p.id = _target;
  PERFORM set_config('app.allow_profile_system_update', 'off', true);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() <> 'service_role'
     AND COALESCE(current_setting('app.allow_profile_system_update', true), 'off') <> 'on' THEN
    NEW.reputation := OLD.reputation;
    NEW.muted_until := OLD.muted_until;
    NEW.banned_until := OLD.banned_until;
    NEW.block_reason := OLD.block_reason;
    NEW.blocked_by := OLD.blocked_by;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles p
   SET reputation = COALESCE((SELECT SUM(v.value) FROM public.user_reputation_votes v WHERE v.target_id = p.id), 0);