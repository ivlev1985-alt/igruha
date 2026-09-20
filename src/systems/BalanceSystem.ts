// ============================================================
// BalanceSystem — шкалы Света и Тьмы (GDD 2.4).
// Формула для линии длины N:
//   лицом:    Свет += N, Тьма -= (N - 2)
//   изнанкой: Тьма += N, Свет -= (N - 2)
// Шкалы могут уходить в минус, нижнего предела нет.
// ============================================================
import { gameConfig } from '../config/gameConfig';

export class BalanceSystem {
  light = 0; // старт 0/0 (наше уточнение)
  dark = 0;

  // Применить одну линию
  applyLine(length: number, isFace: boolean): void {
    const minus = length - 2;
    if (isFace) {
      this.light += length;
      this.dark -= minus;
    } else {
      this.dark += length;
      this.light -= minus;
    }
  }

  // Текущий перекос (модуль разницы)
  getDiff(): number {
    return Math.abs(this.light - this.dark);
  }

  // Победа: равенство и обе >= минимума (GDD 2.8, минимум 50)
  isVictory(): boolean {
    return this.light === this.dark && this.light >= gameConfig.victoryMin;
  }
}
