// ============================================================
// Achievements.ts — достижения из data/achievements.json (99 шт).
// Пункт 6: список и группы правятся в JSON без touching кода.
// metric — поле статистики, target — порог, group — раздел окна.
// tier = планка из stats.tiers (ключи — из gameConfig.progressTiers).
// ============================================================
import { SAVE_KEYS } from '../utils/constants';
import type { GameStats } from '../utils/stats';
import { currentLang } from '../utils/lang';
import LIST from '../data/achievements.json';

export interface AchievementDef {
  id: string;
  title: string;
  titleEn: string;
  group: string;
  groupEn: string;
  test: (s: GameStats) => boolean;
}

interface JsonItem {
  id: string;
  title: string;
  title_en?: string;
  group?: string;
  group_en?: string;
  metric: string;
  target: number;
}

// Проверка одной записи JSON против статистики
function makeTest(metric: string, target: number): (s: GameStats) => boolean {
  switch (metric) {
    case 'tier':
      return (s) => s.tiers[String(target)] === true;
    case 'games':
      return (s) => s.games >= target;
    case 'wins':
      return (s) => s.wins >= target;
    case 'bestStreak':
      return (s) => s.bestStreak >= target;
    case 'echoUses':
      return (s) => s.echoUses >= target;
    case 'dailyWins':
      return (s) => s.dailyWins >= target;
    case 'loginStreak':
      return (s) => s.loginStreak >= target;
    case 'linesCleared':
      return (s) => s.linesCleared >= target;
    case 'maxLine':
      return (s) => s.maxLine >= target;
    case 'rewardsClaimed':
      return (s) => s.rewardsClaimed >= target;
    case 'totalScore':
      return (s) => s.totalScore >= target;
    case 'bestRound':
      return (s) => s.bestRound >= target;
    default:
      return () => false; // неизвестная метрика — не открывается
  }
}

function loadList(): AchievementDef[] {
  const arr = (LIST as unknown as JsonItem[]).filter(
    (it) => it && typeof it.id === 'string' && typeof it.title === 'string',
  );
  return arr.map((it) => ({
    id: it.id,
    title: it.title,
    titleEn: typeof it.title_en === 'string' && it.title_en ? it.title_en : it.title,
    group: typeof it.group === 'string' && it.group ? it.group : 'Прочее',
    groupEn: typeof it.group_en === 'string' && it.group_en ? it.group_en : 'Other',
    test: makeTest(it.metric, Number(it.target) || 0),
  }));
}

// Название и группа на ТЕКУЩЕМ языке (для экранов)
export function achTitle(a: AchievementDef): string {
  return currentLang() === 'en' ? a.titleEn : a.title;
}

export function achGroup(a: AchievementDef): string {
  return currentLang() === 'en' ? a.groupEn : a.group;
}

export const ACHIEVEMENTS: AchievementDef[] = loadList();

export function loadUnlocked(): string[] {
  try {
    const raw = localStorage.getItem(SAVE_KEYS.ACH);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Сколько открыто из нынешнего списка (старые удалённые id не считаем)
export function countUnlocked(): number {
  const unlocked = new Set(loadUnlocked());
  let n = 0;
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) n++;
  }
  return n;
}

// Сверяет статистику со списком, сохраняет новые. Возвращает ID новичков.
// Заодно вычищает id, которых больше нет в списке.
export function syncAchievements(s: GameStats): string[] {
  const unlocked = new Set(loadUnlocked());
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id)) {
      try {
        if (a.test(s)) {
          unlocked.add(a.id);
          fresh.push(a.id);
        }
      } catch {
        // Битый тест не должен ронять игру
      }
    }
  }
  const known = [...unlocked].filter((id) => ACHIEVEMENTS.some((a) => a.id === id));
  try {
    localStorage.setItem(SAVE_KEYS.ACH, JSON.stringify(known));
  } catch {
    // Без сохранений — просто показываем
  }
  return fresh;
}
