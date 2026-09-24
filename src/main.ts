// ============================================================
// main.ts — точка входа. Создаёт игру Phaser, подключает сцены.
// Больше ничего здесь нет: вся логика — в сценах и системах.
// ============================================================
import Phaser from 'phaser';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { VictoryScene } from './scenes/VictoryScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HowToScene } from './scenes/HowToScene';
import { SettingsScene } from './scenes/SettingsScene';
import { AchievementsScene } from './scenes/AchievementsScene';
import { RatingScene } from './scenes/RatingScene';
import { currentLang } from './utils/lang';
import { initPlatform } from './utils/platform';
import { SoundSystem } from './systems/SoundSystem';

// Базовая конфигурация Phaser.
// Scale.FIT + фиксированная сцена: координаты и размеры элементов
// ОДИНАКОВЫ на любом мониторе (ноутбук, 4К) — меняется только общий
// масштаб картинки. Чёрные поля по бокам сливаются с фоном.
// Дизайн ВСЕГДА портретный 810x1440 (решение: альбомная вёрстка
// налезала друг на друга). На широких экранах игра стоит узкой
// колонкой по центру — чёрные поля по бокам сливаются с фоном.
const LAND_W = 1440;
const LAND_H = 810;

// Стартовый размер — портретный всегда, без проверки ориентации.
// Повороты ничего не меняют (дизайн один), поэтому applyOrientation убран.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL, с откатом на Canvas
  parent: 'game', // div из index.html
  backgroundColor: '#000000', // чёрный фон (GDD 4.1)
  scale: {
    mode: Phaser.Scale.FIT, // вписать сцену целиком, без деформации
    autoCenter: Phaser.Scale.CENTER_BOTH, // поля по бокам — чёрные
    width: LAND_H,
    height: LAND_W,
  },
  scene: [Preloader, MainMenu, HowToScene, SettingsScene, AchievementsScene, RatingScene, GameScene, UIScene, VictoryScene, GameOverScene],
  disableContextMenu: true, // долгое нажатие не вызывает меню (требование Yandex)
};

// Создаём игру
const game = new Phaser.Game(config);

// Площадка определяется сама (Яндекс при живом SDK, иначе локально).
// Не ждём: игра стартует сразу, апгрейд бэкенда догонит.
// Если SDK-язык сменил стартовый уже после построения меню —
// перестраиваем меню один раз (требование 2.14: язык на старте).
void initPlatform().then((res) => {
  try {
    if (res && res.langChanged && game.scene.isActive('MainMenu')) {
      game.scene.getScene('MainMenu').scene.restart();
    }
  } catch {
    // Тихо игнорируем
  }
});

// Звук: пробуем фоновую музыку (до первого жеста браузер запрещает —
// дальше договоримся по pointerdown внутри SoundSystem.boot).
SoundSystem.boot();

// Язык страницы — текущий язык игры (для скринридеров и поисковиков)
try {
  document.documentElement.lang = currentLang();
} catch {
  // Не браузер — пропускаем
}
