// ============================================================
// storage.ts — рекорды в localStorage (Этап 2, временное решение).
// На Этапе 4 заменим на cloud saves через SDK Yandex Games,
// функции loadBest/saveBest/incGames при этом НЕ изменятся.
// ============================================================
import { SAVE_KEYS } from './constants';

// Читать без падений (приватный режим, запрет cookies и т.п.)
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Тихо игнорируем: игра работает и без сохранений (гостевой режим)
  }
}

// Личный рекорд: максимальное достигнутое равенство (GDD 2.9)
export function loadBest(): number {  const v = parseInt(safeGet(SAVE_KEYS.BEST_SCORE) ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// Сохранить, только если побит рекорд. Возвращает новый рекорд.
export function saveBest(value: number): number {
  const best = Math.max(loadBest(), value);
  safeSet(SAVE_KEYS.BEST_SCORE, String(best));
  return best;
}

// Счётчик партий (GDD 2.9)
export function loadGames(): number {
  const v = parseInt(safeGet(SAVE_KEYS.GAMES_COUNT) ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function incGames(): number {
  const n = loadGames() + 1;
  safeSet(SAVE_KEYS.GAMES_COUNT, String(n));
  return n;
}

// Подписи «СВЕТ»/«ТЬМА» на камнях (пункт 2): вкл по умолчанию
const LABELS_KEY = 'tct_labels';
export function loadLabelsEnabled(): boolean {
  try {
    if (localStorage.getItem(LABELS_KEY) === 'off') return false;
  } catch {
    // Недоступно — считаем включёнными
  }
  return true;
}

export function setLabelsEnabled(on: boolean): void {
  try {
    localStorage.setItem(LABELS_KEY, on ? 'on' : 'off');
  } catch {
    // Тихо игнорируем
  }
}

// Скин камней: 'classic' — морф из 6 кадров, 'mystic' и 'stone' —
// мгновенная смена картинки. Применяется с новой партии.
const SKIN_KEY = 'tct_skin';

export type StoneSkin = 'classic' | 'mystic' | 'stone';

const SKINS: StoneSkin[] = ['classic', 'mystic', 'stone'];

export function loadSkin(): StoneSkin {
  try {
    const v = localStorage.getItem(SKIN_KEY);
    if (v === 'mystic' || v === 'stone') return v;
  } catch {
    // Недоступно — классика
  }
  return 'classic';
}

// Следующий скин по кругу (для тумблера настроек; сейчас крутит
// только открытые через skins.nextOpenSkin, оставлено про запас)
export function nextSkin(s: StoneSkin): StoneSkin {
  return SKINS[(SKINS.indexOf(s) + 1) % SKINS.length];
}

export function saveSkin(skin: StoneSkin): void {
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch {
    // Тихо игнорируем
  }
}

// Сложность: 'easy' — как было всегда, 'medium' и 'hard' — слабее бонус
// равновесия, на 'hard' время ещё и тикает в реальном времени.
// Значения бонусов — в data/difficulty.json. Применяется с новой партии.
const DIFF_KEY = 'tct_difficulty';

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

export function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    if (v === 'medium' || v === 'hard') return v;
  } catch {
    // Недоступно — лёгкая
  }
  return 'easy';
}

// Следующая сложность по кругу (для тумблера настроек)
export function nextDifficulty(d: Difficulty): Difficulty {
  return DIFFS[(DIFFS.indexOf(d) + 1) % DIFFS.length];
}

export function saveDifficulty(d: Difficulty): void {
  try {
    localStorage.setItem(DIFF_KEY, d);
  } catch {
    // Тихо игнорируем
  }
}
