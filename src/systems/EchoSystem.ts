// ============================================================
// EchoSystem — логика Эхо (GDD 2.6), без Phaser.
// Доступно раз в 5 ходов, цена 3 сек (уточнено).
// Помнит последний ход игрока и снимок поля ДО него.
// Поле откатывается, шкалы — нет, ход играется заново.
// Эхо не перезаписывает lastMove (эхо после эхо запрещено кулдауном).
// ============================================================
import { gameConfig } from '../config/gameConfig';
import type { SnapshotCell } from '../entities/Board';

// Ход игрока, который можно повторить
export type PlayerMove =
  | { kind: 'tap'; row: number; col: number }
  | { kind: 'drag'; r1: number; c1: number; r2: number; c2: number };

export class EchoSystem {
  lastMove: PlayerMove | null = null;
  snapshot: SnapshotCell[][] | null = null;
  movesSinceEcho = 0;

  // Вызывать ПОСЛЕ каждого хода игрока (тап/драг), снимок — ДО хода
  recordPlayerMove(move: PlayerMove, snap: SnapshotCell[][]): void {
    this.lastMove = move;
    this.snapshot = snap;
    this.movesSinceEcho++;
  }

  // Можно ли нажать Эхо прямо сейчас?
  canEcho(): boolean {
    return (
      this.lastMove !== null &&
      this.snapshot !== null &&
      this.movesSinceEcho >= gameConfig.echoCooldownMoves
    );
  }

  // Сколько ходов осталось до готовности (для кнопки)
  movesLeft(): number {
    return Math.max(0, gameConfig.echoCooldownMoves - this.movesSinceEcho);
  }

  // Применить Эхо: просто сбрасываем счётчик (lastMove храним для призрака)
  useEcho(): void {
    this.movesSinceEcho = 0;
  }
}
