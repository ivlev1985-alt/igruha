// ============================================================
// rating.ts — строки рейтинга. Раньше здесь жили фиктивные имена
// «для атмосферы» — для релиза они УДАЛЕНЫ: имена берутся только
// с доски Яндекса (platform.getLeaderboard), локально — только
// своя строка. Подставных игроков больше нет.
// ============================================================
import { t } from './lang';

export interface RatingRow {
  name: string;
  score: number;
  isYou: boolean;
}

// Локальный ряд: только игрок (или пусто, если рекорда ещё нет)
export function localRating(bestRound: number): RatingRow[] {
  if (bestRound > 0) return [{ name: t('you'), score: bestRound, isYou: true }];
  return [];
}
