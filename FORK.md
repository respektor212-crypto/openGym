# Личная сборка openGym (форк)

Форк [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0, см. `LICENSE`,
`NOTICE.md`). Сайт: **https://respektor212-crypto.github.io/openGym/** — статическое PWA на GitHub
Pages: без сервера, без аккаунта, данные только на телефоне.

## Что отличается от upstream

Всё включается флагом сборки `VITE_LOCAL=1`. Без флага приложение ведёт себя ровно как upstream
(так прогоняются и все upstream-тесты).

- Старт сразу в приложении: без экрана входа, без демо-данных, без запросов к `/api`.
  AI Coach, синхронизация, passkeys и push-уведомления сервера скрыты (нет сервера — нет конфига).
- Русский язык по умолчанию (меняется в Настройках).
- Офлайн: сервис-воркер при установке кеширует **всё** приложение (кроме языковых пакетов
  других языков), медиа упражнений раздаются с этого же сайта (`img/`, `gif/`), при запуске
  запрашивается `navigator.storage.persist()`.
- Настройки → «Медиа упражнений офлайн»: кнопка «Скачать медиа для офлайна» с прогрессом.
  Докачка при изменении плана — штатная upstream (`lib/media-prefetch.js`, в приложении с экрана «Домой»).
- Настройки → «Бэкап»: «Сохранить бэкап» (Web Share → «Сохранить в Файлы», иначе скачивание,
  файл `opengym-ГГГГ-ММ-ДД.json` — это штатный JSON-экспорт upstream) и «Загрузить бэкап»
  (превью: сколько тренировок, даты → подтверждение → штатный импорт upstream).
  Та же кнопка на экране «Тренировка завершена», баннер на главной, если бэкапу > 7 дней.

## Где код

- `frontend/src/fork/` — весь код форка и его тесты.
- `fork/postbuild.mjs` — дописывает список precache в собранный `dist/sw.js` (сам `public/sw.js` не меняется).
- `fork/fetch-media.sh` — кладёт картинки/GIF в `dist/` при сборке (в git их нет, см. `NOTICE.md`).
- `.github/workflows/personal-pages.yml` — тесты → сборка → медиа → деплой на Pages при пуше в `main`.

Правки в upstream-файлах — однострочные вставки, помечены импортом из `fork/`:
`frontend/src/main.jsx`, `store/useStore.js`, `components/SyncBanner.jsx`, `views/Home.jsx`,
`views/Settings.jsx`, `sheets.jsx`; плюс одна строка в нестабильном upstream-тесте
`views/CoachChat.demo-failure.test.jsx` (заранее грузит модуль, который тест ждал 20 микротасков).

Воркфлоу upstream (`pages.yml`, `docker-publish.yml`, `test.yml`, `mirror.yml`) не удалены, а
выключены в GitHub → Actions → (воркфлоу) → «Disable workflow».

## Обновление из upstream

```bash
git fetch upstream
git merge upstream/main
cd frontend && npm ci && npm test
git push origin main
```

Если merge сообщит о конфликте — он будет в одной из строк, перечисленных выше.
