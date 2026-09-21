// Экран победы (Этап 2): рекорд партии + лучший + кнопка.
// Красивый вид из GDD 3.4 — Этап 3.
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { loadStats } from '../utils/stats';
import { t } from '../utils/lang';
import { onEsc } from '../utils/keyboard';

export class VictoryScene extends Phaser.Scene {
  // Рекорд партии — храним в поле, чтобы пережить поворот экрана
  private record = 50;

  constructor() {
    super(SCENES.VICTORY);
  }

  create(data: { record?: number }): void {
    this.record = data.record ?? 50;
    const record = this.record;
    const best = Math.max(loadStats().bestRound, record);
    // Название взятой планки (ключи tier0..tier4 — в lang.ts)
    let tierName: string = t('tier0');
    gameConfig.progressTiers.forEach((need, i) => {
      if (record >= need) tierName = t(`tier${i}`);
    });
    const w = this.scale.width;
    const h = this.scale.height;
    this.add
      .text(w / 2, h / 2 - 70, t('vWhole', { r: record }), {
        color: '#ffffff',
        fontSize: '28px',
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h / 2 - 20, t('vBest', { t: tierName, b: best }), {
        color: '#aaaaaa',
        fontSize: '22px',
        align: 'center',
      })
      .setOrigin(0.5);
    const again = this.add
      .text(w / 2, h / 2 + 40, t('vAgain'), { color: '#d7263d', fontSize: '26px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => this.scene.start(SCENES.GAME, { daily: false }));
    // Выход в меню — так же, но белым
    const exit = this.add
      .text(w / 2, h / 2 + 90, t('exitBtn'), { color: '#ffffff', fontSize: '26px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    exit.on('pointerdown', () => this.scene.start(SCENES.MAIN_MENU));

    // Esc — как кнопка «Выход» (пункт 2)
    onEsc(this, () => this.scene.start(SCENES.MAIN_MENU));

    // Центровка при повороте экрана
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private handleResize(): void {
    this.scene.restart({ record: this.record });
  }
}
