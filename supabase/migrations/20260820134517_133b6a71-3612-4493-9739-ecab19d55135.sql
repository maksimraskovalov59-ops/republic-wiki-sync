CREATE TYPE public.suggestion_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE public.edit_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Игрок',
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  cover_url text,
  note text NOT NULL DEFAULT 'Предложенная правка',
  status public.suggestion_status NOT NULL DEFAULT 'pending',
  reject_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edit_suggestions TO authenticated;
GRANT ALL ON public.edit_suggestions TO service_role;

ALTER TABLE public.edit_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suggestions_read_own_or_admin"
ON public.edit_suggestions FOR SELECT
TO authenticated
USING (
  auth.uid() = author_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR auth.uid() = (SELECT author_id FROM public.articles WHERE id = article_id)
);

CREATE POLICY "suggestions_insert"
ON public.edit_suggestions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "suggestions_update_admin"
ON public.edit_suggestions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "suggestions_delete_admin"
ON public.edit_suggestions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER edit_suggestions_updated_at
BEFORE UPDATE ON public.edit_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "article_covers_public_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'article-covers');

CREATE POLICY "article_covers_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'article-covers' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "article_covers_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'article-covers' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "article_covers_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'article-covers' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "article_media_public_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'article-media');

CREATE POLICY "article_media_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'article-media' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "article_media_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'article-media' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "article_media_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'article-media' AND split_part(name, '/', 1) = auth.uid()::text);