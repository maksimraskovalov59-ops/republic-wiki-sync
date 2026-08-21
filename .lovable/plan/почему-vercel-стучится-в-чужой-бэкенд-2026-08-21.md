# Почему Vercel стучится в чужой бэкенд

## Причина (проверено)

Файл `.env` не внесён в `.gitignore` и отслеживается git — значит он уезжает в GitHub и попадает в сборку на Vercel. В нём прописан адрес бэкенда Lovable (`pubpjsosqizyoqkejasq`). Vite подставляет значения `VITE_*` прямо в код при сборке, и файл в репозитории перебивает то, что ты задал в переменных окружения Vercel. Поэтому кнопка GitHub уходит на `pubpjsosqizyoqkejasq.supabase.co`, где провайдер GitHub не включён → «Unsupported provider».

## Что сделаю

1. Добавлю `.env` в `.gitignore` и уберу файл из отслеживания git (локально он останется — превью в Lovable продолжит работать).
2. `.env.example` оставлю как шаблон.
3. В `DEPLOY.md` добавлю явный блок: `.env` в репозиторий не коммитить, все переменные задаются только в Vercel, после изменения переменных нужен Redeploy без кеша.

## Что нужно сделать тебе на стороне Vercel (после моего изменения)

1. В Vercel → Project → Settings → Environment Variables задать для Production и Preview:
   - `VITE_SUPABASE_URL` = `https://dzeqiiylrljyjoszdati.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable/anon-ключ своего проекта
   - `VITE_SUPABASE_PROJECT_ID` = `dzeqiiylrljyjoszdati`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` — те же значения
   - `SUPABASE_SERVICE_ROLE_KEY` — service role своего проекта
   - `ADMIN_UNLOCK_PASSWORD` — пароль админки
2. Сделать Redeploy с отключённым кешем сборки.
3. В своём бэкенде включить провайдеры GitHub и Discord (Client ID/Secret), а в OAuth-приложениях указать callback:
   `https://dzeqiiylrljyjoszdati.supabase.co/auth/v1/callback`
4. Там же в настройках авторизации указать Site URL и Redirect URLs своего домена Vercel.

## Как проверить

После редеплоя нажать «GitHub» на `/auth`: адрес в строке браузера должен начинаться с `https://dzeqiiylrljyjoszdati.supabase.co/auth/v1/authorize?provider=github`.
