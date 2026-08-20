REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.block_writes_when_muted() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_article_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_suggestion_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_reputation_vote() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_role_change() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO service_role;