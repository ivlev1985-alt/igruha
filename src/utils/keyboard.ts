// ============================================================
// keyboard.ts — Esc одним вызовом (пункт 2):
// в игре — снять выбор камня, в меню — как кнопка «Назад».
// Подписка снимается при выключении сцены, утечек нет.
// ============================================================
import Phaser from 'phaser';

export function onEsc(scene: Phaser.Scene, cb: () => void): void {
  const kb = scene.input.keyboard;
  if (!kb) return; // клавиатуры нет (строго тач) — нечего делать
  const handler = (): void => {
    cb();
  };
  kb.on('keydown-ESC', handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    kb.off('keydown-ESC', handler);
  });
}
