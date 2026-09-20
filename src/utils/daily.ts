// ============================================================
// daily.ts — задача дня и ежедневные награды (Main_menu.md, зоны 4–5).
// Задача дня: фиксированный сид (один у всех), одна попытка в день.
// Награды: серия входов, 7 ячеек, сегодня +2 пропуска, 7-й день +5.
// Пропуски — задел под rewarded-рекламу (Этап 4), пока просто копятся.
// ============================================================
import { SAVE_KEYS } from './constants';
import { seedFromString } from './rng';
import { gameConfig } from '../config/gameConfig';
import { currentLang } from './lang';
import REWARDS from '../data/rewards.json';
import DAILY from '../data/daily.json';

// Настройки из JSON (пункт 3): правятся без touching кода.
// С защитой от битого файла — подставляем значения по умолчанию.
const WEEK: number[] = Array.isArray(REWARDS.week) && REWARDS.week.length > 0
  ? REWARDS.week.map((n) => Number(n) || 2)
  : [2, 2, 2, 2, 2, 2, 5];

const TEXTS = {
  streakTitle: typeof REWARDS.streakTitle === 'string' ? REWARDS.streakTitle : 'Серия: {n} дней',
  streakTitleEn: typeof (REWARDS as Record<string, unknown>).streakTitle_en === 'string' ? (REWARDS as unknown as { streakTitle_en: string }).streakTitle_en : 'Streak: {n} days',
  todayText: typeof REWARDS.todayText === 'string' ? REWARDS.todayText : 'Сегодня: +{amount} рекламных пропуска',
  todayTextEn: typeof (REWARDS as Record<string, unknown>).todayText_en === 'string' ? (REWARDS as unknown as { todayText_en: string }).todayText_en : 'Today: +{amount} ad passes',
  claim: typeof REWARDS.claim === 'string' ? REWARDS.claim : 'ЗАБРАТЬ',
  claimEn: typeof (REWARDS as Record<string, unknown>).claim_en === 'string' ? (REWARDS as unknown as { claim_en: string }).claim_en : 'CLAIM',
  claimed: typeof REWARDS.claimed === 'string' ? REWARDS.claimed : 'ЗАБРАНА',
  claimedEn: typeof (REWARDS as Record<string, unknown>).claimed_en === 'string' ? (REWARDS as unknown as { claimed_en: string }).claimed_en : 'CLAIMED',
};

const DAILY_TEXTS = {
  toast: typeof DAILY.toast === 'string' ? DAILY.toast : 'Задача дня',
  toastEn: typeof (DAILY as Record<string, unknown>).toast_en === 'string' ? (DAILY as unknown as { toast_en: string }).toast_en : 'Daily task',
};

// Строка дня «YYYY-MM-DD» по местному времени
export function dayStr(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Вчерашняя строка (для проверки непрерывности серии)
export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayStr(d);
}

// Сид задачи дня: одинаковый у всех игроков
export function dailySeed(): number {
  return seedFromString(dayStr());
}

// --- Задача дня: автогенерация (пункт 4) ---
// Сид из даты: задача одинаковая у всех. Цель — равенство target/target
// успеть до maxFlips-го переворота мира. Попыток в день — attempts.
export interface DailyTask {
  target: number; // какое равенство набрать
  maxFlips: number; // до какого переворота успеть (1..3)
  attempts: number; // попыток в день
}

// Сгенерировать задачу на день (чистая функция от даты)
export function getDailyTask(day = dayStr()): DailyTask {
  // Локальный сид: mulberry32 берём напрямую, без rng.ts-цикла
  let h = 2166136261;
  const src = `daily:${day}`;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  const rnd = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cfg = gameConfig.dailyTask;
  const target = cfg.minScore + Math.floor(rnd() * (cfg.maxScore - cfg.minScore + 1));
  const maxFlips = 1 + Math.floor(rnd() * 3); // до 1/2/3-го переворота
  const attempts = 1 + Math.floor(rnd() * cfg.maxAttempts); // 1..max
  return { target, maxFlips, attempts };
}

// Слова для «до N-го переворота» — из daily.json (на текущем языке)
function flipName(n: number): string {
  const en = currentLang() === 'en';
  const raw = en
    ? (DAILY as unknown as { flipWords_en?: unknown }).flipWords_en
    : DAILY.flipWords;
  const arr = Array.isArray(raw) ? raw : [];
  return typeof arr[n - 1] === 'string' && arr[n - 1]
    ? (arr[n - 1] as string)
    : en ? `flip ${n}` : `переворота ${n}`;
}

// Текст задачи для панели: «Набрать 80/80 до первого переворота мира.»
export function taskText(task: DailyTask): string {
  const en = currentLang() === 'en';
  const raw = en
    ? (DAILY as unknown as { taskTemplate_en?: unknown }).taskTemplate_en
    : DAILY.taskTemplate;
  const tpl = typeof raw === 'string' && raw
    ? raw
    : 'Набрать {t}/{t} до {flip}.';
  return tpl.replace('{t}', String(task.target)).replace('{t}', String(task.target)).replace('{flip}', flipName(task.maxFlips));
}

// «Попытки: 1/2»
export function attemptsText(used: number, total: number): string {
  const en = currentLang() === 'en';
  const raw = en
    ? (DAILY as unknown as { attemptsTemplate_en?: unknown }).attemptsTemplate_en
    : DAILY.attemptsTemplate;
  const tpl = typeof raw === 'string' && raw
    ? raw
    : 'Попытки: {used}/{total}.';
  return tpl.replace('{used}', String(used)).replace('{total}', String(total));
}

interface DailyState {
  day: string;
  task: DailyTask;
  attemptsUsed: number;
  won: boolean;
  score: number;
}

export function getDaily(): DailyState {
  const fresh = (): DailyState => ({
    day: dayStr(), task: getDailyTask(), attemptsUsed: 0, won: false, score: 0,
  });
  try {
    const raw = localStorage.getItem(SAVE_KEYS.DAILY);
    if (raw) {
      const s = JSON.parse(raw) as DailyState;
      // Тот же день и задача сходится — продолжаем
      if (s.day === dayStr() && s.task) return s;
    }
  } catch {
    // Игнорируем
  }
  return fresh();
}

function setDaily(s: DailyState): void {
  try {
    localStorage.setItem(SAVE_KEYS.DAILY, JSON.stringify(s));
  } catch {
    // Игнорируем
  }
}

// Попытка начата: тратится на входе (даже если сразу вышел)
export function playDaily(): void {
  const s = getDaily();
  s.attemptsUsed++;
  setDaily(s);
}

// Партия дня окончена (победа = взяли цель до лимита переворотов)
export function finishDaily(won: boolean, score: number): void {
  const s = getDaily();
  s.won = s.won || won;
  s.score = Math.max(s.score, score);
  setDaily(s);
}

// Можно ли играть задачу сегодня? (остались попытки и ещё не выиграна)
export function isDailyAvailable(): boolean {
  const s = getDaily();
  return !s.won && s.attemptsUsed < s.task.attempts;
}

// --- Награды: {lastClaim, streak} ---
interface RewardState {
  lastClaim: string; // день последнего забора («» — никогда)
  streak: number; // длина серии
}

function getReward(): RewardState {
  try {
    const raw = localStorage.getItem(SAVE_KEYS.REWARD);
    if (raw) return JSON.parse(raw) as RewardState;
  } catch {
    // Игнорируем
  }
  return { lastClaim: '', streak: 0 };
}

// Награда за день недели (1–7) — из rewards.json
export function rewardForDay(pos: number): number {
  const i = Math.min(WEEK.length, Math.max(1, pos)) - 1;
  return WEEK[i] ?? 2;
}

// Тексты наград и задачи дня — из JSON (пункт 3)
export function rewardTexts(): {
  streakTitle: (n: number) => string;
  today: (amount: number) => string;
  claim: string;
  claimed: string;
} {
  const en = currentLang() === 'en';
  return {
    streakTitle: (n) => (en ? TEXTS.streakTitleEn : TEXTS.streakTitle).replace('{n}', String(n)),
    today: (amount) => (en ? TEXTS.todayTextEn : TEXTS.todayText).replace('{amount}', String(amount)),
    claim: en ? TEXTS.claimEn : TEXTS.claim,
    claimed: en ? TEXTS.claimedEn : TEXTS.claimed,
  };
}

export function getDailyToast(): string {
  return currentLang() === 'en' ? DAILY_TEXTS.toastEn : DAILY_TEXTS.toast;
}

// Состояние полосы: позиция сегодня (1–N), забрана ли, длина серии,
// broken = день пропущен (при заборе серия сбросится на 1).
// Длина полосы — из rewards.json (сейчас 14 дней).
export function rewardStatus(): { pos: number; claimedToday: boolean; streak: number; broken: boolean } {
  const r = getReward();
  const today = dayStr();
  const claimedToday = r.lastClaim === today;
  const broken = !claimedToday && r.lastClaim !== '' && r.lastClaim !== yesterdayStr();
  const cycle = Math.max(1, WEEK.length);
  // Перспективная позиция: если вчера забирали — серия продолжается
  let pos: number;
  if (claimedToday) {
    pos = ((r.streak - 1) % cycle) + 1;
  } else if (r.lastClaim === yesterdayStr()) {
    pos = (r.streak % cycle) + 1;
  } else if (r.lastClaim === '') {
    pos = 1;
  } else {
    pos = 1; // пропуск дня — серия сбросится при заборе
  }
  return { pos, claimedToday, streak: r.streak, broken };
}

// Сколько дней в полосе наград (для отрисовки сетки)
export function getRewardDays(): number {
  return Math.max(1, WEEK.length);
}

function getPasses(): number {
  try {
    return parseInt(localStorage.getItem(SAVE_KEYS.PASSES) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

// Забрать награду дня. Возвращает позицию и сколько пропусков дали.
export function claimReward(): { pos: number; amount: number; passes: number } {
  const today = dayStr();
  const r = getReward();
  let streak: number;
  if (r.lastClaim === yesterdayStr()) {
    streak = r.streak + 1; // серия продолжается
  } else if (r.lastClaim === today) {
    streak = r.streak; // повторный забор невозможен, но не роняем
  } else {
    streak = 1; // первый раз или пропуск — заново
  }
  const pos = ((streak - 1) % Math.max(1, WEEK.length)) + 1;
  const amount = rewardForDay(pos);
  const passes = getPasses() + amount;
  try {
    localStorage.setItem(SAVE_KEYS.REWARD, JSON.stringify({ lastClaim: today, streak }));
    localStorage.setItem(SAVE_KEYS.PASSES, String(passes));
  } catch {
    // Игнорируем
  }
  return { pos, amount, passes };
}
