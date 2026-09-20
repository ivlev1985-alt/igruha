// ============================================================
// TimerSystem — таймер (GDD 2.5) + фикс Этапа 3.
// Время идёт только когда игрок действует.
// Формула хода: Таймер = Таймер − цена_действия − штраф_перекоса.
// При равновесии штраф = −бонус, т.е. таймер растёт (не выше максимума).
// НО: бонус даётся только за результативный ход (с линиями) —
// пустой ход в равновесии бонуса не даёт, иначе время накручивается
// бесконечными переворотами туда-сюда (баг с Этапа 2).
// ============================================================
import { gameConfig } from '../config/gameConfig';
import { difficultyBonus } from '../utils/difficulty';

export class TimerSystem {
  time: number;

  constructor() {
    this.time = gameConfig.timerStart; // 90
  }

  // Штраф по таблице перекоса для разницы |Свет − Тьма| после хода.
  // Равновесие (0): минус = бонус ТЕКУЩЕЙ сложности из difficulty.json
  // (лёгкий +10, средний/сложный +6). Остальное — по таблице из gameConfig.
  getPenalty(diff: number): number {
    if (diff === 0) return -difficultyBonus();
    for (const row of gameConfig.skewTable) {
      if (diff <= row.maxDiff) return row.penalty;
    }
    return 0;
  }

  // Применить один ход игрока.
  // hadLines = собрал ли ход хотя бы одну линию (считает сцена).
  // Возвращает разбор для показа: потрачено (цена + штраф) и бонус.
  applyTurn(actionCost: number, diffAfter: number, hadLines = true): { spent: number; bonus: number } {
    let penalty = this.getPenalty(diffAfter);
    if (diffAfter === 0 && !hadLines && gameConfig.bonusOnlyWithLines) {
      penalty = 0; // пустой ход: платим цену, бонуса нет
    }
    this.time = this.time - actionCost - penalty;
    // Потолок (GDD 2.5: не выше 90)
    if (this.time > gameConfig.timerMax) {
      this.time = gameConfig.timerMax;
    }
    return { spent: actionCost + Math.max(0, penalty), bonus: Math.max(0, -penalty) };
  }

  // Время вышло? (переворот мира или game over — решает GameScene)
  isExpired(): boolean {
    return this.time <= 0;
  }

  // Сброс после переворота мира (GDD 2.8: снова 90)
  reset(): void {
    this.time = gameConfig.timerStart;
  }
}
