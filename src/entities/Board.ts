// ============================================================
// Board — сетка 8x8, чистая логика без Phaser.
// Умеет: создать поле без стартовых линий, переворот, свап с
// переворотом, удаление клеток, падение и пополнение сверху,
// снимок/откат поля для Эхо (GDD 2.6).
// Новые камни: цвет 1/3, сторона 50/50 (GDD 2.7).
// ============================================================
import { Gem } from './Gem';
import { GEM_COLORS, GEM_SIDES, type GemColor, type GemSide } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { mulberry32 } from '../utils/rng';

const ALL_COLORS: GemColor[] = [GEM_COLORS.RED, GEM_COLORS.WHITE, GEM_COLORS.BLACK];

// Снимок одной клетки: только цвет и сторона (позиция ясна из индексов).
// Нужен для Эхо: поле откатывается, а шкалы — нет (GDD 2.6).
export interface SnapshotCell {
  color: GemColor;
  side: GemSide;
}

export class Board {
  grid: (Gem | null)[][] = [];
  rows: number;
  cols: number;

  // Источник случайности: обычно Math.random, в задаче дня — сид
  private rng: () => number = Math.random;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    // Пустая сетка, заполняется через generate()
    for (let r = 0; r < rows; r++) {
      this.grid.push(new Array<Gem | null>(cols).fill(null));
    }
  }

  // Фиксированный сид для задачи дня (вызывать до generate())
  setSeed(seed: number): void {
    this.rng = mulberry32(seed);
  }

  // Случайный цвет (равновероятно) и сторона (50/50)
  private randomColor(): GemColor {
    const i = Math.floor(this.rng() * ALL_COLORS.length);
    return ALL_COLORS[i];
  }

  private randomSide(): GemSide {
    return this.rng() < gameConfig.spawnSideChance ? GEM_SIDES.FACE : GEM_SIDES.BACK;
  }

  // Создать поле без готовых линий (старт 0/0 без линий — наше уточнение).
  // Проверяем двух соседей слева и сверху: не даём третьему совпасть.
  generate(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let color = this.randomColor();
        let side = this.randomSide();
        // Подбираем, пока не исчезнет линия через эту клетку
        while (this.createsLineAt(r, c, color, side)) {
          color = this.randomColor();
          side = this.randomSide();
        }
        this.grid[r][c] = new Gem(r, c, color, side);
      }
    }
  }

  // Проверить: даст ли (color, side) в (r,c) линию 3+ с соседями слева/сверху?
  private createsLineAt(r: number, c: number, color: GemColor, side: GemSide): boolean {
    const key = `${color}:${side}`;
    // Два слева
    if (c >= 2) {
      const a = this.grid[r][c - 1];
      const b = this.grid[r][c - 2];
      if (a && b && a.matchKey() === key && b.matchKey() === key) return true;
    }
    // Два сверху
    if (r >= 2) {
      const a = this.grid[r - 1][c];
      const b = this.grid[r - 2][c];
      if (a && b && a.matchKey() === key && b.matchKey() === key) return true;
    }
    return false;
  }

  // Переворот одного камня (тап). Неудачный тап остаётся (наше уточнение).
  flipAt(row: number, col: number): void {
    const gem = this.grid[row]?.[col];
    if (gem) gem.flip();
  }

  // Соседи по горизонтали/вертикали (драг только на соседнего)?
  isNeighbor(r1: number, c1: number, r2: number, c2: number): boolean {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return dr + dc === 1;
  }

  // Свап двух камней + переворот обоих (драг из GDD 2.2).
  // Если линии нет — всё равно остаётся (наше уточнение).
  swapAndFlip(r1: number, c1: number, r2: number, c2: number): void {
    const a = this.grid[r1]?.[c1];
    const b = this.grid[r2]?.[c2];
    if (!a || !b) return;
    // Меняем местами в сетке
    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    // Обновляем координаты
    const tmpR = a.row;
    const tmpC = a.col;
    a.row = b.row;
    a.col = b.col;
    b.row = tmpR;
    b.col = tmpC;
    // Переворачиваем оба
    a.flip();
    b.flip();
  }

  // Убрать клетки после линии (ставим null)
  removeCells(cells: { row: number; col: number }[]): void {
    for (const cell of cells) {
      this.grid[cell.row][cell.col] = null;
    }
  }

  // Падение вниз + новые камни сверху (мгновенно, без анимации — Этап 1).
  // Анимация падения 0.2 сек — Этап 2.
  collapseAndRefill(): void {
    for (let c = 0; c < this.cols; c++) {
      // Собираем выжившие снизу вверх
      const survivors: Gem[] = [];
      for (let r = this.rows - 1; r >= 0; r--) {
        const gem = this.grid[r][c];
        if (gem) survivors.push(gem);
      }
      // Раскладываем снизу
      let r = this.rows - 1;
      for (const gem of survivors) {
        this.grid[r][c] = gem;
        gem.row = r;
        gem.col = c;
        r--;
      }
      // Пустоты сверху — новые случайные камни
      while (r >= 0) {
        this.grid[r][c] = new Gem(r, c, this.randomColor(), this.randomSide());
        r--;
      }
    }
  }

  // Переворот мира (GDD 2.8): все камни меняют сторону.
  // Анимация вращения — Этап 2, здесь мгновенно.
  flipAllSides(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c]?.flip();
      }
    }
  }

  // Снимок поля для Эхо: запоминаем ДО хода игрока (GDD 2.6).
  snapshot(): SnapshotCell[][] {
    return this.grid.map((row) =>
      row.map((gem) => ({
        color: gem ? gem.color : this.randomColor(),
        side: gem ? gem.side : this.randomSide(),
      })),
    );
  }

  // Откат поля к снимку. Шкалы при этом НЕ трогаем — это делает сцена,
  // потому что очки за оба проигрывания суммируются (GDD 2.6).
  restore(snap: SnapshotCell[][]): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = snap[r]?.[c];
        if (cell) {
          this.grid[r][c] = new Gem(r, c, cell.color, cell.side);
        } else {
          this.grid[r][c] = new Gem(r, c, this.randomColor(), this.randomSide());
        }
      }
    }
  }
}
