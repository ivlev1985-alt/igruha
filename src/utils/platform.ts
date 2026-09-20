// ============================================================
// platform.ts — изоляция площадки (Yandex / локально / будущие).
// Правило: игра вызывает ТОЛЬКО этот модуль, никогда YaGames
// напрямую. На Яндексе работает SDK, везде иначе (GitHub Pages,
// другие площадки, локальный тест) — тихий локальный режим.
// Поэтому SDK Яндекса НЕ помешает другим площадкам: для каждой
// следующей добавится свой адаптер, игра не меняется.
// ============================================================
import { t } from './lang';
import { localRating, type RatingRow } from './rating';

// Имя доски в консоли разработчика Яндекса (создать вручную!):
// shortName доски с лучшим раундом. Без доски в консоли методы
// лидерборда тихо откатываются на локальный ряд.
const LB_BEST = 'best_round';
// Пауза между полноэкранными (мс): чаще не показываем, чтобы не злить
const AD_INTERVAL_MS = 3 * 60 * 1000;
// Кэш лидерборда (мс): не дёргаем сеть при каждом открытии меню
const LB_CACHE_MS = 60 * 1000;

let lastAdvAt = 0;
// Партия только что кончилась (ставит GameScene, гасит MainMenu):
// следующий показ меню — естественная пауза для полноэкранной
let gameEndedPending = false;

export function notifyGameEnded(): void {
  gameEndedPending = true;
}

export function consumeGameEnded(): boolean {
  const v = gameEndedPending;
  gameEndedPending = false;
  return v;
}

// Минимум, который нужен игре от любой площадки
export interface Platform {
  readonly backend: 'yandex' | 'local';
  // Имя игрока для будущих лидербордов (гость — «Вы»/«You»)
  playerName(): string;
  // Загрузка закончена, можно убирать спиннер площадки
  ready(): void;
  // Активная партия началась/закончилась (пауза, фон, реклама)
  gameStart(): void;
  gameStop(): void;
  // Полноэкранная реклама; onClose — ВСЕГДА вызывается (нет рекламы — сразу)
  showFullscreenAdv(onClose: () => void): void;
  // То же, но не чаще паузы (для естественных перерывов)
  showFullscreenAdvThrottled(onClose: () => void): void;
  // Топ доски + строка игрока (фолбэк — локальный ряд)
  getLeaderboard(localBest: number): Promise<RatingRow[]>;
  // Записать рекорд на доску (тихо, без ожидания)
  submitScore(score: number): void;
}

// --- Локальный режим: всё тихо, игра как сейчас ---
class LocalPlatform implements Platform {
  readonly backend = 'local' as const;

  playerName(): string {
    return t('you');
  }

  ready(): void {
    // Нечего уведомлять
  }

  gameStart(): void {
    // Нечего уведомлять
  }

  gameStop(): void {
    // Нечего уведомлять
  }

  showFullscreenAdv(onClose: () => void): void {
    onClose(); // рекламы нет — продолжаем сразу
  }

  showFullscreenAdvThrottled(onClose: () => void): void {
    onClose(); // локально throttling не нужен
  }

  async getLeaderboard(localBest: number): Promise<RatingRow[]> {
    return localRating(localBest);
  }

  submitScore(): void {
    // Некуда писать — только локальный рекорд
  }
}

// Минимальные типы SDK (полный пакет не тянем, guard на каждом шаге)
interface YaAdv {
  showFullscreenAdv(options: { callbacks?: { onClose?: () => void; onError?: () => void } }): void;
}

interface YaFeatures {
  LoadingAPI?: { ready(): void };
  GameplayAPI?: { start(): void; stop(): void };
}

interface YaPlayer {
  getName(): string;
  getUniqueID?(): string;
}

interface YaEntryPlayer {
  uniqueID?: string;
  publicName?: string;
}

interface YaEntry {
  score?: number;
  player?: YaEntryPlayer;
}

interface YaEntries {
  entries?: YaEntry[];
}

interface YaLeaderboards {
  getLeaderboardEntries(name: string, options?: { quantityTop?: number; includeUser?: boolean }): Promise<YaEntries>;
  setLeaderboardScore(name: string, score: number): unknown;
}

interface YaGamesSDK {
  features?: YaFeatures;
  adv?: YaAdv;
  getPlayer(options?: { scopes?: boolean }): Promise<YaPlayer>;
  getLeaderboards(): Promise<YaLeaderboards>;
}

// Промис с таймаутом: висящая сеть превращается в null
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let done = false;
    const finish = (v: T | null): void => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    const timer = setTimeout(() => finish(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        finish(v);
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
    );
  });
}
// --- Яндекс: обёртки с защитой (SDK может отсутствовать/упасть) ---
class YandexPlatform implements Platform {
  readonly backend = 'yandex' as const;
  private name = '';
  private uid = '';
  private lbCache: { at: number; rows: RatingRow[] } | null = null;

  constructor(private ysdk: YaGamesSDK) {
    // Имя и id подтянутся сами; пока нет — гость
    try {
      this.ysdk.getPlayer().then(
        (p) => {
          try {
            const n = p.getName();
            if (n) this.name = n;
            const id = typeof p.getUniqueID === 'function' ? p.getUniqueID() : '';
            if (id) this.uid = id;
          } catch {
            // Молча остаёмся гостем
          }
        },
        () => {
          // Не авторизован — гость
        },
      );
    } catch {
      // Молча остаёмся гостем
    }
  }

  playerName(): string {
    return this.name || t('you');
  }

  // Вызов SDK: ловим и синхронные броски, и асинхронные отказы
  // (вне iframe Яндекса методы могут вернуть падающий промис)
  private call(fn: () => unknown): void {
    try {
      const r = fn();
      if (r instanceof Promise) {
        r.catch(() => {
          // Тихо игнорируем
        });
      }
    } catch {
      // Тихо игнорируем
    }
  }

  ready(): void {
    this.call(() => this.ysdk.features?.LoadingAPI?.ready());
  }

  gameStart(): void {
    this.call(() => this.ysdk.features?.GameplayAPI?.start());
  }

  gameStop(): void {
    this.call(() => this.ysdk.features?.GameplayAPI?.stop());
  }

  showFullscreenAdv(onClose: () => void): void {
    const done = (): void => {
      try {
        onClose();
      } catch {
        // Колбэк игры не должен ронять площадку
      }
    };
    try {
      if (!this.ysdk.adv) {
        done();
        return;
      }
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: done,
          onError: done,
        },
      });
    } catch {
      done();
    }
  }

  // Реклама не чаще паузы (меню после партии — естественный перерыв)
  showFullscreenAdvThrottled(onClose: () => void): void {
    try {
      const now = Date.now();
      if (now - lastAdvAt < AD_INTERVAL_MS) {
        onClose();
        return;
      }
      lastAdvAt = now;
    } catch {
      // Часы недоступны — показываем как есть
    }
    this.showFullscreenAdv(onClose);
  }

  // Топ-10 доски + строка игрока (доски нет в консоли — локальный ряд)
  async getLeaderboard(localBest: number): Promise<RatingRow[]> {
    try {
      const now = Date.now();
      if (this.lbCache && now - this.lbCache.at < LB_CACHE_MS) {
        return this.withUserRow(this.lbCache.rows, localBest);
      }
      const lbs = await withTimeout(this.ysdk.getLeaderboards(), 4000);
      if (!lbs) return localRating(localBest);
      const res = await withTimeout(
        lbs.getLeaderboardEntries(LB_BEST, { quantityTop: 10, includeUser: true }),
        4000,
      );
      const rows: RatingRow[] = (res?.entries ?? []).map((e) => ({
        name: e.player?.publicName || t('anon'),
        score: typeof e.score === 'number' ? e.score : 0,
        isYou: !!e.player?.uniqueID && e.player.uniqueID === this.uid,
      }));
      rows.sort((a, b) => b.score - a.score);
      this.lbCache = { at: now, rows };
      return this.withUserRow(rows, localBest);
    } catch {
      return localRating(localBest);
    }
  }

  // Своя строка поверх кэша: игрок всегда видит себя, даже вне топа
  private withUserRow(rows: RatingRow[], localBest: number): RatingRow[] {
    if (localBest > 0 && !rows.some((r) => r.isYou)) {
      const out = [...rows, { name: this.playerName(), score: localBest, isYou: true }];
      out.sort((a, b) => b.score - a.score);
      return out;
    }
    return rows;
  }

  // Рекорд на доску (тихо; доски нет — ничего не произойдёт)
  submitScore(score: number): void {
    if (!score || score <= 0) return;
    try {
      const p = this.ysdk.getLeaderboards();
      if (!p || typeof (p as Promise<YaLeaderboards>).then !== 'function') return;
      (p as Promise<YaLeaderboards>).then(
        (lb) => {
          try {
            const r = lb.setLeaderboardScore(LB_BEST, score);
            if (r instanceof Promise) r.catch(() => { /* тихо */ });
          } catch {
            // Тихо игнорируем
          }
        },
        () => {
          // Тихо игнорируем
        },
      );
    } catch {
      // Тихо игнорируем
    }
  }
}

// --- Синглтон: стартуем локально, при живом SDK переключаемся ---
let backend: Platform = new LocalPlatform();
let readyCalled = false;

export function getPlatform(): Platform {
  return backend;
}

// ready() до инициализации не теряется: запомнили — доставили при апгрейде
export function platformReady(): void {
  readyCalled = true;
  backend.ready();
}

// Инициализация SDK с таймаутом (офлайн/нет скрипта — остаёмся локально).
// Не блокирует игру: вызывается и забывается (void в main.ts).
export async function initPlatform(timeoutMs = 3500): Promise<void> {
  try {
    const w = window as unknown as { YaGames?: { init(): Promise<YaGamesSDK> } };
    if (!w.YaGames || typeof w.YaGames.init !== 'function') return;
    const ysdk = await new Promise<YaGamesSDK | null>((resolve) => {
      let done = false;
      const finish = (v: YaGamesSDK | null): void => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      try {
        w.YaGames!.init().then(
          (sdk) => {
            window.clearTimeout(timer);
            finish(sdk);
          },
          () => {
            window.clearTimeout(timer);
            finish(null);
          },
        );
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    });
    if (ysdk) {
      backend = new YandexPlatform(ysdk);
      if (readyCalled) backend.ready();
    }
  } catch {
    // Любой сбой — остаёмся в локальном режиме
  }
}
