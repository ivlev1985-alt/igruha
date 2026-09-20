// ============================================================
// MatchSystem — поиск линий 3+ одного цвета И одной стороны.
// Чистая логика без Phaser: на вход сетка, на выход список линий.
// Пересечения (кресты) считаются как две отдельные линии.
// ============================================================
import type { Gem } from '../entities/Gem';
import { gameConfig } from '../config/gameConfig';

// Одна клетка поля
export interface CellPos {
  row: number;
  col: number;
}

// Одна найденная линия: клетки + длина + сторона (нужна для очков)
export interface FoundLine {
  cells: CellPos[];
  length: number;
  // true = лицом (очки в Свет), false = изнанкой (очки в Тьму)
  isFace: boolean;
}

export class MatchSystem {
  // Найти все горизонтальные и вертикальные линии длиной >= minLineLength
  static findMatches(grid: (Gem | null)[][]): FoundLine[] {
    const lines: FoundLine[] = [];
    const rows = grid.length;
    if (rows === 0) return lines;
    const cols = grid[0].length;
    const minLen = gameConfig.minLineLength;

    // --- Горизонтали: идём по строкам, ищем серии с одинаковым ключом ---
    for (let r = 0; r < rows; r++) {
      let runStart = 0;
      for (let c = 1; c <= cols; c++) {
        const prev = c - 1 < cols ? grid[r][c - 1] : null;
        const curr = c < cols ? grid[r][c] : null;
        const same =
          prev !== null && curr !== null && prev.matchKey() === curr.matchKey();
        // Серия оборвалась (или конец строки) — проверяем длину
        if (!same) {
          const runLen = c - runStart;
          if (prev !== null && runLen >= minLen) {
            const cells: CellPos[] = [];
            for (let k = runStart; k < c; k++) cells.push({ row: r, col: k });
            lines.push({ cells, length: runLen, isFace: prev.isFace() });
          }
          runStart = c;
        }
      }
    }

    // --- Вертикали: то же самое по столбцам ---
    for (let c = 0; c < cols; c++) {
      let runStart = 0;
      for (let r = 1; r <= rows; r++) {
        const prev = r - 1 < rows ? grid[r - 1][c] : null;
        const curr = r < rows ? grid[r][c] : null;
        const same =
          prev !== null && curr !== null && prev.matchKey() === curr.matchKey();
        if (!same) {
          const runLen = r - runStart;
          if (prev !== null && runLen >= minLen) {
            const cells: CellPos[] = [];
            for (let k = runStart; k < r; k++) cells.push({ row: k, col: c });
            lines.push({ cells, length: runLen, isFace: prev.isFace() });
          }
          runStart = r;
        }
      }
    }

    return lines;
  }

  // Собрать все клетки к удалению (объединение, без дублей для крестов)
  static collectCells(lines: FoundLine[]): CellPos[] {
    const seen = new Set<string>();
    const out: CellPos[] = [];
    for (const line of lines) {
      for (const cell of line.cells) {
        const key = `${cell.row}:${cell.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(cell);
        }
      }
    }
    return out;
  }
}
