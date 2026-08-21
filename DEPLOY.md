# Деплой RepublicMC WIKI на Vercel + перенос данных в свой Supabase

## 0. Что понадобится

- Аккаунт [Vercel](https://vercel.com) и репозиторий на GitHub с этим кодом.
- Аккаунт [Supabase](https://supabase.com) и новый пустой проект.
- Локально: Node.js 20+, `npm`, Supabase CLI (`npm i -g supabase`), `psql` (входит в PostgreSQL client tools).

---

## 1. Создать свой проект Supabase

1. Supabase → **New project**. Запишите:
   - Project ref (например `abcdefghijklmno`) — виден в URL дашборда.
   - Пароль базы данных (его показывают один раз).
2. **Project Settings → API** — скопируйте:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` / publishable key → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (секрет, только сервер!)

## 2. Перенести схему (таблицы, RLS, функции, триггеры)

Все миграции лежат в репозитории в `supabase/migrations/`. Их достаточно применить по порядку:

```bash
supabase login
supabase link --project-ref <ваш-project-ref>
supabase db push
```

После этого в новом проекте появятся:

- таблицы `profiles`, `user_roles`, `articles`, `article_revisions`, `comments`,
  `edit_suggestions`, `notifications`, `admin_audit_log`, `user_reputation_votes`;
- enum-типы `app_role`, `article_kind`, `article_status`, `suggestion_status`;
- функции (`has_role`, `handle_new_user`, `increment_article_views`, `is_blocked`,
  `recalc_reputation`, …), триггеры, политики RLS и GRANT-ы.

Проверка:

```bash
psql "$NEW_DB_URL" -c "\dt public.*"
```

где `NEW_DB_URL` = **Project Settings → Database → Connection string (URI)** с вашим паролем.

## 3. Перенести данные

Данные текущего проекта живут в базе Lovable Cloud. Экспорт делается обычным `pg_dump`
только по схемам `public` и `auth` (остальные системные схемы Supabase создаёт сам).

### 3.1. Контент (`public`)

```bash
# OLD_DB_URL — connection string исходной базы, NEW_DB_URL — новой
pg_dump "$OLD_DB_URL" \
  --data-only --schema=public \
  --no-owner --no-privileges \
  --disable-triggers \
  -f wiki-public-data.sql

psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f wiki-public-data.sql
```

`--disable-triggers` важен: иначе триггеры уведомлений и пересчёта репутации выстрелят
на каждой вставленной строке. Требуется подключение как суперпользователь/владелец —
используйте строку подключения из раздела Database (роль `postgres`).

### 3.2. Пользователи (`auth.users`)

Порядок обязателен: сначала пользователи, потом `public` (там FK на `auth.users`).
Поэтому на практике делайте так:

```bash
pg_dump "$OLD_DB_URL" --data-only --table=auth.users --table=auth.identities \
  --no-owner --no-privileges -f wiki-auth-users.sql

psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f wiki-auth-users.sql   # ДО шага 3.1
```

Хэши паролей переносятся вместе со строками, так что старые пароли продолжат работать.
Если строка `auth.users` вставляется до `public`, триггер `on_auth_user_created` сам
создаст `profiles`/`user_roles`; конфликты гасятся `ON CONFLICT DO NOTHING`, но чтобы
данные профилей не перетёрлись, применяйте `public`-дамп после и с `--disable-triggers`.

Альтернатива без доступа к `auth`: попросить игроков зарегистрироваться заново, а статьи
перенести через CSV (Table Editor → Export CSV / Import CSV), проставив `author_id`
вручную.

### 3.3. Файлы (Storage)

Бакеты `article-covers` и `article-media` — приватные. Создайте их в новом проекте
(Storage → New bucket, Public = off) и скопируйте файлы:

```bash
supabase storage cp -r ss:///article-covers ./backup/article-covers --experimental   # из старого проекта
supabase storage cp -r ./backup/article-covers ss:///article-covers --experimental   # в новый (после link)
```

Или скачайте/загрузите файлы через дашборд, если их немного.

### 3.4. Аутентификация и секреты

- **Authentication → URL Configuration**: Site URL = ваш домен на Vercel,
  Redirect URLs = `https://<домен>/**`.
- **Authentication → Providers → Google**: включите и вставьте свои Client ID/Secret
  (Lovable-брокер в своём деплое не работает — используется обычный Supabase OAuth).
- Проверьте, что у создателя есть роль admin:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'ваш@email';
```

---

## 4. Подготовка проекта (уже сделано в коде)

- `vite.config.ts` автоматически собирает Nitro с пресетом `vercel`, когда сборка идёт
  на Vercel (переменная `VERCEL`). Локально/в Lovable поведение не меняется.
  Ручное переопределение: `NITRO_PRESET=vercel npm run build`.
- `vercel.json` задаёт `buildCommand`/`installCommand` и отключает автодетект фреймворка.
- `.env.example` перечисляет все нужные переменные окружения.

Локальная проверка production-сборки:

```bash
NITRO_PRESET=vercel npm run build
```

## 5. Деплой на Vercel

1. Vercel → **Add New… → Project** → импортируйте репозиторий.
2. Framework Preset: **Other** (настройки подхватятся из `vercel.json`).
3. **Environment Variables** (Production + Preview) — из `.env.example`, значения нового
   Supabase:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
   - `SUPABASE_SERVICE_ROLE_KEY` (секрет)
   - `ADMIN_UNLOCK_PASSWORD`
4. **Deploy**. Node.js version — 20 или 22 (Settings → General).
5. После первого деплоя вернитесь в Supabase и впишите домен в Site URL / Redirect URLs.

## 6. Чек-лист после деплоя

- [ ] Главная открывается, статьи и категории загружаются (SSR работает).
- [ ] Регистрация/вход, OAuth через GitHub и Discord.
- [ ] Создание статьи → появляется в кабинете → админ публикует.
- [ ] Колокольчик уведомлений получает событие о публикации.
- [ ] Админка открывается по `ADMIN_UNLOCK_PASSWORD`, выдача ролей работает.
- [ ] Загрузка обложки статьи (Storage-бакеты и политики).
- [ ] Счётчик просмотров растёт (RPC `increment_article_views`).

## 7. Частые проблемы

| Симптом | Причина / решение |
| --- | --- |
| `Missing Supabase environment variable(s)` | не заданы серверные `SUPABASE_*` в Vercel |
| `supabaseUrl is required.` / «This page didn't load» на прод-домене | нет серверных `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY` в Vercel (Production + Preview) → добавьте и сделайте **Redeploy** |
| Пустые списки статей на прод-домене | не применены GRANT/RLS → выполните `supabase db push` заново |
| `Unsupported provider` при входе через GitHub/Discord | провайдер не включён в Authentication → Providers |
| Редирект после входа на `localhost` | не обновлён Site URL в Supabase |
| Сборка падает на Nitro/Cloudflare | явно задайте `NITRO_PRESET=vercel` в Environment Variables |
| Ошибки FK при импорте данных | сначала `auth.users`, потом `public`, с `--disable-triggers` |

## 8. Вход через GitHub и Discord

Вход через Google убран. На странице `/auth` теперь две кнопки — GitHub и Discord
(`supabase.auth.signInWithOAuth({ provider })`, редирект на `window.location.origin`).

### 8.1. Callback URL

Один и тот же адрес для обоих провайдеров:

```
https://<PROJECT-REF>.supabase.co/auth/v1/callback
```

`<PROJECT-REF>` — ref твоего Supabase-проекта (Project Settings → General).

### 8.2. GitHub OAuth App

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
2. Application name: `RepublicMC WIKI`.
3. Homepage URL: адрес сайта на Vercel (например `https://republic-wiki.vercel.app`).
4. Authorization callback URL: адрес из 8.1.
5. Register application → Generate a new client secret.
6. Скопируй **Client ID** и **Client Secret**.

### 8.3. Discord Application

1. https://discord.com/developers/applications → **New Application** → название.
2. Раздел **OAuth2** → Redirects → Add Redirect → вставь адрес из 8.1 → Save.
3. Там же скопируй **Client ID** и **Client Secret** (Reset Secret, если не показан).
4. Scopes в коде не задаются вручную — Supabase запрашивает `identify email`.

### 8.4. Включение в Supabase

1. Supabase Dashboard → **Authentication → Providers**.
2. **GitHub**: Enable → вставь Client ID / Client Secret → Save.
3. **Discord**: Enable → вставь Client ID / Client Secret → Save.
4. **Authentication → URL Configuration**:
   - Site URL: `https://<твой-домен>`
   - Redirect URLs: `https://<твой-домен>/**` и (для локальной разработки)
     `http://localhost:5173/**`.
5. Google можно выключить — он больше не используется.

### 8.5. Vercel

Отдельных переменных для OAuth не нужно: секреты провайдеров живут в Supabase.
Проверь только, что заданы `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`
(Production + Preview) и что домен Vercel указан в Site URL / Redirect URLs.
После смены домена — обнови Homepage/Redirect и в GitHub, и в Discord.

### 8.6. Проверка и типовые ошибки

| Симптом | Решение |
| --- | --- |
| `Unsupported provider: provider is not enabled` | провайдер не включён в Authentication → Providers |
| `redirect_uri is not associated with this application` | callback в GitHub/Discord не совпадает с 8.1 |
| После входа кидает на `localhost` | не обновлён Site URL в Supabase |
| Ник пустой после OAuth-входа | задай никнейм в кабинете — он берётся из профиля провайдера, если тот его отдал |
