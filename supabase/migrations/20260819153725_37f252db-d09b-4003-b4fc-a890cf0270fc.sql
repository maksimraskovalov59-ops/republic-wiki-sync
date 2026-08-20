-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- profile auto-create
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), split_part(NEW.email,'@',1)) || '_' || substr(NEW.id::text,1,4)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- articles
CREATE TYPE public.article_status AS ENUM ('draft','pending','published','rejected');
CREATE TYPE public.article_kind AS ENUM ('article','news');

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_url text,
  categories text[] NOT NULL DEFAULT '{}',
  kind public.article_kind NOT NULL DEFAULT 'article',
  status public.article_status NOT NULL DEFAULT 'pending',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT 'RepublicMC',
  reject_reason text,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_public_read" ON public.articles FOR SELECT USING (status = 'published');
CREATE POLICY "articles_read_own" ON public.articles FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "articles_read_admin" ON public.articles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "articles_insert_own" ON public.articles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (
    public.has_role(auth.uid(),'admin')
    OR (kind = 'article' AND status IN ('draft','pending'))
  )
);
CREATE POLICY "articles_update_own_unpublished" ON public.articles FOR UPDATE TO authenticated
USING (auth.uid() = author_id AND status <> 'published')
WITH CHECK (auth.uid() = author_id AND kind = 'article' AND status IN ('draft','pending'));
CREATE POLICY "articles_update_admin" ON public.articles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "articles_delete_admin" ON public.articles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER articles_updated_at BEFORE UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- revisions
CREATE TABLE public.article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  editor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  editor_name text NOT NULL DEFAULT 'RepublicMC',
  note text NOT NULL DEFAULT 'Правка',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.article_revisions TO anon;
GRANT SELECT, INSERT ON public.article_revisions TO authenticated;
GRANT ALL ON public.article_revisions TO service_role;
ALTER TABLE public.article_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revisions_public_read" ON public.article_revisions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_id AND a.status = 'published'));
CREATE POLICY "revisions_read_involved" ON public.article_revisions FOR SELECT TO authenticated
USING (editor_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_id AND a.author_id = auth.uid()));
CREATE POLICY "revisions_insert_own" ON public.article_revisions FOR INSERT TO authenticated
WITH CHECK (editor_id = auth.uid());

-- comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Игрок',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.comments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_id AND a.status = 'published'));
CREATE POLICY "comments_insert_auth" ON public.comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id AND char_length(body) BETWEEN 1 AND 2000
  AND EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_id AND a.status = 'published'));
CREATE POLICY "comments_delete_own_or_admin" ON public.comments FOR DELETE TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));

-- views counter
CREATE OR REPLACE FUNCTION public.increment_article_views(_slug text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.articles SET views = views + 1 WHERE slug = _slug AND status = 'published';
$$;
GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO anon, authenticated;

-- demo content
INSERT INTO public.articles (slug, title, summary, content, categories, kind, status, author_name, views) VALUES
('osnovanie-gorodov','Основание городов: полный гайд','Полное руководство по основанию и развитию городов на сервере RepublicMC.','## Введение
Города — основа политической и экономической жизни RepublicMC. Каждый город занимает территорию, платит налоги в казну Республики и участвует в выборах в Парламент.

## Требования к основанию
- Не менее 48 часов игрового времени на сервере
- Стартовый капитал: 5 000 монет в казне будущего города
- Минимум 3 жителя, подтвердивших участие
- Расстояние не менее 300 блоков от границ соседнего города

## Заявка и границы
Заявка подаётся командой /town create и рассматривается администрацией в течение суток.

## Экономика и налоги
Город платит 5% с оборота рынка в общую казну.

> Совет: держите казну положительной, иначе город распадётся.',ARRAY['Города','Гайды','Экономика'],'article','published','Gamer_Nomad',2431),
('istoriya-pervoy-respubliki','История создания Первой Республики','Как из разрозненных поселений выросла Первая Республика.','## Начало
Первые поселенцы высадились у Старого порта.

## Конституция
Через месяц был принят первый свод законов.',ARRAY['История','Политика'],'article','published','HistorianMC',1800),
('torgovye-koalicii','Торговые коалиции и эмбарго','Как работают союзы, пошлины и торговые блокады.','## Коалиции
Коалиция — это союз городов с общей таможней.

## Эмбарго
Парламент может ввести эмбарго против города-нарушителя.',ARRAY['Экономика','Политика'],'article','published','EcoExpert',940),
('pravila','Правила сервера','Основные правила поведения на RepublicMC.','## Общие правила
- Уважайте других игроков
- Гриферство запрещено
- Читы и багоюз — бан',ARRAY['Правила'],'article','published','RepublicMC',5100),
('karta-servera','Карта сервера','Интерактивная карта и основные регионы.','## Регионы
Мир разделён на пять континентов.',ARRAY['Карта'],'article','published','RepublicMC',3200),
('discord','Дискорд сервера','Как присоединиться к нашему сообществу.','## Ссылка
Присоединяйтесь к Discord, чтобы быть в курсе событий.',ARRAY['Сообщество'],'article','published','RepublicMC',1200),
('vybory-parlament','Итоги выборов в Парламент','Завершился третий тур голосования.','Демократическая коалиция забирает большинство мест в Парламенте.',ARRAY['Выборы'],'news','published','RepublicMC',420),
('zemelnyy-nalog','Поправки к земельному налогу','Опубликован новый проект реформы налогообложения.','Реформа затронет приграничные регионы и снизит ставку для малых городов.',ARRAY['Конституция'],'news','published','RepublicMC',310),
('obnovlenie-plagina','Обновление плагина городов','Технические работы завершены.','Исправлены баги с объявлением войны и договорами аренды.',ARRAY['Сервер'],'news','published','RepublicMC',280),
('yarmarka','Ярмарка в Новом Свете','Осенний фестиваль обмена ресурсами.','Главный торговый союз приглашает всех игроков на ярмарку.',ARRAY['Эвенты'],'news','published','RepublicMC',190);