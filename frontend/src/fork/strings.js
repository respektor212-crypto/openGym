// The fork's own strings. Kept here rather than in locales/*.js so pulling upstream never meets a
// conflict in the locale packs. English is the key and the fallback, as with upstream's t().
import { getLang, baseLang } from '../lib/i18n-core.js'

const RU = {
  'Backup': 'Бэкап',
  'Save backup': 'Сохранить бэкап',
  'Load backup': 'Загрузить бэкап',
  'Backup saved': 'Бэкап сохранён',
  'Last backup: {0}': 'Последний бэкап: {0}',
  'No backup saved yet': 'Бэкап ещё не сохранялся',
  'Replaces the data on this phone — you see what is in the file first.': 'Заменяет данные на телефоне — сначала покажет, что в файле.',
  'Saves opengym-YYYY-MM-DD.json. In the share sheet choose “Save to Files” → “On My iPhone”. Works without a network.':
    'Сохраняет файл opengym-ГГГГ-ММ-ДД.json. В меню «Поделиться» выбери «Сохранить в Файлы» → «На iPhone». Работает без сети.',
  'Time to save a backup': 'Пора сохранить бэкап',
  'Last backup {0} ago. Your workouts exist only on this phone.': 'Последний бэкап — {0} назад. Тренировки хранятся только на этом телефоне.',
  'No backup yet. Your workouts exist only on this phone.': 'Бэкапа ещё нет. Тренировки хранятся только на этом телефоне.',
  'Save': 'Сохранить',
  'Load this backup?': 'Загрузить этот бэкап?',
  'In the file': 'В файле',
  'On this phone now': 'Сейчас на телефоне',
  'from {0} to {1}': 'с {0} по {1}',
  'Everything on this phone is replaced by the file.': 'Всё, что сейчас на телефоне, будет заменено данными из файла.',
  'Replace with the backup': 'Заменить данными из файла',
  'Cancel': 'Отмена',
  'Backup loaded': 'Бэкап загружен',
  'This file is not an openGym backup': 'Этот файл — не бэкап openGym',
  'Could not save the backup': 'Не удалось сохранить бэкап',
  'Offline exercise media': 'Медиа упражнений офлайн',
  'Download media for offline': 'Скачать медиа для офлайна',
  'Downloading: {0} of {1} · {2}': 'Загрузка: {0} из {1} · {2}',
  'Offline: {0} of {1}': 'В офлайне: {0} из {1}',
  'Checking…': 'Проверяю…',
  'Your plan has no exercises yet': 'В программах пока нет упражнений',
  'All media of your plan are on this phone': 'Все медиа из программ уже на телефоне',
  '{0} could not be downloaded — try again with a network': 'Не скачалось: {0} — повтори, когда будет сеть',
  'Pictures and animations of the exercises in your routines. Exercises you add later download by themselves while there is a network (in the app opened from the Home Screen).':
    'Картинки и анимации упражнений из твоих программ. Упражнения, добавленные позже, докачиваются сами, пока есть сеть (в приложении, открытом с экрана «Домой»).',
  'No network — connect and try again': 'Нет сети — подключись и повтори',
  'MB': 'МБ',
}

// Nouns with their plural forms, for the counts in the previews and the banner.
const NOUNS = {
  workout: { en: ['workout', 'workouts'], ru: ['тренировка', 'тренировки', 'тренировок'] },
  routine: { en: ['routine', 'routines'], ru: ['программа', 'программы', 'программ'] },
  weighIn: { en: ['weigh-in', 'weigh-ins'], ru: ['взвешивание', 'взвешивания', 'взвешиваний'] },
  file: { en: ['file', 'files'], ru: ['файл', 'файла', 'файлов'] },
  day: { en: ['day', 'days'], ru: ['день', 'дня', 'дней'] },
}

const isRu = () => baseLang(getLang()) === 'ru'

/** Translate a fork string; {0},{1}… are replaced with args, as in upstream's t(). */
export function ft(s, ...args) {
  let v = (isRu() && RU[s]) || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}

/** Russian plural form index: 0 for 1/21/31…, 1 for 2–4/22–24…, 2 for the rest (5–20, 11–14…). */
export function ruForm(n) {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return 2
  if (b === 1) return 0
  if (b >= 2 && b <= 4) return 1
  return 2
}

/** "3 тренировки", "1 workout". */
export function count(n, noun) {
  const forms = NOUNS[noun]
  if (!forms) return String(n)
  const word = isRu() ? forms.ru[ruForm(n)] : forms.en[n === 1 ? 0 : 1]
  return n + ' ' + word
}

export { RU as _RU_FOR_TESTS }
