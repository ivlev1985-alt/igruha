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

// Базовая конфигурация Phaser.
// Scale.FIT + фиксированная сцена: координаты и размеры элементов
// ОДИНАКОВЫ на любом мониторе (ноутбук, 4К) — меняется только общий
// масштаб картинки. Чёрные поля по бокам сливаются с фоном.
// Ориентация: ландшафт 1280x720, портрет 720x1280 (см. ниже).
const LAND_W = 1440;
const LAND_H = 810;

// Стартовый размер — сразу по ориентации окна, иначе Preloader
// рисует в landscape-координатах и на портретном телефоне всё съезжает
// вправо до первого переворота. Повороты дальше ловит applyOrientation.
const portraitFirst = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL, с откатом на Canvas
  parent: 'game', // div из index.html
  backgroundColor: '#000000', // чёрный фон (GDD 4.1)
  scale: {
    mode: Phaser.Scale.FIT, // вписать сцену целиком, без деформации
    autoCenter: Phaser.Scale.CENTER_BOTH, // поля по бокам — чёрные
    width: portraitFirst ? LAND_H : LAND_W,
    height: portraitFirst ? LAND_W : LAND_H,
  },
  scene: [Preloader, MainMenu, HowToScene, SettingsScene, AchievementsScene, RatingScene, GameScene, UIScene, VictoryScene, GameOverScene],
  disableContextMenu: true, // долгое нажатие не вызывает меню (требование Yandex)
};

// Создаём игру
const game = new Phaser.Game(config);

// Площадка определяется сама (Яндекс при живом SDK, иначе локально).
// Не ждём: игра стартует сразу, апгрейд бэкенда догонит.
void initPlatform();

// Язык страницы — текущий язык игры (для скринридеров и поисковиков)
try {
  document.documentElement.lang = currentLang();
} catch {
  // Не браузер — пропускаем
}

// Ориентация: подбираем дизайн-размер под окно (и при переворотах).
// Сцены перестраиваются сами через resize (партия при этом НЕ теряется:
// логика поля живёт отдельно от отрисовки).
game.events.once(Phaser.Core.Events.READY, () => {
  const applyOrientation = (): void => {
    const portrait = window.innerWidth < window.innerHeight;
    const w = portrait ? LAND_H : LAND_W;
    const h = portrait ? LAND_W : LAND_H;
    const size = game.scale.gameSize;
    if (size.width !== w || size.height !== h) {
      game.scale.setGameSize(w, h);
    }
  };
  applyOrientation();
  game.scale.on('orientationchange', applyOrientation);
});
