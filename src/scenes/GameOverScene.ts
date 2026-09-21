// Экран поражения (Этап 2): текст GDD 3.5 + рекорд + кнопка.
// Красивый вид — Этап 3.
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { loadStats } from '../utils/stats';
import { t } from '../utils/lang';
import { onEsc } from '../utils/keyboard';

export class GameOverScene extends Phaser.Scene {
  // Рекорд партии — храним в поле, чтобы пережить поворот экрана
  private record = 0;

  constructor() {
    super(SCENES.GAME_OVER);
  }

  create(data: { record?: number }): void {
    this.record = data.record ?? 0;
    const record = this.record;
    const best = Math.max(loadStats().bestRound, record);
    const w = this.scale.width;
    const h = this.scale.height;
    this.add
      .text(w / 2, h / 2 - 70, t('oTired'), {
        color: '#ffffff',
        fontSize: '28px',
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h / 2 - 20, t('oScore', { r: record, b: best }), {
        color: '#aaaaaa',
        fontSize: '22px',
        align: 'center',
      })
      .setOrigin(0.5);
    const again = this.add
      .text(w / 2, h / 2 + 40, t('oAgain'), { color: '#d7263d', fontSize: '26px' })
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
