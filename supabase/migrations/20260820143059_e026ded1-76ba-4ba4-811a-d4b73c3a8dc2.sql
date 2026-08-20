UPDATE public.articles
SET slug = 'soobshchestvo',
    title = 'Сообщество',
    summary = 'Официальные ссылки RepublicMC: сайт сервера и Telegram.',
    content = '## Официальные ссылки

- **Официальный сайт** — [republicmc.ru](https://republicmc.ru/): новости, информация о сервере и правилах.
- **Telegram** — [t.me/republicmc](https://t.me/republicmc): анонсы, обновления и общение с игроками.

## Как быть в курсе

Подписывайтесь на Telegram-канал, чтобы первыми узнавать об обновлениях, ивентах и технических работах. Все официальные объявления публикуются только на сайте и в Telegram — остальным источникам не доверяйте.',
    categories = ARRAY['Сообщество'],
    updated_at = now()
WHERE slug = 'discord';