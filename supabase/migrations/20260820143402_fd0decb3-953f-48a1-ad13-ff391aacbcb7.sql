REVOKE EXECUTE ON FUNCTION public.increment_article_views(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;