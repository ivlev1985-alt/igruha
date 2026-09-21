// ============================================================
// Preloader — заставка загрузки: loading.png по центру экрана,
// под ней полоса ine_bottom.png постепенно открывается слева направо.
// Старых надписи и прямоугольников больше нет.
// Позиции — от текущего размера сцены + перестановка при ресайзе
// (старт уже в верной ориентации — см. main.ts portraitFirst).
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { GEM_COLORS_SPRITE, GEM_SIDES_SPRITE, TEX, langTex } from '../utils/assets';
import { awaitPlatform, getPlatform } from '../utils/platform';

export class Preloader extends Phaser.Scene {
  // Картинки появляются, когда их файлы реально приехали
  private art?: Phaser.GameObjects.Image;
  private bar?: Phaser.GameObjects.Image;
  // Запасной вариант без файлов: название + красная полоска
  private fallbackTitle?: Phaser.GameObjects.Text;
  private fallbackBar?: Phaser.GameObjects.Rectangle;
  private lastProgress = 0;

  constructor() {
    super(SCENES.PRELOADER);
  }

  preload(): void {
    // Все звуки из конфига. Нет файла — loaderror, игнорируем молча.
    this.load.on('loaderror', (f: { key?: string }) => {
      // Видимый варнинг: какая именно картинка/звук не загрузился
      console.warn(`[Preloader] нет файла для ключа: ${f?.key ?? '?'}`);
      // Заставка/полоса не приехали — рисуем запасной вариант
      if (f?.key === TEX.LOADING || f?.key === TEX.MM_LINE) this.showFallback();
    });
    for (const [name, path] of Object.entries(gameConfig.sounds)) {
      this.load.audio(`snd_${name}`, [path]);
    }

    // Арт меню (папка background): loading.png и ine_bottom.png идут
    // ПЕРВЫМИ (порядок ключей в gameConfig.menuArt) — показ по готовности.
    // Нет файла — loaderror с варнингом, меню рисуется программно.
    for (const [key, path] of Object.entries(gameConfig.menuArt)) {
      if (path) this.load.image(key, [path]);
    }
    // Картинки показываем, как только их файлы реально загрузились.
    // Заставка — на текущем языке (loading.png / loading_en.png).
    this.load.once(`filecomplete-image-${TEX.LOADING}`, () => this.showArt());
    this.load.once(`filecomplete-image-${TEX.LOADING_EN}`, () => this.showArt());
    this.load.once(`filecomplete-image-${TEX.MM_LINE}`, () => this.showBar());
    // Прогресс: полоса открывается слева направо (кроп текстуры)
    this.load.on('progress', (v: number) => this.paintProgress(v));

    // Спрайты из gameConfig.sprites (пункт 6): пустые пути пропускаем,
    // будет программная графика. Нет файла — loaderror, игнорируем.
    // Камни — фиксированные имена (пункт 8), только в спрайт-режиме.
    if (gameConfig.useSprites) {
      for (const [key, path] of Object.entries(gameConfig.sprites)) {
        if (path) this.load.image(key, [path]);
      }
      // Атлас морфа (приоритет) + одиночные картинки (запасной вариант).
      // Важно: пути атласа — СТРОКАМИ, не массивами: JSON-загрузчик
      // Phaser 3.90 падает на массиве (file.url.match is not a function)
      // и роняет весь Preloader в чёрный экран.
      this.load.atlas(TEX.SHEET, 'assets/sprites/gems/gems_all.png', 'assets/sprites/gems/gems_all.json');
      // Мистический сет (v2): мгновенная смена, без промежуточных кадров
      this.load.atlas(TEX.MYSTIC, 'assets/sprites/gems/gems_all_v2.png', 'assets/sprites/gems/gems_all_v2.json');
      // Каменный сет (v3): то же самое
      this.load.atlas(TEX.STONE, 'assets/sprites/gems/gems_all_v3.png', 'assets/sprites/gems/gems_all_v3.json');
      for (const c of GEM_COLORS_SPRITE) {
        for (const s of GEM_SIDES_SPRITE) {
          this.load.image(`gem_${c}_${s}`, [`assets/sprites/gems/gem_${c}_${s}.png`]);
        }
      }
    }

    // Переворот посреди загрузки — переставляем заставку и полосу
    this.scale.on('resize', this.layoutLoader, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layoutLoader, this);
    });
  }

  create(): void {
    // Сначала облако (если Яндекс и там новее), потом меню.
    // Всё с потолками: меню стартует в любом случае.
    awaitPlatform()
      .then(() => getPlatform().loadCloud())
      .then(
        () => this.scene.start(SCENES.MAIN_MENU),
        () => this.scene.start(SCENES.MAIN_MENU),
      );
  }

  // Геометрия заставки от размера экрана (квадрат 1740x1740 — contain,
  // полоса 550x18 — умеренной ширины под картинкой)
  private loaderGeom(): { imgX: number; imgY: number; imgS: number; barX: number; barY: number; barW: number; barH: number } {
    const w = this.scale.width;
    const h = this.scale.height;
    const imgS = Math.min(w * 0.9, h * 0.68);
    const imgX = w / 2;
    const imgY = h / 2 - imgS * 0.06;
    const barW = Math.min(w * 0.7, 600);
    const barH = (barW * 18) / 550;
    return { imgX, imgY, imgS, barX: w / 2 - barW / 2, barY: imgY + imgS / 2 + Math.max(24, h * 0.03), barW, barH };
  }

  // Заставка по центру (натуральные пропорции, без деформации).
  // Картинка — на текущем языке.
  private showArt(): void {
    if (this.art) return;
    // Нет английского файла — показываем русскую заставку, а не чёрный экран
    let key = langTex(TEX.LOADING, TEX.LOADING_EN);
    if (!this.textures.exists(key)) key = TEX.LOADING;
    if (!this.textures.exists(key)) return;
    const g = this.loaderGeom();
    this.art = this.add.image(g.imgX, g.imgY, key);
    this.art.setDisplaySize(g.imgS, g.imgS); // квадрат — одна сторона
  }

  // Полоса под заставкой: левый край зафиксирован, открывается кропом вправо
  private showBar(): void {
    if (this.bar || !this.textures.exists(TEX.MM_LINE)) return;
    const g = this.loaderGeom();
    this.bar = this.add.image(g.barX, g.barY, TEX.MM_LINE);
    this.bar.setOrigin(0, 0.5);
    this.bar.setDisplaySize(g.barW, g.barH);
    this.paintProgress(this.lastProgress);
  }

  // Прогресс 0..1: видимая ширина полосы = доля текстуры слева
  private paintProgress(v: number): void {
    this.lastProgress = v;
    if (this.bar && this.bar.active) {
      this.bar.setCrop(0, 0, Math.max(1, 550 * v), 18);
    }
    if (this.fallbackBar && this.fallbackBar.active) {
      this.fallbackBar.width = Math.max(1, Math.min(400, this.scale.width - 80) * v);
    }
  }

  // Запасной вариант без файлов: название + красная полоска по центру
  private showFallback(): void {
    if (this.fallbackTitle || this.art) return;
    const w = this.scale.width;
    const h = this.scale.height;
    this.fallbackTitle = this.add
      .text(w / 2, h / 2 - 30, 'ЭХО ДВУХ МИРОВ', { color: '#ffffff', fontSize: '28px' })
      .setOrigin(0.5);
    const fullW = Math.min(400, w - 80);
    this.add.rectangle(w / 2, h / 2 + 10, fullW, 2, 0x333333).setOrigin(0.5);
    this.fallbackBar = this.add.rectangle(w / 2 - fullW / 2, h / 2 + 10, 1, 3, gameConfig.colors.red);
    this.fallbackBar.setOrigin(0, 0.5);
    this.paintProgress(this.lastProgress);
  }

  // Перестановка при ресайзе (всё уже созданное — на новые места)
  private layoutLoader(): void {
    const g = this.loaderGeom();
    if (this.art && this.art.active) {
      this.art.setPosition(g.imgX, g.imgY);
      this.art.setDisplaySize(g.imgS, g.imgS);
    }
    if (this.bar && this.bar.active) {
      this.bar.setPosition(g.barX, g.barY);
      this.bar.setDisplaySize(g.barW, g.barH);
      this.paintProgress(this.lastProgress);
    }
    if (this.fallbackTitle && this.fallbackTitle.active) {
      const w = this.scale.width;
      const h = this.scale.height;
      this.fallbackTitle.setPosition(w / 2, h / 2 - 30);
      this.fallbackBar?.setPosition(w / 2 - Math.min(400, w - 80) / 2, h / 2 + 10);
    }
  }
}
