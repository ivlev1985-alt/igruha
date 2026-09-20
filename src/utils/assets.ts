// ============================================================
// assets.ts — пункт 6: лёгкая замена графики без правки сцен.
// Правило: сцены и меню НЕ грузят картинки напрямую, а просят
// хелпер. Хелпер смотрит: есть ли путь в gameConfig.sprites и
// загрузилась ли текстура? Да — картинка. Нет — то же самое
// программно (Graphics). Добавление ассета = 1 файл + 1 строка.
// ============================================================
import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';
import { currentLang } from './lang';

// Ключи текстур = ключи gameConfig.sprites (Preloader грузит по ним).
// Камни — фиксированные имена gem_цвет_сторона (см. пункт 8).
// Атлас морфа — gems_all.png + gems_all.json (18 кадров).
export const TEX = {
  MENU_BG: 'menu_bg',
  LOADING: 'mm_loading', // заставка загрузки (показывается по центру)
  LOADING_EN: 'mm_loading_en', // заставка-английская
  MENU_DIVIDER: 'menu_divider',
  GAME_BG: 'game_bg',
  SHEET: 'gems_all',
  MYSTIC: 'gems_mystic', // сейчас: gems_all_v2.png (v1-файлы лежат без дела)
  STONE: 'gems_stone', // каменные: gems_all_v3.png
  // Арт меню (папка background) — виден при наличии файлов
  MM_BG: 'mm_bg',
  MM_TITLE_L: 'mm_title_l',
  MM_TITLE_R: 'mm_title_r',
  MM_TASK_BG: 'mm_task_bg',
  MM_STRIP: 'mm_strip',
  MM_SEP: 'mm_sep',
  MM_EMBLEM: 'mm_emblem',
  MM_EMBLEM_1: 'mm_emblem_1',
  MM_LINE: 'mm_line',
  MM_ADVICE: 'mm_advice',
  MM_ADVICE_EN: 'mm_advice_en', // совет с английским текстом
  MM_TITLE: 'mm_title',
  MM_TITLE_EN: 'mm_title_en', // логотип с английским названием
  UI_ECHO: 'ui_echo',
  UI_ECHO_EN: 'ui_echo_en', // кнопка эха с английским текстом
  MM_STAR: 'mm_star', // звезда серии наград
} as const;

// Имена файлов камней: gem_red_face.png и т.д.
export const GEM_COLORS_SPRITE = ['red', 'white', 'black'] as const;
export const GEM_SIDES_SPRITE = ['face', 'back'] as const;

// Фон сцены: чёрный прямоугольник + картинка.
// anchor 'center' — cover по центру (меню), 'top' — полоса фиксированной
// ширины, прибитая к верху (фон игры, пункт 3).
export function addBackground(
  scene: Phaser.Scene, key: string = TEX.MENU_BG, anchor: 'center' | 'top' = 'center',
): Phaser.GameObjects.GameObject {
  const w = scene.scale.width;
  const h = scene.scale.height;
  if (gameConfig.useSprites && scene.textures.exists(key)) {
    const img = scene.add.image(w / 2, h / 2, key);
    if (anchor === 'top') {
      // Пункт 3: ширина полосы контента, верх страницы, высота по пропорциям
      const bw = Math.min(w, gameConfig.contentMaxWidth);
      img.setDisplaySize(bw / 1.3, ((bw * img.height) / img.width) / 1.3);
      img.setPosition(w / 1.975, img.displayHeight / 2);
    } else {
      const s = Math.max(w / img.width, h / img.height); // cover без деформации
      img.setScale(s);
    }
    img.setDepth(-100);
    return img;
  }
  const rect = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000);
  rect.setDepth(-100);
  return rect;
}

// Разделитель под заголовком меню: красная полоса / картинка.
// Возвращает объект — можно анимировать (пульс) как раньше.
export function addDivider(
  scene: Phaser.Scene, x: number, y: number, wdt: number,
): Phaser.GameObjects.GameObject {
  if (gameConfig.useSprites && scene.textures.exists(TEX.MENU_DIVIDER)) {
    const img = scene.add.image(x, y, TEX.MENU_DIVIDER);
    img.setDisplaySize(wdt, 3);
    return img;
  }
  return scene.add.rectangle(x, y, wdt, 3, gameConfig.colors.red);
}

// Есть ли вообще внешние картинки? (для отладки и будущих экранов)
export function hasSprite(scene: Phaser.Scene, key: string): boolean {
  return gameConfig.useSprites && scene.textures.exists(key);
}

// Картинка с надписями: в английской версии — _en-вариант.
// Использование: this.add.image(x, y, langTex(TEX.MM_TITLE, TEX.MM_TITLE_EN)).
export function langTex(ruKey: string, enKey: string): string {
  return currentLang() === 'en' ? enKey : ruKey;
}

// Прямоугольник верхнего баннера игры (game_background.png).
// Те же числа, что в addBackground(..., 'top'): ширина полосы,
// высота по пропорциям 906x356, прибит к верху, центр экрана.
export function gameBannerRect(scene: Phaser.Scene): { x: number; y: number; w: number; h: number } | null {
  if (!hasSprite(scene, TEX.GAME_BG)) return null;
  const fullW = scene.scale.width;
  const bw = Math.min(fullW, gameConfig.contentMaxWidth);
  const bh = (bw * 356) / 906;
  return { x: (fullW - bw) / 2, y: 0, w: bw, h: bh };
}

// Круг затмения на баннере (замерен по пикселям, доли от баннера).
// Таймер и пульс живут здесь.
export function eclipseGeom(scene: Phaser.Scene): { x: number; y: number; r: number } | null {
  const r = gameBannerRect(scene);
  if (!r) return null;
  return { x: r.x + r.w * 0.487, y: r.y + r.h * 0.413, r: r.w * 0.061 };
}

// Доступен ли атлас морфа камней?
export function sheetAvailable(scene: Phaser.Scene): boolean {
  return hasSprite(scene, TEX.SHEET);
}

// Есть ли конкретный кадр в атласе? (защита от битого JSON:
// без кадра игра откатится на одиночные картинки, а не на чёрный экран)
export function hasSheetFrame(scene: Phaser.Scene, color: string, frame: number): boolean {
  if (!sheetAvailable(scene)) return false;
  try {
    const tex = scene.textures.get(TEX.SHEET);
    const frames = (tex as unknown as { frames?: Record<string, unknown> }).frames;
    return !!frames && Object.prototype.hasOwnProperty.call(frames, sheetFrame(color, frame));
  } catch {
    return false;
  }
}

// Ряд атласа для цвета (индекс в gemSheetRows из конфига)
export function sheetRow(color: string): number {
  const i = (gameConfig.gemSheetRows as readonly string[]).indexOf(color);
  return i >= 0 ? i : 0;
}

// Имя кадра: цвет + номер (0 = лицо, 5 = изнанка)
export function sheetFrame(color: string, frame: number): string {
  return `${color}_${frame}`;
}

// Имя кадра мистического сета: m_цвет_сторона (без промежуточных)
export function mysticFrame(color: string, side: string): string {
  return `m_${color}_${side}`;
}

// Имя кадра каменного сета: s_цвет_сторона (без промежуточных)
export function stoneFrame(color: string, side: string): string {
  return `s_${color}_${side}`;
}

// Есть ли конкретный кадр в мистическом атласе?
export function hasMysticFrame(scene: Phaser.Scene, color: string, side: string): boolean {
  if (!hasSprite(scene, TEX.MYSTIC)) return false;
  try {
    const tex = scene.textures.get(TEX.MYSTIC);
    const frames = (tex as unknown as { frames?: Record<string, unknown> }).frames;
    return !!frames && Object.prototype.hasOwnProperty.call(frames, mysticFrame(color, side));
  } catch {
    return false;
  }
}

// Есть ли конкретный кадр в каменном атласе?
export function hasStoneFrame(scene: Phaser.Scene, color: string, side: string): boolean {
  if (!hasSprite(scene, TEX.STONE)) return false;
  try {
    const tex = scene.textures.get(TEX.STONE);
    const frames = (tex as unknown as { frames?: Record<string, unknown> }).frames;
    return !!frames && Object.prototype.hasOwnProperty.call(frames, stoneFrame(color, side));
  } catch {
    return false;
  }
}
