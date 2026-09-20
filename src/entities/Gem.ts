// ============================================================
// Gem — камень поля. Данные + переворот, без отрисовки.
// Отрисовкой занимается GameScene (прототип: простые прямоугольники).
// Анимации и спрайт-режим — Этап 2+ (см. GDD 4.3, 5.2).
// ============================================================
import { GEM_SIDES, type GemColor, type GemSide } from '../utils/constants';

export class Gem {
  // Позиция в сетке
  row: number;
  col: number;

  // Свойства из GDD 2.1
  color: GemColor;
  side: GemSide;

  constructor(row: number, col: number, color: GemColor, side: GemSide) {
    this.row = row;
    this.col = col;
    this.color = color;
    this.side = side;
  }

  // Переворот стороны: лицо <-> изнанка (тап из GDD 2.2)
  flip(): void {
    this.side = this.side === GEM_SIDES.FACE ? GEM_SIDES.BACK : GEM_SIDES.FACE;
  }

  // Камень лицом? Лицо работает на Свет, изнанка — на Тьму (GDD 2.4)
  isFace(): boolean {
    return this.side === GEM_SIDES.FACE;
  }

  // Ключ для поиска линий: совпадать должны И цвет, И сторона (GDD 2.4)
  matchKey(): string {
    return `${this.color}:${this.side}`;
  }
}
