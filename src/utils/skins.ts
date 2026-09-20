// ============================================================
// skins.ts — разблокировка сетов камней за серию наград.
// Пороги серии и тестовые флаги — в data/skins.json.
// Прогресс открытий — в localStorage (пережил пропуск? нет:
// пропуск бьёт только по серии/звёздам, открытые сеты — навсегда).
// Звёзды ряда: по одной за каждый день непрерывной серии (макс 14);
// пропуск дня гасит ряд; после открытия Мистических ряд полный навсегда.
// ============================================================
import SKINS from '../data/skins.json';
import { loadSkin, saveSkin, type StoneSkin } from './storage';
import { rewardStatus } from './daily';

export type SkinId = 'stone' | 'mystic';

const FALLBACK_STREAK = 7;
const FALLBACK_MYSTIC_STREAK = 14;
const MAX_STARS = 14;

function num(v: unknown, fb: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fb;
}

// Серия, нужная для открытия сета (дней подряд)
export function unlockStreak(s: SkinId): number {
  const j = SKINS as unknown as Record<string, unknown>;
  return s === 'stone'
    ? num(j.stoneUnlockStreak, FALLBACK_STREAK)
    : num(j.mysticUnlockStreak, FALLBACK_MYSTIC_STREAK);
}

// Тестовый флаг из JSON (true = открыт сразу)
function jsonForced(s: SkinId): boolean {
  const j = SKINS as unknown as Record<string, unknown>;
  return s === 'stone' ? j.stoneUnlocked === true : j.mysticUnlocked === true;
}

const UNLOCK_KEY = 'tct_skin_unlocks';

function loadSaved(): Record<SkinId, boolean> {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Record<SkinId, boolean>>;
      return { stone: p.stone === true, mystic: p.mystic === true };
    }
  } catch {
    // Недоступно — считаем закрытыми
  }
  return { stone: false, mystic: false };
}

function saveSaved(v: Record<SkinId, boolean>): void {
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(v));
  } catch {
    // Тихо игнорируем
  }
}

// Открыт ли сет (сохранение или тестовый флаг)?
export function isSkinUnlocked(s: SkinId): boolean {
  return jsonForced(s) || loadSaved()[s];
}

// Открыть сет навсегда. Возвращает true, если открылся СЕЙЧАС
// (уже открытый, в т.ч. тестовым флагом, — false, тост не нужен).
export function unlockSkin(s: SkinId): boolean {
  if (isSkinUnlocked(s)) return false;
  const cur = loadSaved();
  cur[s] = true;
  saveSaved(cur);
  return true;
}

// Проверить серию после забора награды, открыть что положено.
// Возвращает вновь открытые сеты (для тоста).
export function checkSkinUnlocks(streak: number): SkinId[] {
  const out: SkinId[] = [];
  if (streak >= unlockStreak('stone') && unlockSkin('stone')) out.push('stone');
  if (streak >= unlockStreak('mystic') && unlockSkin('mystic')) out.push('mystic');
  return out;
}

// Сколько звёзд показать в ряду меню (0–14)
export function starCount(): number {
  if (isSkinUnlocked('mystic')) return MAX_STARS; // всё открыто — ряд полный навсегда
  const st = rewardStatus();
  if (st.broken) return 0; // пропуск дня — звёзды ушли обратно в ячейки
  return Math.min(st.streak, MAX_STARS);
}

export function maxStars(): number {
  return MAX_STARS;
}

// Реально играбельный скин: закрытый выбор откатывается на классику
// (бывает у старых сохранений, где тумблер был свободным).
export function effectiveSkin(): StoneSkin {
  const s = loadSkin();
  if (s === 'classic') return s;
  return isSkinUnlocked(s) ? s : 'classic';
}

// Следующий ОТКРЫТЫЙ скин по кругу (для тумблера настроек)
export function nextOpenSkin(): StoneSkin {
  const order: StoneSkin[] = ['classic', 'stone', 'mystic'];
  const open = order.filter((s) => s === 'classic' || isSkinUnlocked(s));
  return open[(open.indexOf(effectiveSkin()) + 1) % open.length];
}

export function setSkin(s: StoneSkin): void {
  saveSkin(s);
}
