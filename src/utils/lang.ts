// ============================================================
// lang.ts — второй язык (английский) + автоопределение.
// Использование: t('play') — вернёт текст на ТЕКУЩЕМ языке.
// {name} в шаблонах заменяется через t('key', { name: value }).
// Переключатель — в Настройках; без сохранения — язык браузера
// (на Яндексе позже подставим язык игрока из SDK).
// Комментарии здесь НЕ переводятся — только значения словаря.
// ============================================================

export type Lang = 'ru' | 'en';

const LANG_KEY = 'tct_lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    // Недоступно — определяем по браузеру
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
      return 'en';
    }
  } catch {
    // Недоступно — русский
  }
  return 'ru';
}

export function currentLang(): Lang {
  return detect();
}

export function saveLang(l: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    // Тихо игнорируем
  }
}

export function nextLang(l: Lang): Lang {
  return l === 'ru' ? 'en' : 'ru';
}

export function langName(l: Lang): string {
  return l === 'ru' ? 'Русский' : 'English';
}

type Vars = Record<string, string | number>;

// Словарь интерфейса. Ключ — место использования (см. комментарии).
const STR: Record<string, { ru: string; en: string }> = {
  // --- Главное меню: логотип и подзаголовок ---
  logoA: { ru: 'Там, где свет ', en: 'Where light ' },
  logoB: { ru: ' встречает тьму', en: ' meets darkness' },
  gameTitle: { ru: 'ЭХО ДВУХ МИРОВ', en: 'ECHO OF TWO WORLDS' },
  logoSub: { ru: 'Там, где свет встречает тьму', en: 'Where light meets darkness' },
  // --- Главное меню: кнопки ---
  play: { ru: 'ИГРАТЬ', en: 'PLAY' },
  howTo: { ru: 'КАК ИГРАТЬ', en: 'HOW TO PLAY' },
  settings: { ru: 'НАСТРОЙКИ', en: 'SETTINGS' },
  back: { ru: '[ Назад ]', en: '[ Back ]' },
  // --- Главное меню: топ и рекорды ---
  top10: { ru: 'ТОП-10 ЗА РАУНД', en: 'TOP 10 PER ROUND' },
  allList: { ru: 'ВЕСЬ СПИСОК', en: 'FULL LIST' },
  records: { ru: 'ЛИЧНЫЕ РЕКОРДЫ', en: 'PERSONAL BESTS' },
  recBest: { ru: 'Лучший раунд:', en: 'Best round:' },
  recTotal: { ru: 'Лучший за всё:', en: 'Best total:' },
  recGames: { ru: 'Партий:', en: 'Games:' },
  recWins: { ru: 'Побед:', en: 'Wins:' },
  recDaily: { ru: 'Задач дня:', en: 'Daily tasks:' },
  // --- Главное меню: задача дня ---
  dailyTitle: { ru: 'ЗАДАЧА ДНЯ', en: 'DAILY TASK' },
  dailyDone: { ru: 'Пройдена: {s}/{t}', en: 'Done: {s}/{t}' },
  dailyNoAttempts: { ru: 'Попытки кончились', en: 'No attempts left' },
  dailyStatus: { ru: 'Статус: {s}', en: 'Status: {s}' },
  dailyTry: { ru: 'ПОПРОБОВАТЬ', en: 'TRY' },
  dailyWon: { ru: 'ПРОЙДЕНА', en: 'DONE' },
  dailyPlayed: { ru: 'СЫГРАНО', en: 'PLAYED' },
  dailyNext: { ru: 'Следующая через {t}', en: 'Next in {t}' },
  // --- Главное меню: достижения и награды ---
  allAch: { ru: 'ВСЕ ДОСТИЖЕНИЯ', en: 'ALL ACHIEVEMENTS' },
  achTitle: { ru: 'ДОСТИЖЕНИЯ {n}/{m}', en: 'ACHIEVEMENTS {n}/{m}' },
  skinsUnlocked: { ru: 'Открыты {name} камни — навсегда!', en: '{name} stones unlocked — forever!' },
  // --- Игра: кнопки и счётчики ---
  exit: { ru: 'Выход', en: 'Exit' },
  exitBtn: { ru: '[ Выход ]', en: '[ Exit ]' },
  finish: { ru: 'Завершить', en: 'Finish' },
  light: { ru: 'Свет:', en: 'Light:' },
  dark: { ru: 'Тьма:', en: 'Dark:' },
  lightTag: { ru: 'СВЕТ', en: 'LIGHT' },
  darkTag: { ru: 'ТЬМА', en: 'DARK' },
  echo: { ru: 'ЭХО', en: 'ECHO' },
  echoIn: { ru: 'Эхо через {n} хода', en: 'Echo in {n} moves' },
  echoInOne: { ru: 'Эхо через {n} хода', en: 'Echo in {n} move' },
  worldFlips: { ru: 'перевороты мира: {n}/3', en: 'world flips: {n}/3' },
  // --- Игра: тосты ---
  tCanGo: { ru: '50/50. Ты можешь идти дальше.', en: '50/50. You can go on.' },
  tTier: { ru: '{l}/{d} — {name}!', en: '{l}/{d} — {name}!' },
  tDailyNeed: { ru: 'Задача дня: нужно ровно {t}/{t}', en: 'Daily task: exactly {t}/{t} needed' },
  tCanFinish: { ru: 'Завершить можно при равенстве 50/50 и выше', en: 'You can finish at 50/50 or higher' },
  tWait: { ru: 'Подожди...', en: 'Wait...' },
  tFlip: { ru: 'Переворот мира ({n}/3)', en: 'World flip ({n}/3)' },
  // Названия планок (были в gameConfig.progressNames)
  tier0: { ru: 'Победа', en: 'Victory' },
  tier1: { ru: 'Серебро', en: 'Silver' },
  tier2: { ru: 'Золото', en: 'Gold' },
  tier3: { ru: 'Платина', en: 'Platinum' },
  tier4: { ru: 'Идеал', en: 'Perfect' },
  // --- Экраны победы/поражения ---
  vWhole: { ru: '{r} / {r}. Обе стороны — целое.', en: '{r} / {r}. Both sides are whole.' },
  vBest: { ru: '{t}. Рекорд: {b}', en: '{t}. Best: {b}' },
  vAgain: { ru: '[ Играть снова ]', en: '[ Play again ]' },
  oTired: { ru: 'Три переворота. Мир устал.', en: 'Three flips. The world is tired.' },
  oScore: { ru: 'Партия: {r}. Рекорд: {b}', en: 'Game: {r}. Best: {b}' },
  oAgain: { ru: '[ Попробовать снова ]', en: '[ Try again ]' },
  // --- Рейтинг ---
  ratingTitle: { ru: 'ОБЩИЙ РЕЙТИНГ', en: 'OVERALL RATING' },
  you: { ru: 'Вы', en: 'You' },
  anon: { ru: 'Аноним', en: 'Anonymous' },
  // --- Как играть ---
  howTitle: { ru: 'Как играть', en: 'How to play' },
  how1a: { ru: '1. Клик — выбор. Второй клик по нему — переворот.', en: '1. Click to select. Second click on it flips it.' },
  how1b: { ru: '   Клик по соседу — обмен с переворотом.', en: '   Click a neighbor to swap and flip.' },
  how2: { ru: '2. Собирай линии 3+ одного цвета и одной стороны.', en: '2. Collect lines of 3+ of one color and one side.' },
  how3: { ru: '3. Свет и Тьма должны быть равны: 50/50 и выше.', en: '3. Light and Dark must be equal: 50/50 or higher.' },
  how4: { ru: '4. Равновесие восстанавливает время.', en: '4. Balance restores time.' },
  how5: { ru: '5. Эхо повторяет последний ход.', en: '5. Echo repeats the last move.' },
  how7: {
    ru: 'Серия наград открывает камни: {s} дней — Каменные, {m} — Мистические. Пропуск гасит звёзды.',
    en: 'Reward streak unlocks stones: {s} days — Stone, {m} — Mystic. Missing a day resets the stars.',
  },
  colClassic: { ru: 'КЛАССИЧЕСКИЙ', en: 'CLASSIC' },
  colStone: { ru: 'КАМЕННЫЕ', en: 'STONE' },
  colMystic: { ru: 'МИСТИЧЕСКИЙ', en: 'MYSTIC' },
  // --- Настройки ---
  setTitle: { ru: 'НАСТРОЙКИ', en: 'SETTINGS' },
  setSound: { ru: '[ Звук: {v} ]', en: '[ Sound: {v} ]' },
  on: { ru: 'вкл', en: 'on' },
  off: { ru: 'выкл', en: 'off' },
  setLabels: { ru: '[ Подписи: {v} ]', en: '[ Labels: {v} ]' },
  setStones: { ru: '[ Камни: {name} ]', en: '[ Stones: {name} ]' },
  setDiff: { ru: '[ Сложность: {t} ]', en: '[ Difficulty: {t} ]' },
  setLang: { ru: '[ Язык: {l} ]', en: '[ Language: {l} ]' },
  skinClassic: { ru: 'Классические', en: 'Classic' },
  skinMystic: { ru: 'Мистические', en: 'Mystic' },
  skinStone: { ru: 'Каменные', en: 'Stone' },
  skinHintStone: { ru: 'Каменные — серия {need} (у тебя {have})', en: 'Stone — {need}-day streak (you have {have})' },
  skinHintMystic: { ru: 'Мистические — серия {need} (у тебя {have})', en: 'Mystic — {need}-day streak (you have {have})' },
  skinHintAll: { ru: 'Все камни открыты', en: 'All stones unlocked' },
};

export function t(key: string, vars?: Vars): string {
  const row = STR[key];
  const lang = currentLang();
  let s = row ? (lang === 'en' ? row.en : row.ru) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v)); // все вхождения, не только первое
    }
  }
  return s;
}

// Название сета камней на текущем языке (замена storage.skinTitle)
export function skinName(s: 'classic' | 'mystic' | 'stone'): string {
  return s === 'mystic' ? t('skinMystic') : s === 'stone' ? t('skinStone') : t('skinClassic');
}

// Слово «секунд» с правильным окончанием (таймер в игре)
export function secondWord(n: number): string {
  if (currentLang() === 'en') return Math.abs(Math.floor(n)) === 1 ? 'second' : 'seconds';
  const m = Math.abs(Math.floor(n)) % 100;
  const d = m % 10;
  if (m >= 11 && m <= 14) return 'секунд';
  if (d === 1) return 'секунда';
  if (d >= 2 && d <= 4) return 'секунды';
  return 'секунд';
}
