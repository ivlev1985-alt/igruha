// ============================================================
// constants.ts — строковые ключи: сцены, ассеты, языки.
// Числа баланса — НЕ здесь, они в gameConfig.ts.
// ============================================================

// Ключи сцен Phaser (должны совпадать с именами в main.ts)
export const SCENES = {
  PRELOADER: 'Preloader',
  MAIN_MENU: 'MainMenu',
  GAME: 'GameScene',
  UI: 'UIScene',
  VICTORY: 'VictoryScene',
  GAME_OVER: 'GameOverScene',
  HOW_TO: 'HowToScene',
  SETTINGS: 'SettingsScene',
  ACHIEVEMENTS: 'AchievementsScene',
  RATING: 'RatingScene',
} as const;

// Цвета камней (три цвета, GDD 4.1)
export const GEM_COLORS = {
  RED: 'red',
  WHITE: 'white',
  BLACK: 'black',
} as const;
export type GemColor = (typeof GEM_COLORS)[keyof typeof GEM_COLORS];

// Стороны камня: лицо / изнанка (GDD 2.1)
export const GEM_SIDES = {
  FACE: 'face', // лицо — работает на Свет
  BACK: 'back', // изнанка — работает на Тьму
} as const;
export type GemSide = (typeof GEM_SIDES)[keyof typeof GEM_SIDES];

// Ключи ассетов (Этап 4 подставит сюда реальные спрайты/звуки)
export const ASSETS = {
  // Пусто на Этапе 0: рисуем всё через Graphics API
} as const;

// Ключи сохранений (сейчас localStorage, на Этапе 4 — cloud saves)
export const SAVE_KEYS = {
  BEST_SCORE: 'tct_best', // личный рекорд (макс. равенство)
  GAMES_COUNT: 'tct_games', // количество партий
  BEST_TIME: 'tct_best_time', // лучшее время (задел)
  STATS: 'tct_stats', // общая статистика (для рекордов и достижений)
  ACH: 'tct_ach', // открытые достижения
  DAILY: 'tct_daily', // задача дня
  REWARD: 'tct_reward', // серия ежедневных наград
  PASSES: 'tct_passes', // рекламные пропуски (задел под rewarded-рекламу)
} as const;

// Поддерживаемые языки (GDD 5.5)
export const LANGS = {
  RU: 'ru',
  EN: 'en',
} as const;
