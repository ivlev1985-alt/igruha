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
import { SoundSystem } from '../systems/SoundSystem';

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
  // Наградное видео: onRewarded — ТОЛЬКО если игрок досмотрел и заработал
  // (закрыл раньше времени — не вызывается). Нет рекламы — сразу награда (тест).
  showRewardedVideo(onRewarded: () => void): void;
  // Топ доски + строка игрока (фолбэк — локальный ряд)
  getLeaderboard(localBest: number): Promise<RatingRow[]>;
  // Записать рекорд на доску (тихо, без ожидания)
  submitScore(score: number): void;
  // Облачные сохранения: выгрузить локальные (с дебаунсом, тихо)
  saveCloud(): void;
  // Втянуть облачные, если новее локальных (true = применили)
  loadCloud(): Promise<boolean>;
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

  showRewardedVideo(onRewarded: () => void): void {
    try {
      onRewarded(); // локально рекламы нет — сразу награда (тестовый режим)
    } catch {
      // Тихо игнорируем
    }
  }

  async getLeaderboard(localBest: number): Promise<RatingRow[]> {
    return localRating(localBest);
  }

  submitScore(): void {
    // Некуда писать — только локальный рекорд
  }

  saveCloud(): void {
    // Локально сохранять нечего — всё уже в localStorage
  }

  async loadCloud(): Promise<boolean> {
    return false; // локально втягивать нечего
  }
}

// Минимальные типы SDK (полный пакет не тянем, guard на каждом шаге)
interface YaAdv {
  showFullscreenAdv(options: { callbacks?: { onClose?: () => void; onError?: () => void } }): void;
  showRewardedVideo(options: { callbacks?: { onRewarded?: () => void; onClose?: () => void; onError?: () => void } }): void;
}

interface YaFeatures {
  LoadingAPI?: { ready(): void };
  GameplayAPI?: { start(): void; stop(): void };
}

interface YaPlayer {
  getName(): string;
  getUniqueID?(): string;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>): Promise<void>;
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
  private playerP: Promise<YaPlayer> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private ysdk: YaGamesSDK) {
    // Игрок подтянется сам; пока нет — гость
    try {
      this.playerP = this.ysdk.getPlayer();
      this.playerP.then(
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
          this.playerP = null;
        },
      );
    } catch {
      // Молча остаёмся гостем
      this.playerP = null;
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
        SoundSystem.setMusicDucked(false); // вернуть музыку после рекламы
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
      SoundSystem.setMusicDucked(true); // музыка молчит под рекламой
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

  // Наградное видео за +1 попытку дня: награда только за досмотр.
  // Закрыл раньше или ошибка — onRewarded не зовём, попытка не даётся.
  // Музыка молчит под рекламой в любом исходе.
  showRewardedVideo(onRewarded: () => void): void {
    const grant = (): void => {
      try {
        onRewarded();
      } catch {
        // Колбэк игры не должен ронять площадку
      }
    };
    const unduck = (): void => {
      try {
        SoundSystem.setMusicDucked(false);
      } catch {
        // Тихо игнорируем
      }
    };
    try {
      if (!this.ysdk.adv || typeof this.ysdk.adv.showRewardedVideo !== 'function') {
        grant(); // тестовый режим без рекламы — сразу награда
        return;
      }
      SoundSystem.setMusicDucked(true);
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: grant,
          onClose: unduck,
          onError: unduck,
        },
      });
    } catch {
      unduck();
      grant();
    }
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

  // Ключи localStorage, уезжающие в облако. КОНТРАКТ: имена обязаны
  // совпадать с ключами в storage.ts / skins.ts / lang.ts / daily.ts.
  // Новый ключ сейва — добавить сюда, иначе он не синхронизируется.
  private cloudKeys(): string[] {
    return [
      'tct_best', // личный рекорд (storage.ts)
      'tct_games', // счётчик партий (storage.ts)
      'tct_stats', // общая статистика (stats.ts)
      'tct_ach', // открытые достижения (Achievements.ts)
      'tct_daily', // задача дня (daily.ts)
      'tct_reward', // серия наград (daily.ts)
      'tct_skin', // выбранный сет (storage.ts)
      'tct_skin_unlocks', // открытые сеты (skins.ts)
      'tct_lang', // язык (lang.ts)
      'tct_labels', // подписи на камнях (storage.ts)
      'tct_difficulty', // сложность (storage.ts)
      'tct_sound', // звук вкл/выкл (SoundSystem.ts)
    ];
  }

  private cloudTsKey(): string {
    return 'tct_cloud_ts'; // метка последней синхронизации (last-write-wins)
  }

  private readLocalTs(): number {
    try {
      return Number(localStorage.getItem(this.cloudTsKey())) || 0;
    } catch {
      return 0;
    }
  }

  // Выгрузить локальные сейвы в облако (с дебаунсом: дёргаем часто, шлём редко)
  saveCloud(): void {
    try {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        void this.pushCloud();
      }, 800);
    } catch {
      // Тихо игнорируем
    }
  }

  private async pushCloud(): Promise<void> {
    try {
      const player = this.playerP ? await withTimeout(this.playerP, 3500) : null;
      if (!player) return;
      const data: Record<string, unknown> = {};
      for (const k of this.cloudKeys()) {
        try {
          const v = localStorage.getItem(k);
          if (v !== null) data[k] = v;
        } catch {
          // Один битый ключ не роняет весь сейв
        }
      }
      const ts = Date.now();
      data.__ts = ts;
      await withTimeout(player.setData(data), 3500);
      try {
        localStorage.setItem(this.cloudTsKey(), String(ts));
      } catch {
        // Тихо игнорируем
      }
    } catch {
      // Тихо игнорируем
    }
  }

  // Втянуть облако, если оно новее локального. Вызывает Preloader до меню.
  async loadCloud(): Promise<boolean> {
    try {
      const player = this.playerP ? await withTimeout(this.playerP, 3500) : null;
      if (!player) return false;
      const data = await withTimeout(player.getData(), 3500);
      if (!data || typeof data !== 'object') return false;
      const remoteTs = Number((data as Record<string, unknown>).__ts) || 0;
      if (remoteTs <= this.readLocalTs()) return false; // локальное свежее — не трогаем
      let applied = false;
      for (const k of this.cloudKeys()) {
        const v = (data as Record<string, unknown>)[k];
        if (typeof v === 'string') {
          try {
            localStorage.setItem(k, v);
            applied = true;
          } catch {
            // Один битый ключ не роняет весь сейв
          }
        }
      }
      if (applied) {
        try {
          localStorage.setItem(this.cloudTsKey(), String(remoteTs));
        } catch {
          // Тихо игнорируем
        }
      }
      return applied;
    } catch {
      return false;
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

export interface InitResult {
  backend: 'yandex' | 'local';
}

let initPromise: Promise<InitResult> | null = null;

// Инициализация SDK с таймаутом (офлайн/нет скрипта — остаёмся локально).
// Не блокирует игру: вызывается и забывается (void в main.ts).
// ВАЖНО: вне iframe SDK присутствует, но неработоспособен (нет родителя
// для postMessage) — проверяем фрейм ПЕРВЫМ, иначе сломанный бэкенд
// убьёт награды/лидерборд и на GitHub Pages, и в локальном тесте.
function runningFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // кросс-доменный фрейм — считаем, что мы во фрейме
  }
}

export function initPlatform(timeoutMs = 3500): Promise<InitResult> {
  if (!initPromise) initPromise = doInit(timeoutMs);
  return initPromise;
}

// Дождаться инициализации (с потолком): Preloader ждёт облако до меню
export async function awaitPlatform(ms = 4000): Promise<void> {
  if (!initPromise) return;
  try {
    await Promise.race([
      initPromise,
      new Promise((res) => setTimeout(res, ms)),
    ]);
  } catch {
    // Тихо игнорируем
  }
}

async function doInit(timeoutMs: number): Promise<InitResult> {
  if (!runningFramed()) return { backend: 'local' }; // топ-левел: точно не Яндекс
  try {
    const w = window as unknown as { YaGames?: { init(): Promise<YaGamesSDK> } };
    if (!w.YaGames || typeof w.YaGames.init !== 'function') return { backend: 'local' };
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
      return { backend: 'yandex' };
    }
    return { backend: 'local' };
  } catch {
    // Любой сбой — остаёмся в локальном режиме
    return { backend: 'local' };
  }
}
