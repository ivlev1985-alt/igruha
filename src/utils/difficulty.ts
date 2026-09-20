// ============================================================
// difficulty.ts — уровни сложности из data/difficulty.json.
// Бонус равновесия и тиканье времени на сложном читаются отсюда,
// а не из gameConfig: править баланс — одной строкой в JSON.
// С защитой от битого файла — подставляем значения по умолчанию
// (лёгкий 10 / средний 6 / сложный 6 + тиканье 10:1).
// ============================================================
import type { Difficulty } from './storage';
import { loadDifficulty } from './storage';
import { currentLang } from './lang';
import DIFF from '../data/difficulty.json';

interface LevelRaw {
  title?: unknown;
  titleEn?: unknown;
  bonus?: unknown;
  drainEverySec?: unknown;
  drainAmount?: unknown;
  howto?: unknown;
  howtoEn?: unknown;
}

const FALLBACK: Record<Difficulty, { title: string; titleEn: string; bonus: number; drainEverySec: number; drainAmount: number; howto: string; howtoEn: string }> = {
  easy: { title: 'Лёгкий', titleEn: 'Easy', bonus: 10, drainEverySec: 0, drainAmount: 0, howto: 'Лёгкий: равновесие даёт +10 сек.', howtoEn: 'Easy: balance gives +10 sec.' },
  medium: { title: 'Средний', titleEn: 'Medium', bonus: 6, drainEverySec: 0, drainAmount: 0, howto: 'Средний: равновесие даёт +6 сек.', howtoEn: 'Medium: balance gives +6 sec.' },
  hard: { title: 'Сложный', titleEn: 'Hard', bonus: 6, drainEverySec: 10, drainAmount: 1, howto: 'Сложный: равновесие +6 сек, а каждые 10 сек реального времени сгорает 1 сек.', howtoEn: 'Hard: balance gives +6 sec, but every 10 sec of real time burns 1 sec.' },
};

function rawLevel(d: Difficulty): LevelRaw {
  const lv = (DIFF as unknown as { levels?: Record<string, LevelRaw> }).levels;
  return (lv && lv[d]) || {};
}

function num(v: unknown, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fb;
}

// Бонус равновесия для ТЕКУЩЕЙ сложности (секунды игрового времени)
export function difficultyBonus(): number {
  const d = loadDifficulty();
  return num(rawLevel(d).bonus, FALLBACK[d].bonus);
}

// Тиканье на ТЕКУЩЕЙ сложности: null — нет (лёгкий/средний),
// иначе каждые everySec секунд реального времени снимать amount секунд
export function difficultyDrain(): { everySec: number; amount: number } | null {
  const d = loadDifficulty();
  const fb = FALLBACK[d];
  const everySec = num(rawLevel(d).drainEverySec, fb.drainEverySec);
  const amount = num(rawLevel(d).drainAmount, fb.drainAmount);
  if (everySec <= 0 || amount <= 0) return null;
  return { everySec, amount };
}

// Подпись переключателя в Настройках (на текущем языке)
export function difficultyTitle(d: Difficulty): string {
  const en = currentLang() === 'en';
  const raw = en ? rawLevel(d).titleEn : rawLevel(d).title;
  const fb = en ? FALLBACK[d].titleEn : FALLBACK[d].title;
  return typeof raw === 'string' && raw ? raw : fb;
}

// Короткие описания всех уровней для пункта 6 в «Как играть» (на текущем языке)
export function difficultyHowto(): string[] {
  const en = currentLang() === 'en';
  const order = (DIFF as unknown as { order?: unknown }).order;
  const list: Difficulty[] = Array.isArray(order)
    ? (order as unknown[]).filter((v): v is Difficulty => v === 'easy' || v === 'medium' || v === 'hard')
    : ['easy', 'medium', 'hard'];
  return list.map((d) => {
    const raw = en ? rawLevel(d).howtoEn : rawLevel(d).howto;
    const fb = en ? FALLBACK[d].howtoEn : FALLBACK[d].howto;
    return typeof raw === 'string' && raw ? raw : fb;
  });
}
