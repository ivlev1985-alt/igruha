// ============================================================
// AchievementsScene — пункт 6: все 99 достижений, логически
// сгруппированы (группы из JSON), в три столбца.
// Пройденные — красная ✓, остальные — серый ○. Прокрутка.
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { ACHIEVEMENTS, loadUnlocked, countUnlocked, achTitle, achGroup } from '../systems/Achievements';
import { t } from '../utils/lang';
import { onEsc } from '../utils/keyboard';

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super(SCENES.ACHIEVEMENTS);
  }

  create(): void {
    const fullW = this.scale.width;
    const h = this.scale.height;
    // Пункт 1: список в полосе по центру
    const w = Math.min(fullW, gameConfig.contentMaxWidth);
    const bx = (fullW - w) / 2;
    const unlocked = new Set(loadUnlocked());

    this.add
      .text(fullW / 2, 24, t('achTitle', { n: countUnlocked(), m: ACHIEVEMENTS.length }), {
        color: '#ffffff',
        fontSize: '28px',
      })
      .setOrigin(0.5, 0);

    const topY = 90;
    const bottomY = h - 90;
    const margin = bx + Math.max(12, w * 0.04);
    const availW = w - (margin - bx) * 2;
    const cols = 3;
    const colW = availW / cols;
    const itemH = 26;
    const headH = 32;
    const itemSize = Math.max(11, Math.min(16, Math.round(colW * 0.11)));

    // Маску прячем (иначе закроет список). Ширина — весь экран,
    // контент уже стоит в полосе по центру (margin от bx).
    const maskShape = this.add.graphics();
    maskShape.fillRect(0, topY - 10, fullW, bottomY - topY);
    maskShape.setVisible(false);
    const mask = maskShape.createGeometryMask();
    const list = this.add.container(0, 0);
    list.setMask(mask);

    // Поток: разделитель, заголовок группы по центру, под ним items в 3 колонки
    let y = topY;
    let lastGroup = '';
    let col = 0;
    for (const a of ACHIEVEMENTS) {
      const g = achGroup(a);
      if (g !== lastGroup) {
        // Новая группа: добиваем ряд, линия-разделитель, заголовок по центру
        if (col !== 0) {
          y += itemH;
          col = 0;
        }
        if (lastGroup !== '') {
          y += 8;
          const sep = this.add.rectangle(fullW / 2, y, availW, 1, 0x555555);
          list.add(sep);
          y += 10;
        }
        const head = this.add.text(bx + w / 2, y, g.toUpperCase(), {
          color: '#888888',
          fontSize: `${itemSize + 2}px`,
        });
        head.setOrigin(0.5, 0);
        list.add(head);
        y += headH;
        lastGroup = g;
      }
      const done = unlocked.has(a.id);
      const x = margin + col * colW;
      // Пункт 1: галочка красная, кружок серый, название своим цветом
      const mark = this.add.text(x, y, done ? '✓' : '○', {
        color: done ? '#d7263d' : '#666666',
        fontSize: `${itemSize}px`,
      });
      const item = this.add.text(x + itemSize + 4, y, achTitle(a), {
        color: done ? '#ffffff' : '#666666',
        fontSize: `${itemSize}px`,
      });
      list.add([mark, item]);
      col++;
      if (col >= cols) {
        col = 0;
        y += itemH;
      }
    }
    if (col !== 0) y += itemH;
    const contentH = y - topY;

    // Прокрутка пальцем/мышью, если не влезло
    const maxScroll = Math.max(0, contentH - (bottomY - topY));
    if (maxScroll > 0) {
      let startY = 0;
      let baseY = 0;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        startY = p.y;
        baseY = list.y;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.isDown) return;
        list.y = Math.max(-maxScroll, Math.min(0, baseY + (p.y - startY)));
      });
    }

    const back = this.add
      .text(fullW / 2, h - 50, t('back'), { color: '#d7263d', fontSize: '26px' })
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

  private handleResize(): void {
    this.scene.restart();
  }
}
