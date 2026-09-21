// ============================================================
// HowToScene — «Как играть»: единообразно с Настройками
// (заголовок ниже, кнопка Назад выше). Текст тем же кеглем (24px),
// блок по центру. Ниже — схемы переворотов в трёх столбцах
// (Классический / Каменные / Мистический) с двумя разделительными линиями:
// 3 строки (белый, красный, чёрный): лицо → стрелка → изнанка.
// Камни уменьшены, чтобы три столбца влезли. Если не влезло — прокрутка пальцем.
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { TEX, hasSheetFrame, hasMysticFrame, stoneFrame, hasStoneFrame, langTex } from '../utils/assets';
import { difficultyHowto } from '../utils/difficulty';
import { unlockStreak } from '../utils/skins';
import { t } from '../utils/lang';
import { onEsc } from '../utils/keyboard';

export class HowToScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HOW_TO);
  }

  create(): void {
    const fullW = this.scale.width;
    const h = this.scale.height;
    // Пункт 1: контент в полосе по центру
    const w = Math.min(fullW, gameConfig.contentMaxWidth);
    const bx = (fullW - w) / 2;
    const cx = fullW / 2;

    // Заголовок ниже (как в Настройках), кнопка Назад выше
    const titleY = h * 0.1;
    const backY = h * 0.88;
    this.add
      .text(cx, titleY, t('howTitle'), { color: '#ffffff', fontSize: '28px' })
      .setOrigin(0.5, 0);

    // Контент: центрируем между заголовком и кнопкой, иначе прокрутка
    const list = this.add.container(0, 0);

    // 6 пунктов — тем же кеглем, что кнопки Настроек.
    // Пункты 1–5 — одним текстом; шестой — отдельно с висячим отступом:
    // продолжение строк начинается под первым словом, как в пункте 1
    // (тексты сложностей — из difficulty.json).
    const fontSize = 24;
    const lines = [
      t('how1a'),
      t('how1b'),
      t('how2'),
      t('how3'),
      t('how4'),
      t('how5'),
    ];
    const helpStyle = {
      color: '#dddddd',
      fontSize: `${fontSize}px`,
      lineSpacing: 12,
      align: 'left',
    } as const;
    const help = this.add
      .text(cx, 0, lines, {
        ...helpStyle,
        wordWrap: { width: w - 40 },
      })
      .setOrigin(0.5, 0);
    list.add(help);
    // Пункты 6 и 7 — с висячим отступом, как пункт 1:
    // номер отдельно, тело начинается под первым словом.
    // Ширина тел — по ширине блока пунктов 1–5 (правый край ровный).
    const leftX = help.x - help.width / 2;
    let ty = help.height + 12;
    ty = this.addHangingPoint(list, leftX, ty, help.width, '6', difficultyHowto().join(' '), helpStyle) + 12;
    ty = this.addHangingPoint(
      list, leftX, ty, help.width, '7',
      t('how7', { s: unlockStreak('stone'), m: unlockStreak('mystic') }),
      helpStyle,
    ) + 12;
    // Пункт 8: таблица времени и очков — числами из конфига, а не руками
    // (бонус — текущей сложности, перекос — из skewTable).
    const skewParts: string[] = [];
    let rangeStart = 1;
    for (const row of gameConfig.skewTable) {
      if (row.maxDiff <= 0) continue; // равновесие — отдельной строкой выше
      const range = row.maxDiff === Infinity || rangeStart >= row.maxDiff
        ? `${rangeStart}+`
        : `${rangeStart}–${row.maxDiff}`;
      skewParts.push(`${range} → −${row.penalty} ${t('secShort')}`);
      rangeStart = row.maxDiff + 1;
    }
    const how8 = [
      t('how8a', { tap: gameConfig.tapCost, drag: gameConfig.dragCost, echo: gameConfig.echoCost }),
      t('how8c', { list: skewParts.join('; ') }),
      t('how8d'),
    ].join('\n');
    ty = this.addHangingPoint(list, leftX, ty, help.width, '8', how8, helpStyle);
    const textBottom = ty;

    // Схемы: три столбца, поэтому камни уменьшены — иначе не влезут
    const stone = Math.max(28, Math.min(64, Math.round(Math.min(w, h) * 0.09)));
    const headSize = 20;
    const rowGap = 16;
    // Схемы ниже списка с запасом ещё в одну пустую строку (пункт 3)
    const schemeY = textBottom + 30 + (fontSize + 12);
    // Три столбца внутри полосы: Классический, Каменные (посередине), Мистический
    const colX = [bx + w * 0.2, bx + w * 0.5, bx + w * 0.8];
    const cols = [
      { title: t('colClassic'), skin: 'classic' },
      { title: t('colStone'), skin: 'stone' },
      { title: t('colMystic'), skin: 'mystic' },
    ] as const;
    const colors = ['white', 'red', 'black'];
    cols.forEach((col, ci) => {
      const head = this.add
        .text(colX[ci], schemeY, col.title, { color: '#ffffff', fontSize: `${headSize}px` })
        .setOrigin(0.5, 0);
      list.add(head);
      colors.forEach((color, ri) => {
        // Строки с зазором от заголовков, не наезжают
        const y = schemeY + 40 + stone / 2 + ri * (stone + rowGap);
        const leftX = colX[ci] - stone * 0.8;
        const rightX = colX[ci] + stone * 0.8;
        this.addStone(list, leftX, y, stone, color, 'face', col.skin);
        const arrow = this.add
          .text(colX[ci], y, '→', { color: '#d7263d', fontSize: `${Math.round(stone * 0.5)}px` })
          .setOrigin(0.5);
        list.add(arrow);
        this.addStone(list, rightX, y, stone, color, 'back', col.skin);
      });
    });
    const rowsEnd = schemeY + 40 + 2 * (stone + rowGap) + stone / 2;
    // Две вертикальные разделительные линии между тремя столбцами
    const divider = this.add.graphics();
    divider.lineStyle(2, 0xffffff, 0.5);
    divider.lineBetween(bx + w * 0.35, schemeY, bx + w * 0.35, rowsEnd);
    divider.lineBetween(bx + w * 0.65, schemeY, bx + w * 0.65, rowsEnd);
    list.add(divider);

    // Центрируем блок между заголовком и кнопкой; переполнение — прокрутка
    const areaTop = titleY + 44;
    const areaH = backY - 50 - areaTop;
    const contentH = rowsEnd + 10;
    if (contentH <= areaH) {
      list.y = areaTop + (areaH - contentH) / 2;
    } else {
      list.y = areaTop;
      const maskShape = this.add.graphics();
      maskShape.fillRect(0, areaTop, fullW, areaH);
      maskShape.setVisible(false);
      list.setMask(maskShape.createGeometryMask());
      const maxScroll = contentH - areaH;
      let startY = 0;
      let baseY = areaTop;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        startY = p.y;
        baseY = list.y;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        list.y = Math.max(areaTop - maxScroll, Math.min(areaTop, baseY + (p.y - startY)));
      });
    }

    // Кнопка Назад — выше, как в Настройках
    const back = this.add
      .text(cx, backY, t('back'), { color: '#d7263d', fontSize: '26px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start(SCENES.MAIN_MENU));

    // Esc — как кнопка «Назад» (пункт 2)
    onEsc(this, () => this.scene.start(SCENES.MAIN_MENU));

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  // Пункт с висячим отступом (как пункт 1, так оформлены 6, 7 и 8):
  // номер отдельно слева, тело начинается под первым словом.
  // Отступ — номер + один пробел.
  // Возвращает низ блока (следующий пункт — ниже с зазором).
  private addHangingPoint(
    list: Phaser.GameObjects.Container, leftX: number, y: number, width: number,
    num: string, text: string,
    style: { color: string; fontSize: string; lineSpacing: number; align: string },
  ): number {
    const probe = this.add.text(0, 0, `${num}. `, { fontSize: style.fontSize });
    const indent = probe.width;
    probe.destroy();
    const numText = this.add.text(leftX, y, `${num}.`, { ...style }).setOrigin(0, 0);
    list.add(numText);
    const body = this.add.text(leftX + indent, y, text, {
      ...style,
      wordWrap: { width: Math.max(200, width - indent) },
    }).setOrigin(0, 0);
    list.add(body);
    return y + body.height;
  }

  // Один камень схемы: картинка из игрового атласа или запасной квадрат
  private addStone(
    list: Phaser.GameObjects.Container, x: number, y: number, size: number,
    color: string, side: 'face' | 'back', skin: 'classic' | 'stone' | 'mystic',
  ): void {
    let done = false;
    if (gameConfig.useSprites) {
      if (skin === 'classic' && hasSheetFrame(this, color, side === 'face' ? 0 : 5)) {
        const img = this.add.image(x, y, TEX.SHEET, `${color}_${side === 'face' ? 0 : 5}`);
        img.setDisplaySize(size, size);
        list.add(img);
        done = true;
      } else if (skin === 'mystic' && hasMysticFrame(this, color, side)) {
        const img = this.add.image(x, y, TEX.MYSTIC, `m_${color}_${side}`);
        img.setDisplaySize(size, size);
        list.add(img);
        done = true;
      } else if (skin === 'stone' && hasStoneFrame(this, color, side)) {
        const img = this.add.image(x, y, TEX.STONE, stoneFrame(color, side));
        img.setDisplaySize(size, size);
        list.add(img);
        done = true;
      }
    }
    if (!done) {
      // Запасной вариант без картинок: заливка по стороне
      const fill = side === 'face'
        ? color === 'red'
          ? gameConfig.colors.red
          : color === 'white'
            ? gameConfig.colors.white
            : gameConfig.colors.black
        : gameConfig.colors.black;
      list.add(this.add.rectangle(x, y, size, size, fill));
    }
  }

  private handleResize(): void {
    this.scene.restart();
  }
}
