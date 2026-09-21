// ============================================================
// GameScene — Этап 3:
// - Подписи сторон на камнях: лицом «СВЕТ», изнанкой «ТЬМА»,
//   чтобы не надо было запоминать (просьба игрока).
// - Эхо с призраком: полупрозрачная копия поля видна во время
//   отката (GDD 4.3: вспышка → призрак → повтор → возврат).
// - Звуки через SoundSystem (файлы позже, сейчас тихие тоны).
// - Ветка спрайтов: useSprites=true + текстуры = картинки,
//   иначе программная графика. Код хода не меняется (GDD 5.2).
// - Адаптивность: перестройка поля при смене размера экрана.
// Управление выбором, анимации, Эхо, прогрессия — с Этапа 2.
// ============================================================
import Phaser from 'phaser';
import { Board } from '../entities/Board';
import type { Gem } from '../entities/Gem';
import { MatchSystem } from '../systems/MatchSystem';
import { BalanceSystem } from '../systems/BalanceSystem';
import { TimerSystem } from '../systems/TimerSystem';
import { EchoSystem } from '../systems/EchoSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { gameConfig } from '../config/gameConfig';
import { SCENES, GEM_SIDES } from '../utils/constants';
import { saveBest, incGames, loadLabelsEnabled } from '../utils/storage';
import { effectiveSkin } from '../utils/skins';
import { recordGame, recordDaily } from '../utils/stats';
import { t, currentLang } from '../utils/lang';
import { finishDaily, getDailyToast, taskText } from '../utils/daily';
import { difficultyDrain } from '../utils/difficulty';
import { getPlatform, notifyGameEnded } from '../utils/platform';
import { syncAchievements } from '../systems/Achievements';
import { addBackground, TEX, sheetFrame, hasSheetFrame, mysticFrame, hasMysticFrame, stoneFrame, hasStoneFrame, eclipseGeom } from '../utils/assets';
import { onEsc } from '../utils/keyboard';
import type { UIScene } from './UIScene';

// Клетка поля
interface CellPos {
  row: number;
  col: number;
}

// Связка камня и его фигур на экране (пул объектов, GDD 5.4)
interface ViewParts {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  dot: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text; // «СВЕТ» / «ТЬМА»
  img?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; // картинка камня
  size: number; // размер клетки для масштабирования картинки
  // classic = атлас морфа (6 кадров), mystic/stone = мгновенная смена,
  // image = одиночный файл, none = программная графика
  kind: 'sheet' | 'mystic' | 'stone' | 'image' | 'none';
}

export class GameScene extends Phaser.Scene {
  // Логика (чистая, без Phaser)
  private board!: Board;
  private balance!: BalanceSystem;
  private timer!: TimerSystem;
  private echo!: EchoSystem;
  private worldFlips = 0;

  // Прогрессия внутри партии (GDD 2.9)
  private bestSession = 0;
  private announcedTier = -1;
  // Режим задачи дня + счётчики для статистики
  private dailyMode = false;
  private dailyTarget = 50; // какое равенство взять (автогенерация дня)
  private dailyMaxFlips = 3; // до какого переворота успеть
  private statLines = 0;
  private statMax = 0;
  private statEcho = 0;
  private over = false; // итог уже записан (защита от двойных кликов по кнопкам)
  private drainAcc = 0; // накопленные секунды реального времени (тиканье сложного)
  private dailyLabel?: Phaser.GameObjects.Text; // текст задачи дня над полем

  // Раскладка и виды
  private cellSize = 0;
  private boardX = 0;
  private boardY = 0;
  private layer!: Phaser.GameObjects.Container; // камни
  private ghostLayer!: Phaser.GameObjects.Container; // призрак Эхо
  private topLayer!: Phaser.GameObjects.Container; // подсветка, вспышки, тосты
  private views = new Map<Gem, ViewParts>();
  private bgObj?: Phaser.GameObjects.GameObject; // фон через хелпер (пункт 6)
  private eqGfx!: Phaser.GameObjects.Graphics; // линия равновесия над полем
  private gridGfx!: Phaser.GameObjects.Graphics; // сетка поля (пункт 2)
  private ambient?: Phaser.GameObjects.Container; // пульс фона при перекосе
  private ambientGlows: Phaser.GameObjects.Arc[] = [];
  private lastAmbient: 'light' | 'dark' | 'none' = 'none';
  private highlight!: Phaser.GameObjects.Rectangle;
  private flashRect!: Phaser.GameObjects.Rectangle;

  // Ввод и состояние
  private busy = false;
  private selected: CellPos | null = null;
  private pressStart: CellPos | null = null;
  private pressDragged = false;

  constructor() {
    super(SCENES.GAME);
  }

  create(data?: { daily?: boolean; seed?: number; task?: { target: number; maxFlips: number } }): void {
    this.dailyMode = data?.daily === true;
    this.over = false; // новая партия — итог ещё не записан
    this.dailyTarget = data?.task?.target ?? 50;
    this.dailyMaxFlips = data?.task?.maxFlips ?? gameConfig.maxWorldFlips;
    this.board = new Board(gameConfig.boardRows, gameConfig.boardCols);
    if (data?.seed !== undefined) this.board.setSeed(data.seed);
    this.board.generate();
    this.statLines = 0;
    this.statMax = 0;
    this.statEcho = 0;
    this.drainAcc = 0;
    this.balance = new BalanceSystem();
    this.timer = new TimerSystem();
    this.echo = new EchoSystem();
    this.worldFlips = 0;
    this.bestSession = 0;
    this.announcedTier = -1;
    this.busy = false;
    this.selected = null;
    this.pressStart = null;
    this.pressDragged = false;
    this.views = new Map();

    this.computeLayout();
    // Пункт 3: фон игры — полоса сверху (якорь 'top'), чёрный вместо картинки
    this.bgObj = addBackground(this, TEX.GAME_BG, 'top');
    // Пульс фона при перекосе (вместо линии): мягкие круги в центре поля.
    // Создаём здесь (под камнями), размеры — после computeLayout ниже.
    this.ambient = this.add.container(0, 0);
    this.ambient.setVisible(false);
    this.buildAmbient();
    this.gridGfx = this.add.graphics(); // сетка под камнями (пункт 2)
    this.layer = this.add.container(0, 0);
    this.ghostLayer = this.add.container(0, 0);
    this.topLayer = this.add.container(0, 0);
    this.buildAllViews();
    this.drawGrid(); // сетка по шагу клеток (пункт 2)
    this.makeHighlight();
    this.makeFlash();
    this.makeDailyLabel(); // задача дня — строкой над полем

    // --- Ввод: клики (выбор) + свайп (быстрый драг для тач-экранов) ---
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.busy) return;
      this.pressStart = this.screenToCell(p.x, p.y);
      this.pressDragged = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.busy || !this.pressStart || this.pressDragged || !p.isDown) return;
      const cell = this.screenToCell(p.x, p.y);
      if (!cell) return;
      if (cell.row === this.pressStart.row && cell.col === this.pressStart.col) return;
      if (this.board.isNeighbor(this.pressStart.row, this.pressStart.col, cell.row, cell.col)) {
        const from = this.pressStart;
        this.pressStart = null;
        this.pressDragged = true;
        this.clearSelection();
        this.playDrag(from.row, from.col, cell.row, cell.col);
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.pressDragged) {
        this.pressStart = null;
        return;
      }
      const start = this.pressStart;
      this.pressStart = null;
      if (this.busy || !start) return;
      const end = this.screenToCell(p.x, p.y);
      if (!end) {
        this.clearSelection();
        return;
      }
      this.handleClick(end);
    });

    // Esc — снять выбор камня (пункт 2)
    onEsc(this, () => this.clearSelection());

    // Перестройка при смене размера/ориентации (требование Yandex)
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });

    if (this.scene.isActive(SCENES.UI)) this.scene.stop(SCENES.UI);
    this.scene.launch(SCENES.UI);
    getPlatform().gameStart(); // активная партия началась (GameplayAPI)
    if (this.dailyMode) {
      this.showToast(getDailyToast(), '#ffffff');
    }
    this.time.delayedCall(0, () => this.pushHud());
  }

  // Сетка поля (пункт 2): вертикали и горизонтали ровно через cellSize.
  // cellSize пересчитывается из экрана — сетка сама подходит под окно.
  // Вызывать после computeLayout (create) и при ресайзе.
  private drawGrid(): void {
    if (!this.gridGfx) return;
    const g = this.gridGfx;
    g.clear();
    if (!gameConfig.boardGrid.show) return;
    g.lineStyle(gameConfig.boardGrid.width, gameConfig.boardGrid.color, gameConfig.boardGrid.alpha);
    const x1 = this.boardX + this.cellSize * gameConfig.boardCols;
    const y1 = this.boardY + this.cellSize * gameConfig.boardRows;
    for (let c = 0; c <= gameConfig.boardCols; c++) {
      const x = this.boardX + c * this.cellSize;
      g.lineBetween(x, this.boardY, x, y1);
    }
    for (let r = 0; r <= gameConfig.boardRows; r++) {
      const y = this.boardY + r * this.cellSize;
      g.lineBetween(this.boardX, y, x1, y);
    }
  }

  // Пункт 2: цена хода (красный минус — при ЛЮБОМ ходе) и бонус
  // равновесия (белый плюс). Поэтому минус виден всегда.
  private showCostFloaters(cost: { spent: number; bonus: number }): void {
    const ui = this.scene.get(SCENES.UI) as UIScene | null;
    if (!ui || !this.scene.isActive(SCENES.UI)) return;
    if (cost.spent > 0) ui.spawnFloater(`−${cost.spent}`, '#ff0026', 1);
    if (cost.bonus > 0) ui.spawnFloater(`+${cost.bonus}`, '#ffffff', -1);
  }
  public getBoardRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.boardX,
      y: this.boardY,
      w: this.cellSize * gameConfig.boardCols,
      h: this.cellSize * gameConfig.boardRows,
    };
  }

  // --- Управление выбором ---
  private handleClick(cell: CellPos): void {
    if (!this.selected) {
      this.selectCell(cell);
      return;
    }
    if (cell.row === this.selected.row && cell.col === this.selected.col) {
      this.clearSelection();
      this.playTap(cell.row, cell.col);
      return;
    }
    if (this.board.isNeighbor(this.selected.row, this.selected.col, cell.row, cell.col)) {
      const from = this.selected;
      this.clearSelection();
      this.playDrag(from.row, from.col, cell.row, cell.col);
      return;
    }
    this.selectCell(cell);
  }

  private selectCell(cell: CellPos): void {
    this.selected = cell;
    const pos = this.layoutPos(cell.row, cell.col);
    this.highlight.setPosition(pos.x, pos.y);
    this.highlight.setVisible(true);
  }

  private clearSelection(): void {
    this.selected = null;
    if (this.highlight) this.highlight.setVisible(false);
  }

  // --- Ходы ---
  private playTap(row: number, col: number): void {
    if (this.busy) return;
    void this.asyncTap(row, col);
  }

  private async asyncTap(row: number, col: number): Promise<void> {
    this.busy = true;
    const snap = this.board.snapshot();
    this.board.flipAt(row, col);
    this.echo.recordPlayerMove({ kind: 'tap', row, col }, snap);
    SoundSystem.play(this, 'tap');
    const gem = this.board.grid[row][col];
    if (gem) await this.animateFlipView(gem);
    await this.finishTurn(gameConfig.tapCost);
  }

  private playDrag(r1: number, c1: number, r2: number, c2: number): void {
    if (this.busy) return;
    void this.asyncDrag(r1, c1, r2, c2);
  }

  private async asyncDrag(r1: number, c1: number, r2: number, c2: number): Promise<void> {
    this.busy = true;
    const snap = this.board.snapshot();
    const gemA = this.board.grid[r1][c1];
    const gemB = this.board.grid[r2][c2];
    this.board.swapAndFlip(r1, c1, r2, c2);
    this.echo.recordPlayerMove({ kind: 'drag', r1, c1, r2, c2 }, snap);
    SoundSystem.play(this, 'drag');
    if (gemA && gemB) await this.animateSwapViews(gemA, gemB);
    await this.finishTurn(gameConfig.dragCost);
  }

  private async finishTurn(actionCost: number): Promise<void> {
    const res = await this.resolveCascades();
    this.statLines += res.lines;
    this.statMax = Math.max(this.statMax, res.max);
    // Бонус равновесия — только за результативный ход (фикс Этапа 3)
    const cost = this.timer.applyTurn(actionCost, this.balance.getDiff(), res.lines > 0);
    if (this.timer.time <= 10 && !this.timer.isExpired()) SoundSystem.play(this, 'tick');
    this.pushHud();
    this.showCostFloaters(cost);
    this.checkTiers();
    // Задача дня: цель взята — сразу победа, жать «Завершить» не надо
    if (this.dailyWinCheck()) return;
    if (this.timer.isExpired()) {
      await this.handleWorldFlip();
      return;
    }
    this.busy = false;
  }

  // Задача дня выполнена? Нужно ТОЧНОЕ равенство-цель (например ровно 62/62).
  // Больше цели — не засчитывается: перелёт мимо цели победой не считается.
  private dailyWinCheck(): boolean {
    if (!this.dailyMode) return false;
    const { light, dark } = this.balance;
    if (light === dark && light === this.dailyTarget) {
      this.goVictory(true);
      return true;
    }
    return false;
  }

  // Каскады идут ДОЧИСТА: выходим только когда линий не осталось.
  // maxCascades — страховка от бесконечного цикла (практически недостижима).
  // Раньше был жёсткий лимит 5 — длинные цепочки обрывались и готовая
  // линия 3+ оставалась лежать на поле до следующего хода.
  private async resolveCascades(): Promise<{ lines: number; max: number }> {
    let total = 0;
    let maxLen = 0;
    let round = 0;
    for (;;) {
      const lines = MatchSystem.findMatches(this.board.grid);
      if (lines.length === 0) break;
      round++;
      if (round > gameConfig.maxCascades) break; // страховка, не лимит
      total += lines.length;
      for (const line of lines) maxLen = Math.max(maxLen, line.length);
      for (const line of lines) {
        this.balance.applyLine(line.length, line.isFace);
      }
      SoundSystem.play(this, 'line');
      const gems: Gem[] = [];
      for (const cell of MatchSystem.collectCells(lines)) {
        const gem = this.board.grid[cell.row][cell.col];
        if (gem) gems.push(gem);
      }
      await this.animateClear(gems);
      this.board.removeCells(gems.map((g) => ({ row: g.row, col: g.col })));
      for (const gem of gems) this.views.delete(gem);
      this.board.collapseAndRefill();
      await this.animateFall();
      this.pushHud();
    }
    return { lines: total, max: maxLen };
  }

  private checkTiers(): void {
    const { light, dark } = this.balance;
    if (light !== dark || light <= this.bestSession) return;
    this.bestSession = light;
    let tier = -1;
    gameConfig.progressTiers.forEach((need, i) => {
      if (light >= need) tier = i;
    });
    if (tier > this.announcedTier) {
      this.announcedTier = tier;
      if (tier === 0) {
        SoundSystem.play(this, 'victory');
        // Пункт 2: крупно и 4 секунды
        this.showToast(t('tCanGo'), '#ffffff', 4000, 42);
      } else {
        SoundSystem.play(this, 'victory');
        this.showToast(t('tTier', { l: light, d: dark, name: t(`tier${tier}`) }), '#d7263d', 4000, 42);
      }
    }
  }

  // --- Эхо с призраком (GDD 2.6, 4.3) ---
  public tryEcho(): void {
    if (this.busy) return;
    if (!this.echo.canEcho()) {
      const n = this.echo.movesLeft();
      this.showToast(currentLang() === 'en' && n === 1 ? t('echoInOne', { n }) : t('echoIn', { n }), '#aaaaaa');
      return;
    }
    void this.asyncEcho();
  }

  private async asyncEcho(): Promise<void> {
    const t0 = this.time.now;
    this.busy = true;
    this.echo.useEcho();
    this.statEcho++;
    const move = this.echo.lastMove;
    const snap = this.echo.snapshot;
    if (!move || !snap) {
      this.busy = false;
      return;
    }
    SoundSystem.play(this, 'echo');

    // (1) Вспышка красным + надпись
    this.flashTo(0.35, 300);
    this.showToast(t('echo'), '#d7263d', 2200);

    // (2) Призрак настоящего + откат к прошлому
    const ghost = this.buildGhost();
    this.board.restore(snap);
    this.rebuildViews();
    this.layer.setAlpha(0.35); // прошлое проявляется...
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 700 });
    await this.wait(1200); // ...игрок видит старое поле поверх призрака

    // (3) Повтор хода (шкалы не откатывались — очки суммируются)
    if (move.kind === 'tap') {
      this.board.flipAt(move.row, move.col);
      const gem = this.board.grid[move.row][move.col];
      if (gem) await this.animateFlipView(gem);
    } else {
      const gemA = this.board.grid[move.r1][move.c1];
      const gemB = this.board.grid[move.r2][move.c2];
      this.board.swapAndFlip(move.r1, move.c1, move.r2, move.c2);
      if (gemA && gemB) await this.animateSwapViews(gemA, gemB);
    }

    // (4) Возврат к настоящему: призрак растворяется
    this.tweens.add({ targets: ghost, alpha: 0, duration: 500, onComplete: () => ghost.destroy() });
    const echoRes = await this.resolveCascades();
    this.statLines += echoRes.lines;
    this.statMax = Math.max(this.statMax, echoRes.max);
    const echoCost = this.timer.applyTurn(gameConfig.echoCost, this.balance.getDiff(), echoRes.lines > 0);
    if (this.timer.time <= 10 && !this.timer.isExpired()) SoundSystem.play(this, 'tick');
    this.pushHud();
    this.showCostFloaters(echoCost);
    this.checkTiers();
    this.flashTo(0, 400);

    const elapsed = this.time.now - t0;
    if (elapsed < gameConfig.echoAnimDuration * 1000) {
      await this.wait(gameConfig.echoAnimDuration * 1000 - elapsed);
    }
    this.clearGhost();
    if (this.dailyWinCheck()) return;
    if (this.timer.isExpired()) {
      await this.handleWorldFlip();
      return;
    }
    this.busy = false;
  }

  // Завершить можно только в момент равенства 50/50 и выше.
  // В зачёт идёт лучший результат партии (bestSession), а не текущий.
  // В задаче дня — только точная цель (например ровно 62/62):
  // сдаться через «Завершить» нельзя, для выхода есть кнопка «Выход».
  public tryFinish(): void {
    if (this.busy) return;
    const { light, dark } = this.balance;
    if (this.dailyMode) {
      if (light === dark && light === this.dailyTarget) {
        this.goVictory(true);
      } else {
        this.showToast(t('tDailyNeed', { t: this.dailyTarget }), '#aaaaaa');
      }
      return;
    }
    if (light !== dark || light < gameConfig.victoryMin) {
      this.showToast(t('tCanFinish'), '#aaaaaa');
      return;
    }
    this.goVictory(true);
  }

  // Выход в меню в любой момент: партия засчитывается как сыгранная
  // (победа — если равенство 50/50+ было хоть раз, иначе поражение).
  // В задаче дня выход = потраченная попытка без победы.
  public tryExit(): void {
    if (this.busy) {
      this.showToast(t('tWait'), '#aaaaaa', 800);
      return;
    }
    this.reportResult(this.dailyMode ? false : this.bestSession >= gameConfig.victoryMin);
    this.scene.stop(SCENES.UI);
    this.scene.start(SCENES.MAIN_MENU);
  }

  private async handleWorldFlip(): Promise<void> {
    this.worldFlips++;
    // Задача дня: лимит переворотов исчерпан — сразу провал, без переворота
    if (this.dailyMode && this.worldFlips >= this.dailyMaxFlips) {
      this.failDaily();
      return;
    }
    if (this.worldFlips >= gameConfig.maxWorldFlips) {
      SoundSystem.play(this, 'defeat');
      this.goGameOver();
      return;
    }
    this.timer.reset();
    this.drainAcc = 0; // новая жизнь — тиканье считаем заново
    SoundSystem.play(this, 'flip');
    this.flashTo(0.5, 300);
    this.showToast(t('tFlip', { n: this.worldFlips }), '#d7263d');
    this.board.flipAllSides();
    await this.animateWorldFlipViews();
    this.flashTo(0, 400);
    await this.resolveCascades();
    this.pushHud();
    this.checkTiers();
    if (this.dailyWinCheck()) return;
    this.busy = false;
  }

  // Провал задачи дня: конец сразу, победа не засчитывается
  private failDaily(): void {
    SoundSystem.play(this, 'defeat');
    this.reportResult(false);
    this.scene.stop(SCENES.UI);
    this.scene.start(SCENES.GAME_OVER, { record: this.bestSession });
  }

  // --- Анимации ---
  // Морф-переворот: 6 кадров атласа по очереди за flipAnimDuration.
  // Логика уже перевёрнута — крутим кадры от старого вида к новому
  // (лицо→изнанка: 0..5, обратно: 5..0). Подпись обновит syncAppearance.
  private playMorph(view: ViewParts, gem: Gem): Promise<void> {
    const sprite = view.img as Phaser.GameObjects.Sprite;
    const toBack = gem.side !== GEM_SIDES.FACE;
    const from = toBack ? 0 : 5;
    const to = toBack ? 5 : 0;
    const row = gem.color;
    const ms = gameConfig.flipAnimDuration * 1000;
    sprite.setTexture(TEX.SHEET, sheetFrame(row, from));
    return new Promise<void>((resolve) => {
      const proxy = { f: from };
      this.tweens.add({
        targets: proxy,
        f: to,
        duration: ms,
        onUpdate: () => {
          if (sprite.active) sprite.setFrame(sheetFrame(row, Math.round(proxy.f)));
        },
        onComplete: () => {
          if (sprite.active) sprite.setFrame(sheetFrame(row, to));
          resolve();
        },
      });
    });
  }

  // Переворот: атлас — морфинг кадрами, иначе сплющивание (вращение)
  private animateFlipView(gem: Gem): Promise<void> {
    const view = this.views.get(gem);
    if (!view) return Promise.resolve();
    if (view.kind === 'sheet' && view.img instanceof Phaser.GameObjects.Sprite) {
      return this.playMorph(view, gem).then(() => {
        if (view.root.active) this.syncAppearance(view, gem); // финал: кадр + подпись
        return undefined;
      });
    }
    const ms = (gameConfig.flipAnimDuration * 1000) / 2;
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.root,
        scaleX: 0,
        duration: ms,
        onComplete: () => {
          this.syncAppearance(view, gem);
          this.tweens.add({ targets: view.root, scaleX: 1, duration: ms, onComplete: () => resolve() });
        },
      });
    });
  }

  private animateSwapViews(gemA: Gem, gemB: Gem): Promise<void> {
    const viewA = this.views.get(gemA);
    const viewB = this.views.get(gemB);
    if (!viewA || !viewB) {
      this.syncAllAppearances();
      return Promise.resolve();
    }
    const posA = this.layoutPos(gemA.row, gemA.col);
    const posB = this.layoutPos(gemB.row, gemB.col);
    const ms = gameConfig.dragAnimDuration * 1000;
    // Атлас: морфы обоих стартуют сразу параллельно с движением.
    // Остальные — мгновенная смена вида в середине пути.
    const morphs: Promise<void>[] = [];
    let morphA = false;
    let morphB = false;
    if (viewA.kind === 'sheet' && viewA.img instanceof Phaser.GameObjects.Sprite) {
      morphs.push(this.playMorph(viewA, gemA));
      morphA = true;
    }
    if (viewB.kind === 'sheet' && viewB.img instanceof Phaser.GameObjects.Sprite) {
      morphs.push(this.playMorph(viewB, gemB));
      morphB = true;
    }
    if (!morphA || !morphB) {
      this.time.delayedCall(ms / 2, () => {
        if (!morphA) this.syncAppearance(viewA, gemA);
        if (!morphB) this.syncAppearance(viewB, gemB);
      });
    }
    return new Promise<void>((resolve) => {
      let done = 0;
      const one = () => {
        done++;
        if (done === 2) {
          // Финал, когда доехали и доморфили: кадры/картинки + подписи
          Promise.all(morphs).then(() => {
            this.syncAppearance(viewA, gemA);
            this.syncAppearance(viewB, gemB);
            resolve();
          });
        }
      };
      this.tweens.add({ targets: viewA.root, x: posA.x, y: posA.y, duration: ms, onComplete: one });
      this.tweens.add({ targets: viewB.root, x: posB.x, y: posB.y, duration: ms, onComplete: one });
    });
  }

  private animateClear(gems: Gem[]): Promise<void> {
    if (gems.length === 0) return Promise.resolve();
    const ms = gameConfig.lineClearDuration * 1000;
    const jobs = gems.map((gem) => {
      const view = this.views.get(gem);
      if (!view) return Promise.resolve();
      // Вспышка белым: у спрайта — тинт картинки, у графики — заливка
      if (view.img) view.img.setTintFill(0xffffff);
      else view.bg.setFillStyle(gameConfig.colors.white, 1);
      return new Promise<void>((resolve) => {
        this.tweens.add({
          targets: view.root,
          alpha: 0,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: ms,
          onComplete: () => {
            view.root.destroy();
            resolve();
          },
        });
      });
    });
    return Promise.all(jobs).then(() => undefined);
  }

  private animateFall(): Promise<void> {
    const ms = gameConfig.fallDuration * 1000;
    const jobs: Promise<void>[] = [];
    for (let r = 0; r < gameConfig.boardRows; r++) {
      for (let c = 0; c < gameConfig.boardCols; c++) {
        const gem = this.board.grid[r][c];
        if (!gem) continue;
        const pos = this.layoutPos(r, c);
        let view = this.views.get(gem);
        if (!view) {
          view = this.createView(gem, pos.x, this.boardY - this.cellSize);
        }
        jobs.push(
          new Promise<void>((resolve) => {
            this.tweens.add({
              targets: view!.root,
              x: pos.x,
              y: pos.y,
              duration: ms,
              ease: 'Bounce.easeOut',
              onComplete: () => resolve(),
            });
          }),
        );
      }
    }
    return Promise.all(jobs).then(() => undefined);
  }

  // Переворот мира волной: мир призрачный, камни переворачиваются
  // по очереди слева направо, сверху вниз (просьба игрока, Этап 3).
  private animateWorldFlipViews(): Promise<void> {
    this.layer.setAlpha(0.55); // мир становится призрачным
    const staggerMs = gameConfig.worldFlipStagger * 1000;
    const jobs: Promise<void>[] = [];
    for (let r = 0; r < gameConfig.boardRows; r++) {
      for (let c = 0; c < gameConfig.boardCols; c++) {
        const gem = this.board.grid[r][c];
        if (!gem) continue;
        const order = r * gameConfig.boardCols + c;
        jobs.push(
          (async () => {
            await this.wait(order * staggerMs);
            await this.animateFlipView(gem);
          })(),
        );
      }
    }
    return Promise.all(jobs).then(() => {
      this.layer.setAlpha(1); // мир снова плотный
      return undefined;
    });
  }

  // Задача дня — строкой прямо над полем (только в daily-режиме).
  // Положение пересчитывается от раскладки (ресайз — в handleResize).
  private makeDailyLabel(): void {
    this.dailyLabel?.destroy();
    this.dailyLabel = undefined;
    if (!this.dailyMode) return;
    this.dailyLabel = this.add.text(
      0, 0,
      taskText({ target: this.dailyTarget, maxFlips: this.dailyMaxFlips, attempts: 0 }),
      {
        color: '#ffffff', fontSize: '20px', align: 'center',
        wordWrap: { width: this.cellSize * gameConfig.boardCols },
      },
    ).setOrigin(0.5, 1);
    this.layoutDailyLabel();
  }

  private layoutDailyLabel(): void {
    if (!this.dailyLabel) return;
    const cx = this.boardX + (this.cellSize * gameConfig.boardCols) / 2;
    this.dailyLabel.setPosition(cx, this.boardY - 10);
  }

  // --- Виды камней ---
  private layoutPos(row: number, col: number): { x: number; y: number } {
    return {
      x: this.boardX + col * this.cellSize + this.cellSize / 2,
      y: this.boardY + row * this.cellSize + this.cellSize / 2,
    };
  }

  private createView(gem: Gem, x?: number, y?: number): ViewParts {
    const pos = x === undefined || y === undefined ? this.layoutPos(gem.row, gem.col) : { x, y };
    const size = this.cellSize * 0.92;
    const bg = this.add.rectangle(0, 0, size, size);
    const dot = this.add.circle(0, -size * 0.1, size * 0.11);
    // Подпись стороны: лицом «СВЕТ», изнанкой «ТЬМА»
    const label = this.add.text(0, size * 0.26, '', {
      fontSize: `${Math.max(9, Math.round(this.cellSize * 0.16))}px`,
      align: 'center',
    });
    label.setOrigin(0.5);
    // Картинка: приоритет — атлас морфа, запас — одиночный файл,
    // иначе программная графика. Всё в try/catch: чёрного экрана
    // из-за картинок быть не должно никогда.
    const texKey = `gem_${gem.color}_${gem.side}`;
    const idleFrame = gem.side === GEM_SIDES.FACE ? 0 : 5;
    const sideName = gem.side === GEM_SIDES.FACE ? 'face' : 'back';
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined;
    let kind: 'sheet' | 'mystic' | 'stone' | 'image' | 'none' = 'none';
    let children: Phaser.GameObjects.GameObject[];
    try {
      const skin = effectiveSkin();
      if (skin === 'mystic' && hasMysticFrame(this, gem.color, sideName)) {
        // Мистический сет (v2) — мгновенная смена, без промежуточных
        const sprite = this.add.sprite(0, 0, TEX.MYSTIC, mysticFrame(gem.color, sideName));
        sprite.setDisplaySize(size, size);
        img = sprite;
        kind = 'mystic';
      } else if (skin === 'stone' && hasStoneFrame(this, gem.color, sideName)) {
        // Каменный сет (v3) — то же самое
        const sprite = this.add.sprite(0, 0, TEX.STONE, stoneFrame(gem.color, sideName));
        sprite.setDisplaySize(size, size);
        img = sprite;
        kind = 'stone';
      } else if (hasSheetFrame(this, gem.color, idleFrame)) {
        const sprite = this.add.sprite(0, 0, TEX.SHEET, sheetFrame(gem.color, idleFrame));
        sprite.setDisplaySize(size, size);
        img = sprite;
        kind = 'sheet';
      }
    } catch (err) {
      console.warn('[GameScene] не смог создать спрайт из атласа', err);
    }
    if ((kind === 'sheet' || kind === 'mystic' || kind === 'stone') && img) {
      children = [img, bg, dot, label];
    } else if (gameConfig.useSprites && this.textures.exists(texKey)) {
      const image = this.add.image(0, 0, texKey);
      image.setDisplaySize(size, size);
      img = image;
      kind = 'image';
      children = [img, bg, dot, label];
    } else {
      children = [bg, dot, label];
    }
    const root = this.add.container(pos.x, pos.y, children);
    this.layer.add(root);
    const view: ViewParts = { root, bg, dot, label, img, size, kind };
    this.syncAppearance(view, gem);
    this.views.set(gem, view);
    return view;
  }

  // Вид камня по режиму (kind из createView):
  // - sheet: кадр атласа морфа (0 = лицо, 5 = изнанка), рамки/точки в картинке;
  // - mystic/stone: мгновенная смена кадра своего атласа;
  // - image: одиночный файл, переключается целиком;
  // - none: программная графика по таблице GDD 4.2.
  // Подписи — поверх всего. Кадр/картинка ОБЯЗАНЫ следить за стороной
  // (багфикс: иначе рассинхрон картинки и логики).
  private syncAppearance(view: ViewParts, gem: Gem): void {
    const isFace = gem.side === GEM_SIDES.FACE;
    // Цвет подписи (контраст) считаем всегда, даже под картинкой
    const fill = isFace
      ? gem.color === 'red'
        ? gameConfig.colors.red
        : gem.color === 'white'
          ? gameConfig.colors.white
          : gameConfig.colors.black
      : gameConfig.colors.black;
    if (view.kind === 'sheet') {
      const sprite = view.img as Phaser.GameObjects.Sprite | undefined;
      const idle = isFace ? 0 : 5;
      if (sprite && hasSheetFrame(this, gem.color, idle)) {
        try {
          // Спокойный кадр по стороне (морф анимацией — в playMorph)
          sprite.setTexture(TEX.SHEET, sheetFrame(gem.color, idle));
        } catch (err) {
          console.warn('[GameScene] битый кадр атласа, рисую программно', err);
          view.kind = 'none';
        }
      } else {
        view.kind = 'none';
      }
    }
    if (view.kind === 'mystic' || view.kind === 'stone') {
      // Мгновенные сеты (v2/v3): кадр своего атласа, промежуточных нет
      const sprite = view.img as Phaser.GameObjects.Sprite | undefined;
      const sideName = isFace ? 'face' : 'back';
      const tex = view.kind === 'mystic' ? TEX.MYSTIC : TEX.STONE;
      const frame = view.kind === 'mystic'
        ? mysticFrame(gem.color, sideName)
        : stoneFrame(gem.color, sideName);
      const ok = view.kind === 'mystic'
        ? hasMysticFrame(this, gem.color, sideName)
        : hasStoneFrame(this, gem.color, sideName);
      if (sprite && ok) {
        try {
          sprite.setTexture(tex, frame);
        } catch (err) {
          console.warn('[GameScene] битый кадр сета, рисую программно', err);
          view.kind = 'none';
        }
      } else {
        view.kind = 'none';
      }
    }
    if (view.kind === 'image') {
      const texKey = `gem_${gem.color}_${gem.side}`;
      if (!view.img && gameConfig.useSprites && this.textures.exists(texKey)) {
        view.img = this.add.image(0, 0, texKey);
        view.root.add(view.img);
        view.root.sendToBack(view.img);
      }
      if (view.img) {
        try {
          view.img.setTexture(texKey); // картинка следит за стороной
        } catch (err) {
          console.warn(`[GameScene] битая текстура ${texKey}, рисую программно`, err);
          view.kind = 'none';
        }
      } else {
        view.kind = 'none';
      }
    }
    if (view.kind === 'none') {
      // Программная графика (или откат после битых данных)
      if (view.img) view.img.setVisible(false);
      view.bg.setVisible(true);
      view.bg.setFillStyle(fill, 1);
      view.bg.setStrokeStyle(3, isFace ? gameConfig.colors.white : gameConfig.colors.red);
      if (!isFace && gem.color !== 'black') {
        view.dot.setVisible(true);
        view.dot.setFillStyle(gem.color === 'red' ? gameConfig.colors.red : gameConfig.colors.white);
      } else {
        view.dot.setVisible(false);
      }
    } else if (view.img) {
      // Картинка (атлас или файл): свои рамка и метки — наши прячем
      view.img.clearTint();
      view.img.setVisible(true);
      view.img.setDisplaySize(view.size, view.size); // любой квадрат подойдёт
      view.bg.setVisible(false);
      view.dot.setVisible(false);
    }
    view.root.setScale(1);
    view.root.setAlpha(1);
    // Подпись стороны контрастным цветом (палитра: чёрный/белый/красный).
    // Видимость — тумблер из настроек (пункт 2, применяется с новой партии).
    view.label.setText(isFace ? t('lightTag') : t('darkTag'));
    view.label.setVisible(loadLabelsEnabled());
    if (fill === gameConfig.colors.white) {
      view.label.setColor('#000000');
    } else {
      view.label.setColor('#ffffff');
    }
  }

  private buildAllViews(): void {
    for (let r = 0; r < gameConfig.boardRows; r++) {
      for (let c = 0; c < gameConfig.boardCols; c++) {
        const gem = this.board.grid[r][c];
        if (gem) this.createView(gem);
      }
    }
  }

  private rebuildViews(): void {
    this.layer.removeAll(true);
    this.views.clear();
    this.buildAllViews();
  }

  private syncAllAppearances(): void {
    for (const [gem, view] of this.views) {
      this.syncAppearance(view, gem);
    }
  }

  // Призрак Эхо: полупрозрачная копия текущего поля (GDD 4.3)
  private buildGhost(): Phaser.GameObjects.Container {
    this.clearGhost();
    const ghost = this.add.container(0, 0);
    for (const [, view] of this.views) {
      const size = this.cellSize * 0.92;
      if (view.img instanceof Phaser.GameObjects.Sprite) {
        // Призрак любой картинки: та же текстура с тем же кадром
        const copy = this.add.image(view.root.x, view.root.y, view.img.texture.key, view.img.frame.name);
        copy.setDisplaySize(size, size);
        ghost.add(copy);
      } else if (view.img) {
        // Спрайт: копируем картинку тем же ключом
        const copy = this.add.image(view.root.x, view.root.y, view.img.texture.key);
        copy.setDisplaySize(size, size);
        ghost.add(copy);
      } else {
        const copy = this.add.rectangle(view.root.x, view.root.y, size, size, view.bg.fillColor);
        copy.setStrokeStyle(2, gameConfig.colors.red);
        ghost.add(copy);
      }
    }
    ghost.setAlpha(0.4);
    this.ghostLayer.add(ghost);
    return ghost;
  }

  private clearGhost(): void {
    this.ghostLayer.removeAll(true);
  }

  private makeHighlight(): void {
    this.highlight = this.add.rectangle(0, 0, this.cellSize * 0.98, this.cellSize * 0.98);
    this.highlight.setStrokeStyle(4, gameConfig.colors.red);
    this.highlight.setVisible(false);
    this.topLayer.add(this.highlight);
  }

  // Пункт 3: красная вспышка (Эхо, переворот мира) — ТОЛЬКО на поле
  // с камнями, а не на весь экран. Геометрия — из getBoardRect().
  private makeFlash(): void {
    const rect = this.getBoardRect();
    this.flashRect = this.add.rectangle(
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
      rect.w,
      rect.h,
      gameConfig.colors.red,
    );
    this.flashRect.setAlpha(0);
    this.topLayer.add(this.flashRect);
  }

  // --- Мелочи ---
  private computeLayout(): void {
    const fullW = this.scale.width;
    const h = this.scale.height;
    // Пункт 1: поле в полосе по центру, фон и вспышка — на весь экран
    const w = Math.min(fullW, gameConfig.contentMaxWidth);
    const topMargin = 110;
    const bottomMargin = 150;
    const sideMargin = 64; // место под шкалы Света/Тьмы (Этап 3)
    this.cellSize = Math.min(
      (w - sideMargin * 2) / gameConfig.boardCols,
      (h - topMargin - bottomMargin) / gameConfig.boardRows,
    );
    this.boardX = (fullW - this.cellSize * gameConfig.boardCols) / 2;
    this.boardY = topMargin + (h - topMargin - bottomMargin - this.cellSize * gameConfig.boardRows) / 2;
  }

  private handleResize(): void {
    if (!this.layer) return;
    // Сброс незавершённого жеста: иначе pointerup после ресайза кривой
    this.pressStart = null;
    this.pressDragged = false;
    this.computeLayout();
    this.bgObj?.destroy();
    this.bgObj = addBackground(this, TEX.GAME_BG, 'top');
    this.clearSelection();
    this.clearGhost();
    this.rebuildViews(); // новые размеры и шрифты подписей
    this.buildAmbient(); // круги пульса за новым полем
    this.drawGrid(); // сетка за новым шагом клеток (пункт 2)
    // Рамка выбора и вспышка — под новый размер (вспышка — строго поле)
    this.highlight.destroy();
    this.makeHighlight();
    this.flashRect.destroy();
    this.makeFlash();
    this.layoutDailyLabel(); // задача над полем — за новой геометрией
    this.pushHud(); // UIScene перерисует шкалы по новому прямоугольнику
  }

  private screenToCell(x: number, y: number): CellPos | null {
    const col = Math.floor((x - this.boardX) / this.cellSize);
    const row = Math.floor((y - this.boardY) / this.cellSize);
    if (row < 0 || row >= gameConfig.boardRows || col < 0 || col >= gameConfig.boardCols) {
      return null;
    }
    return { row, col };
  }

  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private flashTo(alpha: number, ms: number): void {
    this.tweens.add({ targets: this.flashRect, alpha, duration: ms });
  }

  // Всплывающее сообщение. Пункт 2: размер и длительность задаются
  // (ранги — крупно и 4 сек, остальные мелочи — как раньше).
  private showToast(text: string, color = '#ffffff', holdMs = 1600, fontSize = 30): void {
    const toast = this.add.text(this.scale.width / 2, this.scale.height * 0.35, text, {
      color,
      fontSize: `${fontSize}px`,
      align: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 16, y: 10 },
    });
    toast.setOrigin(0.5);
    toast.setAlpha(0);
    this.topLayer.add(toast);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 250,
      onComplete: () => {
        this.time.delayedCall(holdMs, () => {
          this.tweens.add({ targets: toast, alpha: 0, duration: 300, onComplete: () => toast.destroy() });
        });
      },
    });
  }

  private pushHud(): void {
    const ui = this.scene.get(SCENES.UI) as UIScene | null;
    if (ui && this.scene.isActive(SCENES.UI)) {
      ui.updateHud(
        this.balance.light,
        this.balance.dark,
        Math.ceil(this.timer.time),
        this.worldFlips,
        this.echo.canEcho(),
        this.echo.movesLeft(),
        // Завершить активна только в момент равенства 50/50 и выше
        this.balance.light === this.balance.dark && this.balance.light >= gameConfig.victoryMin,
      );
    }
  }

  // Круги пульса: В КРУГЕ ЗАТМЕНИЯ на баннере (eclipseGeom),
  // радиусы — доли радиуса круга. Нет баннера — старый центр поля.
  // Белые — красятся под лидера (белый/красный) при смене перекоса.
  private buildAmbient(): void {
    this.ambientGlows = [];
    if (!this.ambient) return;
    this.ambient.removeAll(true);
    const e = eclipseGeom(this);
    let cx: number;
    let cy: number;
    let base: number;
    if (e) {
      cx = e.x;
      cy = e.y;
      base = e.r * 2; // диаметр круга
    } else {
      const rect = this.getBoardRect();
      cx = rect.x + rect.w / 2;
      cy = rect.y + rect.h / 2;
      base = Math.min(rect.w, rect.h);
    }
    const radii = [0.38, 0.55, 0.7];
    const alphas = [0.14, 0.08, 0.045];
    for (let i = 0; i < 3; i++) {
      const c = this.add.circle(cx * 1.02, cy * 0.71, base * radii[i], 0xffffff, alphas[i]);
      this.ambient.add(c);
      this.ambientGlows.push(c);
    }
  }

  // Пульс фона каждый кадр: при перекосе — дышит светом лидера
  // (белым за Свет, красным за Тьму), в равновесии — гаснет.
  // Плюс тиканье сложного уровня: время тает в реальном времени.
  update(_now: number, delta: number): void {
    this.tickDrain(delta);
    if (!this.ambient || !this.balance) return;
    const diff = this.balance.light - this.balance.dark;
    const side: 'light' | 'dark' | 'none' = diff === 0 ? 'none' : diff > 0 ? 'light' : 'dark';
    if (side === 'none') {
      this.ambient.setVisible(false);
      this.lastAmbient = 'none';
      return;
    }
    this.ambient.setVisible(true);
    if (side !== this.lastAmbient) {
      this.lastAmbient = side;
      // Красим круги, прозрачность каждого сохраняем (иначе станут сплошными)
      const tint = side === 'light' ? 0xffffff : gameConfig.colors.red;
      const alphas = [0.1, 0.06, 0.035];
      for (let i = 0; i < this.ambientGlows.length; i++) {
        this.ambientGlows[i].setFillStyle(tint, alphas[i] ?? 0.05);
      }
    }
    // Дыхание: прозрачность всего кокона волной
    const a = 0.55 + 0.45 * Math.sin(this.time.now / 450);
    this.ambient.setAlpha(a);
  }

  // Сложный уровень: каждые N секунд РЕАЛЬНОГО времени сгорает M секунд
  // игрового (числа — в difficulty.json). Если время вышло в простое —
  // переворот мира наступает сразу, ждать следующего хода не надо.
  private tickDrain(deltaMs: number): void {
    if (this.over || !this.timer) return;
    const drain = difficultyDrain();
    if (!drain) {
      this.drainAcc = 0;
      return;
    }
    this.drainAcc += deltaMs / 1000;
    let ticks = 0;
    while (this.drainAcc >= drain.everySec && ticks < 10) {
      this.drainAcc -= drain.everySec;
      ticks++;
    }
    if (ticks === 0) return;
    this.timer.time = Math.max(0, this.timer.time - drain.amount * ticks);
    const ui = this.scene.get(SCENES.UI) as UIScene | null;
    if (ui && this.scene.isActive(SCENES.UI)) {
      ui.spawnFloater(`−${drain.amount * ticks}`, '#ff0026', 1);
    }
    this.pushHud();
    if (this.timer.isExpired() && !this.busy) {
      this.busy = true;
      void this.handleWorldFlip();
    }
  }

  // Финал партии: обычная — в статистику и рекорд, дня — в задачу дня
  // (плюс в счётчики сыгранных/пройденных задач — иначе рекорды и ачивки молчат).
  // Вызывается один раз: повторные вызовы (двойные клики) игнорируются.
  private reportResult(won: boolean): void {
    if (this.over) return;
    this.over = true;
    getPlatform().gameStop(); // партия кончилась (вызывается один раз)
    notifyGameEnded(); // следующее меню — пауза для полноэкранной
    getPlatform().saveCloud(); // итог в облако (с дебаунсом, тихо)
    if (this.dailyMode) {
      finishDaily(won, this.bestSession);
      const d = recordDaily(won);
      syncAchievements(d);
      return;
    }
    saveBest(this.bestSession);
    incGames();
    const s = recordGame({
      record: this.bestSession,
      lines: this.statLines,
      maxLine: this.statMax,
      echoUses: this.statEcho,
    });
    getPlatform().submitScore(s.bestRound); // рекорд на доску Яндекса (тихо)
    syncAchievements(s);
  }

  private goVictory(won = true): void {
    this.reportResult(won);
    this.scene.stop(SCENES.UI);
    this.scene.start(SCENES.VICTORY, { record: this.bestSession });
  }

  private goGameOver(): void {
    // Победа засчитывается, если равенство 50/50+ было хоть раз
    this.reportResult(this.bestSession >= gameConfig.victoryMin);
    this.scene.stop(SCENES.UI);
    this.scene.start(SCENES.GAME_OVER, { record: this.bestSession });
  }
}
