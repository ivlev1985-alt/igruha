// ============================================================
// UIScene — Этап 3, правки по просьбе игрока:
// - Счётчики «Свет: N» / «Тьма: N» висят НАД шкалами, а не в углах.
// - Внизу ряд из трёх кнопок: [Выход] [Эхо] [Завершить].
//   Выход — в любой момент, партия засчитывается (см. tryExit в GameScene).
// Шкалы, линия равновесия и таймер — как раньше (GDD 3.3).
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { TEX, eclipseGeom, langTex } from '../utils/assets';
import { gameConfig } from '../config/gameConfig';
import { t, secondWord } from '../utils/lang';
import type { GameScene } from './GameScene';

// Правильное окончание: 1 секунда, 3 секунды, 90 секунд (пункт 4).
// Английский: second/seconds. Логика — в lang.secondWord.
function secondsWord(n: number): string {
  return secondWord(n);
}

export class UIScene extends Phaser.Scene {
  private lightText!: Phaser.GameObjects.Text; // над левой шкалой
  private darkText!: Phaser.GameObjects.Text; // над правой шкалой
  private flipsText!: Phaser.GameObjects.Text; // под таймером
  // Пункт 3: таймер в две строки — число и слово отдельно (цвета раздельно)
  private timerNum!: Phaser.GameObjects.Text; // число секунд (бело-красное)
  private timerWord!: Phaser.GameObjects.Text; // слово «секунд» (серое)
  private bars!: Phaser.GameObjects.Graphics; // тонкие линии шкал
  // Эмблемы на верхах линий: слева emblem_1, справа emblem (пункт 1)
  private emblemL?: Phaser.GameObjects.Image;
  private emblemR?: Phaser.GameObjects.Image;
  private echoImg?: Phaser.GameObjects.Image; // кнопка-картинка (пункт 2)
  private echoCircle?: Phaser.GameObjects.Arc; // запасной вариант без файла
  private echoLabel?: Phaser.GameObjects.Text;
  private finishBtn!: Phaser.GameObjects.Text; // правее Эхо
  private exitBtn!: Phaser.GameObjects.Text; // левее Эхо

  private lastLight = 0;
  private lastDark = 0;
  private screenW = 0;
  // Прошлое значение таймера — чтобы показать отлетающий минус (пункт 5)
  private lastTime: number | null = null;
  // Пункт 3: полный последний пакет HUD — переприменяем после ресайза,
  // иначе кнопки остаются на стартовых позициях до следующего хода
  private hudSeen = false;
  private lastFlips = 0;
  private lastEchoReady = false;
  private lastEchoLeft = 5;
  private lastCanFinish = false;

  constructor() {
    super(SCENES.UI);
  }

  create(): void {
    this.bars = this.add.graphics();
    this.layoutHud();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private handleResize(): void {
    this.layoutHud();
    this.redraw(this.lastLight, this.lastDark);
  }

  private layoutHud(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.screenW = w;
    for (const obj of [
      this.lightText, this.darkText, this.flipsText, this.timerNum, this.timerWord,
      this.echoImg, this.echoCircle, this.echoLabel, this.finishBtn, this.exitBtn,
    ]) {
      if (obj) obj.destroy();
    }
    this.echoImg = undefined;
    this.echoCircle = undefined;
    this.echoLabel = undefined;
    // Счётчики создаются здесь, позиция — в redraw() (над шкалами)
    this.lightText = this.add.text(0, 0, `${t('light')} 0`, { color: '#ffffff', fontSize: '18px' });
    this.darkText = this.add.text(0, 0, `${t('dark')} 0`, { color: '#aaaaaa', fontSize: '18px' });

    // Таймер В КРУГЕ ЗАТМЕНИЯ (замерен по пикселям, см. eclipseGeom).
    // РАЗМЕРЫ И КООРДИНАТЫ — ЗДЕСЬ: число 36px, слово 13px, счётчик 12px,
    // всё по центру круга. Нет баннера — старый верх по центру.
    // Обводка числа — чтобы читать поверх камней.
    {
      const e = eclipseGeom(this);
      const nx = e ? e.x : w / 2;
      const ny = e ? e.y - 16 : 6;
      const oy = e ? 0.5 : 0;
      this.timerNum = this.add
        .text(nx * 1.02, ny * 0.8, '90', { color: '#ffffff', fontSize: '56px' })
        .setOrigin(0.5, oy);
      this.timerNum.setStroke('#000000', 6);
      this.timerWord = this.add
        .text(nx * 1.02, ny * 1.02, secondWord(90), { color: '#ffffff', fontSize: '13px' })
        .setOrigin(0.5, 0.5);
      this.flipsText = this.add
        .text(nx * 1.02, ny * 1.9, '', { color: '#790505', fontSize: '20px' })
        .setOrigin(0.5, 0.5);
    }

    // Нижний ряд: выход слева, эхо в центре, завершить справа
    const by = h - 70;
    this.exitBtn = this.add
      .text(0, by, t('exit'), { color: '#888888', fontSize: '22px' })
      .setOrigin(0.5);
    this.exitBtn.setInteractive({ useHandCursor: true });
    this.exitBtn.on('pointerdown', () => this.getGame()?.tryExit());

    // Пункт 2: кнопка Эхо — картинка ПОД полем, НАД рядом Выход/Завершить.
    // РАЗМЕР И КООРДИНАТЫ — ЗДЕСЬ (метод echoPos): ширина 200 (пропорции
    // 870x300), центр по X, Y — середина щели между полем и нижним рядом.
    // Скрыта, пока эхо не готово. Нет файла — старый серый круг (ниже).
    {
      const p = this.echoPos();
      // Кнопка Эхо — картинка на текущем языке (eho.png / eho_en.png).
      // Пропорции у файлов разные — высоту считаем по факту текстуры.
      const echoKey = langTex(TEX.UI_ECHO, TEX.UI_ECHO_EN);
      if (this.textures.exists(echoKey)) {
        const img = this.add.image(p.x, p.y, echoKey);
        const ew = Math.min(200, w * 0.4);
        const echoSrc = this.textures.get(echoKey).getSourceImage() as { width: number; height: number };
        img.setDisplaySize(ew, (ew * (echoSrc.height || 300)) / (echoSrc.width || 870));
        img.setVisible(false);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerdown', () => this.getGame()?.tryEcho());
        this.echoImg = img;
      } else {
        const by = h - 70;
        this.echoCircle = this.add.circle(w / 2, by, 44, 0x555555);
        this.echoCircle.setStrokeStyle(3, gameConfig.colors.white);
        this.echoCircle.setInteractive({ useHandCursor: true });
        this.echoCircle.on('pointerdown', () => this.getGame()?.tryEcho());
        this.echoLabel = this.add
          .text(w / 2, by, '5', { color: '#ffffff', fontSize: '24px' })
          .setOrigin(0.5);
      }
    }

    this.finishBtn = this.add
      .text(0, by, t('finish'), { color: '#555555', fontSize: '22px' })
      .setOrigin(0.5)
      .setAlpha(0.5);
    this.finishBtn.setInteractive({ useHandCursor: true });
    this.finishBtn.on('pointerdown', () => this.getGame()?.tryFinish());

    // После перестройки тянем свежие цифры: ресайз сцен идёт в порядке
    // создания, и без этого кнопки висят на стартовых местах до хода
    this.time.delayedCall(0, () => {
      if (!this.hudSeen) return;
      this.updateHud(
        this.lastLight, this.lastDark, this.lastTime ?? 90,
        this.lastFlips, this.lastEchoReady, this.lastEchoLeft, this.lastCanFinish,
      );
    });
  }

  // Позиция кнопки Эхо: центр по X, Y — середина щели между низом
  // поля и нижним рядом кнопок (минимум 24px под полем).
  private echoPos(): { x: number; y: number } {
    const w = this.scale.width;
    const h = this.scale.height;
    const bottomRowY = h - 70;
    const br = this.getGame()?.getBoardRect();
    if (!br) return { x: w / 2, y: bottomRowY - 120 };
    const fieldBottom = br.y + br.h;
    return { x: w / 2, y: fieldBottom + Math.max(24, (bottomRowY - 50 - fieldBottom) / 2) };
  }

  private getGame(): GameScene | null {
    return (this.scene.get(SCENES.GAME) ?? null) as GameScene | null;
  }

  updateHud(
    light: number,
    dark: number,
    time: number,
    flips: number,
    echoReady: boolean,
    echoLeft: number,
    canFinish: boolean,
  ): void {
    if (!this.lightText) return;
    this.lastLight = light;
    this.lastDark = dark;
    this.hudSeen = true;
    this.lastFlips = flips;
    this.lastEchoReady = echoReady;
    this.lastEchoLeft = echoLeft;
    this.lastCanFinish = canFinish;
    // Пункт 4: «87» + «Секунд» с правильным окончанием, логику не трогаем.
    // Число и слово красятся ОТДЕЛЬНО (число — бело-красное, слово — серое).
    this.timerNum.setText(`${time}`);
    this.timerNum.setColor(time <= 10 ? '#d7263d' : '#ffffff');
    this.timerWord.setText(secondsWord(time));
    this.flipsText.setText(t('worldFlips', { n: flips }));

    // lastTime — для переприменения HUD после ресайза (минусы/плюсы
    // показывает GameScene явно через spawnFloater, см. пункт 2)
    this.lastTime = time;

    // Кнопка-картинка видна только когда эхо готово (пункт 2)
    if (this.echoImg) {
      const p = this.echoPos();
      this.echoImg.setPosition(p.x, p.y);
      this.echoImg.setVisible(echoReady);
    } else {
      this.echoCircle?.setFillStyle(echoReady ? gameConfig.colors.red : 0x555555);
      this.echoLabel?.setText(echoReady ? t('echo') : String(echoLeft));
    }
    this.finishBtn.setColor(canFinish ? '#d7263d' : '#555555');
    this.finishBtn.setAlpha(canFinish ? 1 : 0.5);

    // Ряд кнопок: держим у центра, но не даём уехать за края
    const cx = this.screenW / 2;
    const by = this.scale.height - 70;
    this.finishBtn.setPosition(
      Math.min(cx + 130, this.screenW - this.finishBtn.width / 2 - 8),
      by,
    );
    this.exitBtn.setPosition(Math.max(cx - 130, this.exitBtn.width / 2 + 8), by);

    this.redraw(light, dark);
  }

  // Шкалы + счётчики над ними (линия равновесия — в GameScene, пункт 6)
  private redraw(light: number, dark: number): void {
    const game = this.getGame();
    if (!game || !this.scene.isActive(SCENES.GAME)) return;
    const rect = game.getBoardRect();
    // Пункт 3: диапазон из конфига, ноль сидит низко
    const min = gameConfig.gaugeMin;
    const max = gameConfig.gaugeMax;
    const toY = (v: number): number => {
      const y = rect.y + ((max - v) / (max - min)) * rect.h;
      return Math.max(rect.y, Math.min(rect.y + rect.h, y));
    };
    const zeroY = toY(0);

    const barW = 22;
    const leftX = rect.x - barW - 12;
    const rightX = rect.x + rect.w + 12;

    // Счётчики над шкалами (просьба игрока)
    this.lightText.setText(`${t('light')} \n  ${light}`);
    this.lightText.setOrigin(0.5, 1);
    this.lightText.setPosition(leftX + barW / 1, rect.y - 6);
    this.darkText.setText(`${t('dark')} \n  ${dark}`);
    this.darkText.setOrigin(0.5, 1);
    this.darkText.setColor('#d7263d');
    this.darkText.setPosition(rightX + barW / 2, rect.y - 6);

    this.bars.clear();
    this.bars.lineStyle(2, 0x888888, 1);
    this.bars.lineBetween(leftX - 6, zeroY, leftX + barW + 6, zeroY);
    this.bars.lineBetween(rightX - 6, zeroY, rightX + barW + 6, zeroY);
    this.drawScale(leftX, zeroY, toY(light), gameConfig.colors.white);
    this.drawScale(rightX, zeroY, toY(dark), gameConfig.colors.red);
    // Пункт 1: эмблемы на верхах линий вместо шаров
    this.placeEmblem(true, leftX + barW / 2, toY(light), barW);
    this.placeEmblem(false, rightX + barW / 2, toY(dark), barW);
  }

  // Поставить/сдвинуть эмблему на верх линии (пункт 1).
  // ПОЗИЦИЯ И РАЗМЕР — ЗДЕСЬ:
  // слева (Свет) — emblem_1.png (110x146), справа (Тьма) — emblem.png (23x27).
  // Подстроить: wdt (ширина) и -6 (сдвиг вверх, чтобы сидела на грани).
  private placeEmblem(
    left: boolean, x: number, y: number, barW: number,
  ): void {
    const key = left ? TEX.MM_EMBLEM_1 : TEX.MM_EMBLEM;
    const ratio = left ? 146 / 115 : 27 / 22;
    if (!this.textures.exists(key)) return; // нет файла — нет эмблемы
    let em = left ? this.emblemL : this.emblemR;
    if (!em || !em.active || em.texture.key !== key) {
      em?.destroy();
      em = this.add.image(x, y, key);
      if (left) this.emblemL = em;
      else this.emblemR = em;
    }
    const wdt = barW + 20;
    em.setDisplaySize(wdt, wdt * ratio);
    em.setPosition(x, y - 6); // чуть выше, чтобы сидела на грани
  }

  // Всплывающее число у таймера (пункт 2): цена Эхо — красным ВПРАВО от таймера,
  // бонус равновесия +10 — белым СЛЕВА НАПРАВО, влетает В цифру таймера.
  // Вызывает GameScene после каждого хода,
  // поэтому минус виден всегда: и за Свет, и за Тьму, и в равновесии.
  public spawnFloater(text: string, color: string, dir: 1 | -1): void {
    if (!this.timerNum) return;
    // Бонус (dir=-1): стартует слева и влетает в таймер; цена (dir=1): уходит вправо.
    const startX = dir === -1
      ? this.timerNum.x - 90
      : this.timerNum.x + (this.timerNum.width / 2 + 12);
    const endX = dir === -1 ? this.timerNum.x : startX + 90;
    const t = this.add.text(startX, this.timerNum.y * 0.8, text, {
      color,
      fontSize: '30px',
    });
    this.tweens.add({
      targets: t,
      x: endX,
      alpha: 0,
      duration: 8000,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // Линии толщиной как сетка камней (пункт 1): ширина берётся оттуда же.
  // Свет — белая, Тьма — красная. Долг ниже нуля — пунктир.
  private drawScale(x: number, zeroY: number, y: number, color: number): void {
    const wdt = gameConfig.boardGrid.width; // та же толщина, что у сетки
    const cx = x + 11; // центр бывшей полосы
    if (y < zeroY) {
      // Выше нуля — сплошная
      this.bars.lineStyle(wdt, color, 1);
      this.bars.lineBetween(cx, zeroY, cx, y);
    } else if (y > zeroY) {
      // Долг — пунктир, полупрозрачный
      this.bars.lineStyle(wdt, color, 0.45);
      for (let yy = zeroY; yy < y; yy += 9) {
        this.bars.lineBetween(cx, yy, cx, Math.min(yy + 5, y));
      }
    } else {
      // Ноль — короткий штрих
      this.bars.lineStyle(wdt, color, 1);
      this.bars.lineBetween(cx - 5, zeroY, cx + 5, zeroY);
    }
  }
}
