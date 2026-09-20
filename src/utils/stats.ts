// ============================================================
// stats.ts — общая статистика партии и профиля (Main_menu.md 3.2.12).
// Один JSON в localStorage. На Этапе 4 переедет в облако без смены
// интерфейса: loadStats/recordGame/... останутся теми же.
// Победа = достигнуто равенство 50/50 и выше (bestSession >= 50),
// даже если потом партию проиграли на продолжении.
// ============================================================
import { SAVE_KEYS } from './constants';
import { gameConfig } from '../config/gameConfig';

// Пороговые планки — из gameConfig (ключи строкой для JSON)
const TIER_KEYS = gameConfig.progressTiers.map(String);

export interface GameStats {
  games: number; // всего партий, кроме задачи дня (выходы и поражения тоже считаются)
  wins: number; // побед (равенство 50/50+ хоть раз за партию)
  bestRound: number; // лучший раунд (макс. равенство)
  totalScore: number; // сумма рекордов всех партий
  winStreak: number; // текущая серия побед
  bestStreak: number; // лучшая серия побед
  tiers: Record<string, boolean>; // какие планки брали
  echoUses: number; // всего использовано эхо
  linesCleared: number; // всего линий собрано
  maxLine: number; // самая длинная линия
  dailyWins: number; // пройденных задач дня
  dailyPlayed: number; // сыгранных задач дня
  loginStreak: number; // серия входов подряд (дней)
  lastLoginDay: string; // последний день входа (YYYY-MM-DD)
  rewardsClaimed: number; // забрано ежедневных наград
}

function defaults(): GameStats {
  const tiers: Record<string, boolean> = {};
  for (const t of TIER_KEYS) tiers[t] = false;
  return {
    games: 0, wins: 0, bestRound: 0, totalScore: 0,
    winStreak: 0, bestStreak: 0, tiers,
    echoUses: 0, linesCleared: 0, maxLine: 0,
    dailyWins: 0, dailyPlayed: 0,
    loginStreak: 0, lastLoginDay: '',
    rewardsClaimed: 0,
  };
}

export function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem(SAVE_KEYS.STATS);
    if (!raw) return defaults();
    const parsed = { ...defaults(), ...(JSON.parse(raw) as Partial<GameStats>) };
    // Чиним tiers, если формат старый
    for (const t of TIER_KEYS) {
      if (typeof parsed.tiers[t] !== 'boolean') parsed.tiers[t] = false;
    }
    return parsed;
  } catch {
    return defaults();
  }
}

function save(s: GameStats): void {
  try {
    localStorage.setItem(SAVE_KEYS.STATS, JSON.stringify(s));
  } catch {
    // Гостевой режим без сохранений — игра продолжается
  }
}

// Итог обычной партии: сюда попадают все концовки —
// «Завершить», поражение на переворотах и выход через «Выход».
export function recordGame(r: {
  record: number; // лучшее равенство партии
  lines: number; // линий собрано
  maxLine: number; // самая длинная линия
  echoUses: number; // эхо использовано
}): GameStats {
  const s = loadStats();
  const won = r.record >= gameConfig.victoryMin;
  s.games++;
  if (won) {
    s.wins++;
    s.winStreak++;
    s.bestStreak = Math.max(s.bestStreak, s.winStreak);
  } else {
    s.winStreak = 0;
  }
  s.bestRound = Math.max(s.bestRound, r.record);
  s.totalScore += r.record;
  for (const t of TIER_KEYS) {
    if (r.record >= parseInt(t, 10)) s.tiers[t] = true;
  }
  s.echoUses += r.echoUses;
  s.linesCleared += r.lines;
  s.maxLine = Math.max(s.maxLine, r.maxLine);
  save(s);
  return s;
}

// Итог задачи дня (отдельно от обычных партий)
export function recordDaily(won: boolean): GameStats {
  const s = loadStats();
  s.dailyPlayed++;
  if (won) s.dailyWins++;
  save(s);
  return s;
}

// Серия входов: вызывать при открытии меню
export function touchLogin(today: string, yesterday: string): number {
  const s = loadStats();
  if (s.lastLoginDay === today) return s.loginStreak;
  if (s.lastLoginDay === yesterday) {
    s.loginStreak++;
  } else {
    s.loginStreak = 1; // первый вход или пропуск дня
  }
  s.lastLoginDay = today;
  save(s);
  return s.loginStreak;
}

// Забрана ежедневная награда
export function addRewardClaim(): void {
  const s = loadStats();
  s.rewardsClaimed++;
  save(s);
}
