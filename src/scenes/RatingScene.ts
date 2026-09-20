// ============================================================
// RatingScene — общий рейтинг игроков (кнопка «Весь список»).
// Полный список из utils/rating.ts, первое место в красной рамке,
// своя строка вспыхивает. Прокрутка пальцем/мышью.
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { loadStats } from '../utils/stats';
import { getPlatform } from '../utils/platform';
import type { RatingRow } from '../utils/rating';
import { t } from '../utils/lang';
import { onEsc } from '../utils/keyboard';

export class RatingScene extends Phaser.Scene {
  // Токен защиты асинхронного списка от рестарта сцены
  private listToken = 0;

  constructor() {
    super(SCENES.RATING);
  }

  create(): void {
    const fullW = this.scale.width;
    const h = this.scale.height;
    // Пункт 1: список в полосе по центру
    const w = Math.min(fullW, gameConfig.contentMaxWidth);
    const cx = fullW / 2;
    // Строки — асинхронно с доски (фолбэк — локальный ряд).
    // Токен защищает от позднего ответа после рестарта сцены.
    const token = (this.listToken = (this.listToken ?? 0) + 1);
    getPlatform().getLeaderboard(loadStats().bestRound).then((rows) => {
      try {
        if (token !== this.listToken || !this.scene.isActive(SCENES.RATING) || !list.active) return;
        drawList(rows);
      } catch {
        // Сцена уже ушла — молча выходим
      }
    });

    this.add
      .text(cx, 24, t('ratingTitle'), { color: '#ffffff', fontSize: '28px' })
      .setOrigin(0.5, 0);

    const topY = 100;
    const rowH = 32;
    const bottomY = h - 90;
    // Две колонки как в меню: имя слева, счёт по центру
    const colW = Math.min(w * 0.7, 420);
    const nameX = cx - colW / 2;
    const scoreX = cx + colW / 4;

    // Маску прячем: иначе белый прямоугольник закроет список
    const maskShape = this.add.graphics();
    maskShape.fillRect(0, topY - 10, w, bottomY - topY);
    maskShape.setVisible(false);
    const mask = maskShape.createGeometryMask();
    const list = this.add.container(0, 0);
    list.setMask(mask);

    // Первая строка ниже края маски — верх рамки первого места виден
    const listTop = topY + 22;
    const drawList = (rows: RatingRow[]): void => {
    rows.forEach((row, i) => {
      const y = listTop + i * rowH;
      const name = this.add
        .text(nameX, y, `${i + 1}. ${row.name}`, {
          color: '#ffffff',
          fontSize: '20px',
          fontStyle: row.isYou ? 'bold' : 'normal',
        })
        .setOrigin(0, 0.5);
      const score = this.add
        .text(scoreX, y, `${row.score}/${row.score}`, {
          color: '#ffffff',
          fontSize: '20px',
          fontStyle: row.isYou ? 'bold' : 'normal',
        })
        .setOrigin(0.5);
      list.add([name, score]);
      if (i === 0) {
        const x0 = nameX - 12;
        const x1 = score.x + score.width / 2 + 12;
        const frame = this.add.rectangle((x0 + x1) / 2, y, x1 - x0, rowH * 0.95);
        frame.setStrokeStyle(2, gameConfig.colors.red);
        list.add(frame);
        list.sendToBack(frame);
      }
      if (row.isYou) {
        const flash = this.add.rectangle(cx, y, colW + 24, rowH * 0.95, gameConfig.colors.red, 0.45);
        list.add(flash);
        this.tweens.add({ targets: flash, alpha: 0, duration: 800, onComplete: () => flash.destroy() });
      }
    });

    // Прокрутка, если не влезло
    const maxScroll = Math.max(0, listTop + rows.length * rowH - bottomY);
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
    }; // конец drawList

    const back = this.add
      .text(cx, h - 50, t('back'), { color: '#d7263d', fontSize: '26px' })
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
