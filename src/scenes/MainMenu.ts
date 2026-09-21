// ============================================================
// MainMenu — по документу Main_menu.md (заменяет старый GDD 3.2).
// Единый экран без прокрутки, фон чёрный:
// шапка | рейтинг слева | кнопки в центре | рекорды справа |
// задача дня + достижения | награды недели.
// Ландшафт — 3 колонки, портрет — компактная стопка.
// Данные локальные (+ фиктивный рейтинг); облако — на Этапе 4.
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { gameConfig } from '../config/gameConfig';
import { loadStats, touchLogin, addRewardClaim } from '../utils/stats';
import { ACHIEVEMENTS, loadUnlocked, syncAchievements, countUnlocked, achTitle, achGroup } from '../systems/Achievements';
import {
  dayStr, yesterdayStr, dailySeed, getDaily, playDaily, grantDailyAttempt,
  dailyAttemptsTotal, isDailyAvailable, rewardStatus, claimReward,
  rewardTexts, taskText, attemptsText, getRewardDays,
} from '../utils/daily';
import { SoundSystem } from '../systems/SoundSystem';
import { getPlatform, platformReady, consumeGameEnded } from '../utils/platform';
import type { RatingRow } from '../utils/rating';
import { addBackground, addDivider, TEX, hasStoneFrame, hasMysticFrame, stoneFrame, mysticFrame, langTex } from '../utils/assets';
import { t, skinName } from '../utils/lang';
import {
  isSkinUnlocked, unlockStreak, checkSkinUnlocks, starCount, maxStars,
  type SkinId,
} from '../utils/skins';
interface Button {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class MainMenu extends Phaser.Scene {
  private countdownText?: Phaser.GameObjects.Text;
  // Пункт 1: полоса контента на широких экранах (фон — на весь экран)
  private bx = 0; // левый край полосы
  private bw = 0; // ширина полосы
  private cx = 0; // центр полосы (= центр экрана)
  // Низ блока топа — рекорды тянутся ровно под него (пункт 1)
  private ratingBottom = 0;
  // Низ полосы наград — для проверки переполнения маленьких экранов
  private rewardsBottom = 0;
  // Ориентация по ПОЛНОМУ экрану (полоса уже — её пропорции врут)
  private isLandscape = true;
  // Ссылки для точечного обновления без перезагрузки меню (пункт 3)
  private menuToken = 0; // защита асинхронного топа от рестарта сцены
  private rw?: {
    streak: Phaser.GameObjects.Text;
    cells: { box: Phaser.GameObjects.Rectangle; mark: Phaser.GameObjects.Text }[];
    pos: number;
    pulse?: Phaser.Tweens.Tween;
    claimRoot: Phaser.GameObjects.Container;
    claimBg: Phaser.GameObjects.Rectangle;
    claimTx: Phaser.GameObjects.Text;
    claimGlow: Phaser.GameObjects.Rectangle[];
    // Звёзды серии: в ячейках (летят в ряд при заборе) и в ряду над полосой
    cellStar: (Phaser.GameObjects.Image | undefined)[];
    rowStars: Phaser.GameObjects.Image[];
    skinGem: Map<number, Phaser.GameObjects.Image>; // день -> камень скина (7/14)
    starSlotStep: number; // шаг ряда звёзд (слоты центрируются по количеству)
    starSlotY: number;
    starSlotSize: number;
    cellStarSize: number;
  };
  private ar?: {
    header: Phaser.GameObjects.Text;
    panel: Phaser.GameObjects.Container;
    rows: Phaser.GameObjects.GameObject[];
    panelW: number;
    panelH: number;
    bodySize: number;
  };

  constructor() {
    super(SCENES.MAIN_MENU);
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const landscape = w >= h * 0.85;
    this.isLandscape = landscape;

    // Пункт 1: контент — в полосе по центру, фон — на весь экран
    this.bw = Math.min(w, gameConfig.contentMaxWidth);
    this.bx = (w - this.bw) / 2;
    this.cx = w / 2;
    const fw = this.bw;

    // Фон через хелпер (пункт 6): сейчас чёрный, позже — картинка
    addBackground(this);

    // Пункт 1: главный фон с ФИКСИРОВАННОЙ шириной (полоса контента),
    // высота — по пропорциям, центр экрана. Чёрное вокруг сливается.
    if (this.textures.exists(TEX.MM_BG)) {
      const bg = this.add.image(w / 2, h / 2 - 120, TEX.MM_BG);
      const bw = Math.min(w, gameConfig.contentMaxWidth);
      bg.setDisplaySize(bw * 1.1, (bw * bg.height*1.3) / bg.width); // ширина фикс., высота по пропорциям
      bg.setDepth(-99);
    }

    // Серия входов (для наград и достижений)
    touchLogin(dayStr(), yesterdayStr());
    const stats = loadStats();
    syncAchievements(stats);
    // Площадка: игра загрузилась (LoadingAPI), активного геймплея в меню нет.
    // Вернулись с партии — естественная пауза: полноэкранная (не чаще паузы).
    platformReady();
    getPlatform().gameStop();
    if (consumeGameEnded()) {
      getPlatform().showFullscreenAdvThrottled(() => { /* меню уже стоит */ });
    }

    // Шрифты под ширину полосы (на широких не раздуваются)
    const titleSize = Math.max(24, Math.min(52, Math.round(fw * 0.045)));
    const headSize = Math.max(13, Math.min(20, Math.round(fw * 0.018)));
    const bodySize = Math.max(12, Math.min(19, Math.round(fw * 0.016)));

    // Зоны для каскадного появления (документ 3.2.11)
    const zoneTitle = this.add.container(0, 0);
    const zoneRating = this.add.container(0, 0);
    const zoneButtons = this.add.container(0, 0);
    const zoneRecords = this.add.container(0, 0);
    const zoneMid = this.add.container(0, 0);
    const zoneRewards = this.add.container(0, 0);
    for (const z of [zoneTitle, zoneRating, zoneButtons, zoneRecords, zoneMid, zoneRewards]) {
      z.setAlpha(0);
    }

    this.buildTitle(zoneTitle, w, h, titleSize, headSize);
    // Разблокировки задним числом: пороги в skins.json могли понизить
    // уже после набранной серии — проверяем при каждом открытии меню,
    // ДО отрисовки ячеек (иначе камень останется в ячейке до перезахода)
    const preUnlocked = checkSkinUnlocks(rewardStatus().streak);
    if (landscape) {
      this.buildRating(zoneRating, fw, h, headSize, bodySize, 10);
      this.buildButtons(zoneButtons, fw, h, bodySize);
      this.buildRecords(zoneRecords, fw, h, headSize, bodySize, stats);
      this.buildMidPanels(zoneMid, fw, h, headSize, bodySize);
      this.buildRewards(zoneRewards, fw, h, headSize, bodySize);
    } else {
      this.buildButtons(zoneButtons, fw, h, bodySize);
      this.buildRating(zoneRating, fw, h, headSize, bodySize, 10);
      this.buildRecords(zoneRecords, fw, h, headSize, bodySize, stats, true);
      this.buildMidPanels(zoneMid, fw, h, headSize, bodySize);
      this.buildRewards(zoneRewards, fw, h, headSize, bodySize);
    }

    // Пункт 5: защита — низ наград не уезжает за экран.
    // rewardsBottom запоминается в buildRewards.
    // Тост о разблокировке задним числом (см. выше) — поверх всего
    preUnlocked.forEach((s, i) => this.showSkinUnlockToast(s, i));
    const overflow = Math.max(0, this.rewardsBottom - (h - 6));
    if (overflow > 0) {
      zoneMid.y -= overflow;
      zoneRewards.y -= overflow;
    }

    // Появление зон по таймингу 3.2.11 + мягкий щелчок
    const steps: [Phaser.GameObjects.Container, number][] = [
      [zoneTitle, 300], [zoneRating, 900], [zoneButtons, 1200],
      [zoneRecords, 1500], [zoneMid, 1800], [zoneRewards, 2100],
    ];
    for (const [zone, ms] of steps) {
      this.time.delayedCall(ms, () => {
        SoundSystem.play(this, 'tap');
        this.tweens.add({ targets: zone, alpha: 1, duration: 400 });
      });
    }
    // Кнопки внутри зоны — каскадом (доп. задержка уже внутри buildButtons)
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  // --- Зона 1: заголовок ---
  // Пункт 1: логотип-картинка вместо прописного названия.
  // РАЗМЕР И КООРДИНАТЫ — ЗДЕСЬ: ширина = min(400, полоса*0.8),
  // высота по пропорциям обрезанного файла (1297x961), центр cyLogo.
  // Нет файла — старый текстовый вариант (ниже, закомментирован фолбэк).
  private buildTitle(zone: Phaser.GameObjects.Container, w: number, h: number, titleSize: number, headSize: number): void {
    const landscape = this.isLandscape;
    const cy = landscape ? h * 0.06 : h * 0.045;
    if (this.textures.exists(TEX.MM_TITLE)) {
      // Логотип натурального размера (без множителей — они и ломали вёрстку).
      // Ширина упёрта в потолок, высота по пропорциям, центр cyLogo.
      // Картинка — на текущем языке (game_title.png / game_title_en.png).
      // Пропорции у файлов разные — высоту считаем по факту текстуры.
      const logoKey = langTex(TEX.MM_TITLE, TEX.MM_TITLE_EN);
      const lw = Math.min(gameConfig.logoMaxWidth, w);
      const logoSrc = this.textures.get(logoKey).getSourceImage() as { width: number; height: number };
      const lh = (lw * (logoSrc.height || 519)) / (logoSrc.width || 1297);
      const cyLogo = lh / 2 + 10; // выше к верху (пункт 1)
      const logo = this.add.image(this.cx, cyLogo, logoKey);
      logo.setDisplaySize(lw, lh);
      // ── две части подзаголовка (твой двухцветный вариант сохранён) ──
      const subY = cyLogo + lh / 2 + 10;
      const fontCfg = {
        fontSize: `${headSize}px`,
        fontStyle: 'italic',
        fontFamily: 'Arial, sans-serif',
      };

      const t1 = this.add.text(0, 0, t('logoA'), { ...fontCfg, color: '#ffffff' }).setOrigin(0, 0.5);
      const t2 = this.add.text(0, 0, t('logoB'), { ...fontCfg, color: '#ff2a2a' }).setOrigin(0, 0.5);

      const totalW = t1.width + t2.width;
      const startX = this.cx - totalW / 2;

      t1.setPosition(startX, subY).setAlpha(0.7);
      t2.setPosition(startX + t1.width, subY).setAlpha(0.7);
      // ──────────────────────────────────────────────────────────

      zone.add([logo, t1, t2]);
      // Эмблемы у краёв логотипа (без множителей — стоят ровно)
      if (this.textures.exists(TEX.MM_TITLE_L) && this.textures.exists(TEX.MM_TITLE_R)) {
        const embH = titleSize * 3.4;
        const gap = lw / 1.3; // впритык между строками и логотипом
        const left = this.add.image(this.cx - gap, cyLogo, TEX.MM_TITLE_L);
        left.setDisplaySize(embH * 0.46, embH); // пропорции 110x240
        const right = this.add.image(this.cx + gap, cyLogo, TEX.MM_TITLE_R);
        right.setDisplaySize(embH * 0.46, embH);
        zone.add([left, right]);
      }
      return;
    }
    const title = this.add
      .text(this.cx, cy, t('gameTitle'), { color: '#ffffff', fontSize: `${titleSize}px` })
      .setOrigin(0.5);
    // Разделитель 60% ширины названия, пульс 0.6–1.0, период 2 сек
    const lineW = Math.min(w * 0.6, title.width * 0.6 + 40);
    // Пункт 1: линия и пульсирует, и растягивается-сжимается (период 2 сек).
    // Через хелпер (пункт 6): позже сюда встанет картинка без смены кода.
    const line = addDivider(this, this.cx, cy + titleSize * 1.5, lineW);
    this.tweens.add({
      targets: line, alpha: 0.4, scaleX: 0.85, duration: 1000,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const sub = this.add
      .text(this.cx, cy + titleSize * 0.9 + 48, t('logoSub'), {
        color: '#ffffff', fontSize: `${headSize}px`, fontStyle: 'italic',
      })
      .setOrigin(0.5);
    sub.setAlpha(0.7);
    zone.add([title, line, sub]);

    // Пункт 4: эмблемы слева и справа от названия, равно от центра.
    // Второй слой после фона. Нет файлов — просто нет эмблем.
    if (this.textures.exists(TEX.MM_TITLE_L) && this.textures.exists(TEX.MM_TITLE_R)) {
      const embH = titleSize * 2.4;
      const gap = title.width / 2 + embH * 0.9;
      const left = this.add.image(this.cx - gap, cy, TEX.MM_TITLE_L);
      left.setDisplaySize(embH * 0.46, embH); // пропорции 110x240
      const right = this.add.image(this.cx + gap, cy, TEX.MM_TITLE_R);
      right.setDisplaySize(embH * 0.46, embH);
      zone.add([left, right]);
    }
  }

  // --- Кнопка: прямоугольник + текст, ховер и нажатие ---
  private makeButton(
    x: number, y: number, bw: number, bh: number, label: string,
    primary: boolean, fontSize: number, onClick: () => void,
  ): Button {
    const bg = this.add.rectangle(0, 0, bw, bh, primary ? 0xffffff : 0x000000);
    if (!primary) bg.setStrokeStyle(2, 0xffffff);
    const text = this.add
      .text(0, 0, label, {
        color: primary ? '#000000' : '#ffffff',
        fontSize: `${fontSize}px`,
      })
      .setOrigin(0.5);
    const root = this.add.container(x, y, [bg, text]);
    root.setSize(bw, bh);
    root.setInteractive({ useHandCursor: true });
    root.on('pointerover', () => bg.setStrokeStyle(3, gameConfig.colors.red));
    root.on('pointerout', () => {
      if (!primary) bg.setStrokeStyle(2, 0xffffff);
      else bg.setStrokeStyle();
    });
    root.on('pointerdown', () => {
      SoundSystem.play(this, 'tap');
      this.tweens.add({ targets: root, scale: 0.95, duration: 80, yoyo: true });
      const flash = this.add.rectangle(x, y, bw, bh, gameConfig.colors.red, 0.5);
      this.tweens.add({ targets: flash, alpha: 0, duration: 250, onComplete: () => flash.destroy() });
      onClick();
    });
    return { root, bg, label: text };
  }

  // Текстовая кнопка без фона (ИГРАТЬ, ПОПРОБОВАТЬ): жирный цветной
  // текст, пульс светлее/темнее. Позиция — мировые координаты.
  private makeTextButton(
    x: number, y: number, label: string, fontSize: number,
    color: string, pulse: boolean, onClick: () => void,
  ): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, label, { color, fontSize: `${fontSize}px`, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setScale(1.06));
    t.on('pointerout', () => t.setScale(1));
    t.on('pointerdown', () => {
      SoundSystem.play(this, 'tap');
      t.setScale(0.94);
      this.time.delayedCall(90, () => {
        if (t.active) t.setScale(1);
      });
      onClick();
    });
    if (pulse) {
      // Пульс запускаем с задержкой, чтобы не спорил с fade-in меню
      this.time.delayedCall(1600, () => {
        if (!t.active) return;
        this.tweens.add({
          targets: t, alpha: 0.55, duration: 900,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      });
    }
    return t;
  }

  // --- Зона 3 центр: кнопки столбиком (и в ландшафте, и в портрете) ---
  private buildButtons(
    zone: Phaser.GameObjects.Container, w: number, h: number, bodySize: number,
  ): void {
    // Пункт 2: всегда столбик. Метрики компактнее в портрете.
    const L = this.isLandscape;
    {
      const cx = this.cx;
      const bw = L ? Math.min(w * 0.24, 200) : 190;
      const bh = L ? Math.min(h * 0.05, 36) : 36; // компактнее (место под лого 1.5x)
      // Лого 1.5x: верх ИГРАТЬ ниже (0.46h), зазоры ужаты
      const playTop = h * (L ? 0.26 : 0.39);
      const playSize = L ? Math.round(bodySize * 1.3) : 20;
      const restSize = L ? bodySize : 16;
      const playH = playSize * 2;
      const playCy = playTop / 1.1 + playH / 2;
      const play = this.makeTextButton(cx, playCy, t('play'), playSize, '#d7263d', true, () => {
        // ВАЖНО: daily:false явно! Phaser НЕ сбрасывает settings.data при
        // старте без данных — после задачи дня обычная игра получила бы
        // старый {daily:true} и надпись задачи над полем (баг).
        this.scene.start(SCENES.GAME, { daily: false });
      });
      play.setAlpha(0);
      // Пункт 1: рамка по ширине как у кнопок ниже
      const playFrame = this.add.rectangle(cx, playCy, bw, playH);
      playFrame.setStrokeStyle(3, gameConfig.colors.red);
      playFrame.setAlpha(0);
      const glow1 = this.add.rectangle(cx, playCy, bw + 12, playH + 12);
      glow1.setStrokeStyle(4, gameConfig.colors.red, 0.22);
      glow1.setAlpha(0);
      const glow2 = this.add.rectangle(cx, playCy, bw + 26, playH + 26);
      glow2.setStrokeStyle(5, gameConfig.colors.red, 0.1);
      glow2.setAlpha(0);
      this.time.delayedCall(1200, () => {
        this.tweens.add({ targets: [play, playFrame, glow1, glow2], alpha: 1, duration: 300 });
      });
      zone.add([glow2, glow1, playFrame, play]);
      const gapB = 10;
      const howCy = playTop + playH + gapB + bh / 2;
      const setCy = howCy + bh / 2 + gapB + bh / 2;
      const rest: [string, number, () => void][] = [
        [t('howTo'), howCy, () => this.scene.start(SCENES.HOW_TO)],
        [t('settings'), setCy, () => this.scene.start(SCENES.SETTINGS)],
      ];
      rest.forEach(([label, y, cb], i) => {
        const b = this.makeButton(cx, y, bw, bh, label, false, restSize, cb);
        b.root.setAlpha(0);
        // Каскад с задержкой 0,1 сек (документ 3.2.5)
        this.time.delayedCall(1300 + i * 100, () => {
          this.tweens.add({ targets: b.root, alpha: 1, duration: 300 });
        });
        zone.add(b.root);
      });
    }
  }

  // --- Зона 2: рейтинг слева ---
  private buildRating(
    zone: Phaser.GameObjects.Container, w: number, h: number,
    headSize: number, bodySize: number, rows: number,
  ): void {
    const landscape = this.isLandscape;
    // Пункт 4: раздел уже и левее. Портрет как в E:: 10 строк, колонка уже.
    const cx = this.bx + (landscape ? w * 0.15 : w * 0.145);
    const topY = landscape ? h * 0.18 : h * 0.21;
    const stepY = landscape ? h * 0.038 : h * 0.027;
    const colW = landscape ? w * 0.24 : w * 0.26;
    zone.add(
      this.add
        .text(cx - 20, topY, t('top10'), { color: '#ffffff', fontSize: `${headSize}px` })
        .setOrigin(0.5),
    );
    // Полный список из общего модуля (меню показывает первые rows)
    // Строки едут асинхронно: с доски Яндекса, фолбэк — локальный ряд.
    // Токен защищает от позднего ответа после рестарта сцены.
    const token = (this.menuToken = (this.menuToken ?? 0) + 1);
    getPlatform().getLeaderboard(loadStats().bestRound).then((all) => {
      try {
        if (token !== this.menuToken || !this.scene.isActive(SCENES.MAIN_MENU) || !zone.active) return;
        drawRows(all);
      } catch {
        // Сцена уже ушла — молча выходим
      }
    });
    // Пункт 3: две колонки; шаг подбираем так, чтобы влезли все 10 строк
    // и кнопка «Весь список» (низ ограничен панелями зоны 4).
    const nameX = cx - colW / 2;
    const scoreX = cx + colW / 4;
    const firstY = topY + 40;
    let gap = stepY;
    let font = bodySize;
    if (landscape && rows >= 10) {
      // Чуть теснее, чтобы кнопка не липла к строкам
      gap = Math.min(stepY, (h * 0.615 - 30 - firstY) / (rows - 1)) * 0.88;
      font = Math.min(bodySize, Math.floor(gap * 0.8));
    }
    const drawRows = (all: RatingRow[]): void => {
    // Два прохода (пункт 2): сначала тексты, замеряем первую строку,
    // потом черты ровно по ширине заливки топ-1 — ничего не торчит
    const built: { y: number; isYou: boolean; score: Phaser.GameObjects.Text }[] = [];
    all.slice(0, rows).forEach((row, i) => {
      const y = firstY + i * gap;
      const isYou = row.isYou;
      const name = this.add
        .text(nameX, y, `${i + 1}. ${row.name}`, {
          color: '#ffffff',
          fontSize: `${font}px`,
          fontStyle: isYou ? 'bold' : 'normal',
        })
        .setOrigin(0, 0.5);
      const score = this.add
        .text(scoreX, y, `${row.score}/${row.score}`, {
          color: '#ffffff',
          fontSize: `${font}px`,
          fontStyle: isYou ? 'bold' : 'normal',
        })
        .setOrigin(0.5);
      zone.add([name, score]);
      built.push({ y, isYou, score });
    });
    // Геометрия заливки топ-1: от левого края имён до правого края счёта.
    // Пустой ряд (новичок без рекорда) — черты пропускаем, кнопка остаётся.
    let fx = nameX;
    let fw = colW;
    if (built.length > 0) {
    const s0 = built[0].score;
    fx = (nameX - 12 + (s0.x + s0.width / 2 + 12)) / 2;
    fw = s0.x + s0.width / 2 + 12 - (nameX - 12);
    built.forEach((b, i) => {
      // Красная черта под строкой — той же ширины, что заливка
      const div = this.add.rectangle(fx, b.y + gap * 0.44, fw, 1, gameConfig.colors.red);
      div.setAlpha(0.45);
      zone.add(div);
      if (i === 0) {
        // Первое место — залитая красная плашка (стиль мокапа)
        const bar = this.add.rectangle(fx, b.y, fw, gap * 0.7, gameConfig.colors.red);
        zone.add(bar);
        zone.sendToBack(bar);
      }
      if (b.isYou) {
        // Своя строка вспыхивает красным при показе
        const flash = this.add.rectangle(fx, b.y, fw, gap * 0.7, gameConfig.colors.red, 0.45);
        zone.add(flash);
        this.time.delayedCall(1000, () => {
          this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
        });
      }
    });
    }
    // Кнопка левее эмблемы панели с зазором 8px (иначе налезает).
    // Правый край = минимум(конец полосок, левый край эмблемы - 8).
    // В портрете строк 10 — хвост короче (+8 вместо +4), чтобы влезть в панели.
    const emblemLeft = this.bx + w * 0.26 - 25;
    const btnRight = Math.min(fx + fw / 2, emblemLeft - 8);
    const listBtn = this.makeButton(
      btnRight - 60, firstY + (rows - 1) * gap + gap + (landscape ? 4 : 8), 120, 32,
      t('allList'), false, Math.max(12, font - 2),
      () => this.scene.start(SCENES.RATING),
    );
    zone.add(listBtn.root);
    // Низ блока (кнопка + половина высоты) — под него тянется блок рекордов
    this.ratingBottom = firstY + (rows - 1) * gap + gap + (landscape ? 4 : 8) + 16;
    }; // конец drawRows
  }

  // --- Зона 3 правая: личные рекорды ---
  private buildRecords(
    zone: Phaser.GameObjects.Container, w: number, h: number,
    headSize: number, bodySize: number, stats: ReturnType<typeof loadStats>,
    compact = false,
  ): void {
    const landscape = this.isLandscape;
    const cx = this.bx + (landscape ? w * 0.825 : compact ? w * 0.85 : w * 0.825);
    const topY = landscape ? h * 0.18 : h * 0.21;
    zone.add(
      this.add
        .text(cx, topY, t('records'), { color: '#ffffff', fontSize: `${headSize}px` })
        .setOrigin(0.5),
    );
    const items: [string, string][] = [
      [t('recBest'), stats.bestRound > 0 ? `${stats.bestRound}/${stats.bestRound}` : '—'],
      [t('recTotal'), stats.totalScore > 0 ? `${stats.totalScore}/${stats.totalScore}` : '—'],
      [t('recGames'), `${stats.games}`],
      [t('recWins'), `${stats.wins}`],
      [t('recDaily'), `${stats.dailyWins}`],
    ];
    const stepY = landscape ? h * 0.075 : h * 0.05;
    const halfW = Math.min(95, w * 0.2);
    // Пункт 1: низ блока = низу блока топа — шаг тянется под ratingBottom.
    // Фолбэк (рейтинг не построен) — обычный шаг.
    const firstY = topY + 34;
    const valuePad = bodySize + 6 + 10; // подпись + значение + запас снизу
    let fitStep = stepY;
    const needTop = firstY + valuePad;
    if (this.ratingBottom > needTop + 30) {
      fitStep = (this.ratingBottom - 10 - valuePad - firstY) / (items.length - 1);
    }
    const lastY = topY + 34 + (items.length - 1) * fitStep;
    const frameTop = topY - 16; // заголовок внутри рамки
    const frameBot = lastY + (bodySize + 6) + bodySize * 0.55 + 12;
    const fx0 = cx - halfW;
    const fx1 = cx + halfW;
    // Пункт 3: уголков больше нет — область без внешней рамки.
    // (Геометрия блока оставлена: по ней стоят разделители и полоса.)
    items.forEach(([label, value], i) => {
      const y = topY + 34 + i * fitStep;
      // Пункт 5: шрифты как в ТОП-10 — тот же размер, без жирности
      zone.add(
        this.add.text(cx, y, label, { color: '#888888', fontSize: `${bodySize}px` }).setOrigin(0.5),
      );
      zone.add(
        this.add
          .text(cx, y + (bodySize + 6), value, { color: '#ffffff', fontSize: `${bodySize}px` })
          .setOrigin(0.5),
      );
      // Пункт 7: разделитель между пунктами (4 штуки на 5 пунктов)
      if (i < items.length - 1 && this.textures.exists(TEX.MM_SEP)) {
        const sepW = halfW * 2 - 30;
        const sep = this.add.image(cx, y + fitStep / 2 + 3, TEX.MM_SEP);
        sep.setDisplaySize(sepW, (sepW * 32) / 121);
        zone.add(sep);
      }
    });
    // Пункт 2: полоса-узор ПРАВЕЕ области, высотой с рамку
    if (this.textures.exists(TEX.MM_STRIP)) {
      const stripH = frameBot - frameTop;
      const strip = this.add.image(fx1 + 5, (frameTop + frameBot) / 2, TEX.MM_STRIP);
      strip.setDisplaySize((40 * stripH) / 425, stripH);
      zone.add(strip);
    }
  }

  // --- Зона 4: задача дня слева + достижения справа (всегда рядом) ---
  private buildMidPanels(
    zone: Phaser.GameObjects.Container, w: number, h: number,
    headSize: number, bodySize: number,
  ): void {
    const panelW = w * 0.48;
    const panelH = h * 0.16;
    const dailyX = this.bx + w * 0.25;
    const achX = this.bx + w * 0.75;
    // Панели ниже (место под лого 1.5x и кнопки)
    const dailyY = h * 0.66;
    const achY = h * 0.66;

    // Задача дня
    const daily = getDaily();
    const dPanel = this.add.container(dailyX, dailyY);
    const dBg = this.add.rectangle(0, 0, panelW, panelH);
    dBg.setStrokeStyle(2, 0xffffff, 0.85);
    // Пункт 1: фон с ФИКСИРОВАННОЙ шириной (не шире натуральной),
    // целиком внутри рамки (contain — ничего не режется и не вылезает).
    // Приглушён, чтобы белые тексты читались.
    let dBgImg: Phaser.GameObjects.Image | undefined;
    if (this.textures.exists(TEX.MM_TASK_BG)) {
      dBgImg = this.add.image(0, 0, TEX.MM_TASK_BG);
      const s = Math.min(panelW / dBgImg.width, panelH / dBgImg.height);
      dBgImg.setScale(s);
      dBgImg.setAlpha(0.55);
    } else {
      console.warn('[MainMenu] нет текстуры mm_task_bg — фон задачи программный');
    }
    const dTitle = this.add
      .text(-panelW / 2 + 12, -panelH / 2 + 8, t('dailyTitle'), { color: '#ffffff', fontSize: `${headSize}px` })
      .setOrigin(0, 0);
    const dDesc = this.add
      .text(-panelW / 2 + 12, -panelH / 2 + 30, taskText(daily.task), {
        color: '#aaaaaa',
        fontSize: `${bodySize - 4}px`,
        wordWrap: { width: panelW - 24 },
      })
      .setOrigin(0, 0);
    // Статус: победа (счёт/цель), остаток попыток или «кончились».
    // Всего попыток — базовые + выигранные за рекламу.
    const status = daily.won
      ? t('dailyDone', { s: daily.score, t: daily.task.target })
      : isDailyAvailable()
        ? attemptsText(daily.attemptsUsed, dailyAttemptsTotal())
        : t('dailyNoAttempts');
    const dStatus = this.add
      .text(-panelW / 2 + 12, panelH / 2 - 46, t('dailyStatus', { s: status }), {
        color: daily.won ? '#d7263d' : '#ffffff',
        fontSize: `${bodySize - 2}px`,
      })
      .setOrigin(0, 0);
    dPanel.add(dBgImg ? [dBgImg, dBg, dTitle, dDesc, dStatus] : [dBg, dTitle, dDesc, dStatus]);
    const available = isDailyAvailable();
    // Пункт 2: ПОПРОБОВАТЬ — красный пульсирующий текст без белого фона.
    // Координаты мировые (кнопка лежит в зоне, а не в панели).
    const tryGX = dailyX + panelW / 2 - 100;
    const tryGY = dailyY + panelH / 2 - 30;
    if (available) {
      const tryBtn = this.makeTextButton(tryGX, tryGY, t('dailyTry'), bodySize - 2, '#d7263d', true, () => {
        if (!isDailyAvailable()) return;
        playDaily(); // попытка тратится на входе
        const task = getDaily().task;
        this.scene.start(SCENES.GAME, { daily: true, seed: dailySeed(), task: { target: task.target, maxFlips: task.maxFlips } });
      });
      // Пункт 2: рамка как у «Все достижения», но красная
      const tryFrame = this.add.rectangle(tryGX, tryGY, 180, 34);
      tryFrame.setStrokeStyle(2, gameConfig.colors.red);
      zone.add([tryFrame, tryBtn]);
    } else if (!daily.won) {
      // Попытки кончились, задача не пройдена: та же кнопка предлагает
      // посмотреть рекламу за +1 попытку. Досмотрел — кнопка снова «Попробовать».
      const adBtn = this.makeTextButton(tryGX, tryGY, t('dailyWatchAd'), bodySize - 2, '#d7263d', true, () => {
        getPlatform().showRewardedVideo(() => {
          grantDailyAttempt();
          getPlatform().saveCloud(); // попытка в облако (тихо)
          this.scene.restart(); // панель перестроится: кнопка снова «Попробовать»
        });
      });
      const adFrame = this.add.rectangle(tryGX, tryGY, 180, 34);
      adFrame.setStrokeStyle(2, gameConfig.colors.red);
      zone.add([adFrame, adBtn]);
    } else {
      // Попытка потрачена: победа — «ПРОЙДЕНА», провал/выход — «СЫГРАНО»
      const doneLabel = daily.won ? t('dailyWon') : t('dailyPlayed');
      const done = this.add
        .text(tryGX, tryGY, doneLabel, { color: '#555555', fontSize: `${bodySize - 2}px` })
        .setOrigin(0.5)
        .setAlpha(0.7);
      const doneFrame = this.add.rectangle(tryGX, tryGY, 180, 34);
      doneFrame.setStrokeStyle(2, 0x555555, 0.7);
      zone.add([doneFrame, done]);
    }
    // Таймер до полуночи (мировые координаты — тоже в зоне)
    this.countdownText = this.add
      .text(dailyX - panelW / 2 + 12, dailyY + panelH / 2 - 22, '', {
        color: '#888888',
        fontSize: `${bodySize - 4}px`,
      })
      .setOrigin(0, 0);
    zone.add(this.countdownText);
    this.updateCountdown();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateCountdown() });
    zone.add(dPanel);

    // Достижения: последние 5 (сначала открытые, потом следующие).
    // Строки храним отдельно, чтобы обновлять без перезагрузки меню.
    const aPanel = this.add.container(achX, achY);
    const aBg = this.add.rectangle(0, 0, panelW, panelH);
    aBg.setStrokeStyle(2, 0xffffff, 0.85);
    const aTitle = this.add
      .text(-panelW / 2 + 12, -panelH / 2 + 8, '', {
        color: '#ffffff',
        fontSize: `${headSize}px`,
      })
      .setOrigin(0, 0);
    aPanel.add([aBg, aTitle]);
    zone.add(aPanel);
    this.ar = { header: aTitle, panel: aPanel, rows: [], panelW, panelH, bodySize };
    this.fillAchRows();
    // Кнопка — мировые координаты, в зоне (см. фикс выше)
    const allBtn = this.makeButton(
      achX + panelW / 2 - 100, achY + panelH / 2 - 30, 180, 34,
      t('allAch'), false, bodySize - 4,
      () => this.scene.start(SCENES.ACHIEVEMENTS),
    );
    zone.add(allBtn.root);

    // Пункт 8: эмблемы по центру верхних граней рамок (перекрывают грань)
    if (this.textures.exists(TEX.MM_EMBLEM_1)) {
      for (const [ex, ey] of [[dailyX, dailyY - panelH / 1.75]] as const) {
        const em = this.add.image(ex, ey, TEX.MM_EMBLEM_1);
        em.setDisplaySize(50, 63);
        zone.add(em);
      }
    }
    if (this.textures.exists(TEX.MM_EMBLEM)) {
      for (const [ex, ey] of [[achX, achY - panelH / 1.75]] as const) {
        const em = this.add.image(ex, ey, TEX.MM_EMBLEM);
        em.setDisplaySize(50, 63);
        zone.add(em);
      }
    }

    // Пункт 9: линия над наградами, под рамками (второй слой после фона)
    if (this.textures.exists(TEX.MM_LINE)) {
      const y = Math.max(dailyY + panelH / 2, achY + panelH / 1.10);
      const x0 = Math.min(dailyX, achX);
      const x1 = Math.max(dailyX, achX) * 1.05;
      const line = this.add.image((x0 + x1) / 2, y, TEX.MM_LINE);
      line.setDisplaySize(x1 - x0, 25);
      zone.add(line);
    }
  }

  // Перерисовать достижения и счётчик (без перезагрузки сцены).
  // Пункт 2: лучшее взятое из каждой группы (или первое как цель),
  // группы идут из JSON по порядку, всё в два столбца.
  private fillAchRows(): void {
    if (!this.ar) return;
    for (const o of this.ar.rows) o.destroy();
    this.ar.rows = [];
    const unlocked = new Set(loadUnlocked());
    this.ar.header.setText(t('achTitle', { n: countUnlocked(), m: ACHIEVEMENTS.length }));
    // Группы в порядке JSON; в каждой — максимальное открытое
    const groups: string[] = [];
    for (const a of ACHIEVEMENTS) {
      const g = achGroup(a);
      if (!groups.includes(g)) groups.push(g);
    }
    const cells = groups.map((g) => {
      const items = ACHIEVEMENTS.filter((a) => achGroup(a) === g);
      const open = items.filter((a) => unlocked.has(a.id));
      if (open.length > 0) {
        const best = open[open.length - 1];
        return { title: achTitle(best), done: true };
      }
      return { title: achTitle(items[0]), done: false };
    });
    const { panel, panelW, panelH, bodySize } = this.ar;
    // Раскладка: шапка + кнопка занимают место, остальное — сетке.
    // Шрифт подбираем, чтобы влезло; на низких экранах — первые ряды.
    const headH = 32;
    const btnH = 34;
    const perRow = 2;
    const totalRows = Math.ceil(cells.length / perRow);
    const availH = panelH - headH - btnH - 12;
    const rowH = Math.max(14, Math.floor(availH / Math.max(1, totalRows)));
    const font = Math.max(10, Math.min(bodySize - 4, rowH - 4));
    const fitRows = Math.max(1, Math.floor(availH / rowH));
    cells.slice(0, fitRows * perRow).forEach((c, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = -panelW / 2 + 12 + col * (panelW / 2);
      const y = -panelH / 2 + headH + row * rowH;
      const mark = this.add.text(x, y, c.done ? '✓' : '○', {
        color: c.done ? '#d7263d' : '#666666',
        fontSize: `${font}px`,
      });
      const name = this.add.text(x + font + 4, y, c.title, {
        color: c.done ? '#ffffff' : '#888888',
        fontSize: `${font}px`,
      });
      panel.add([mark, name]);
      this.ar?.rows.push(mark, name);
    });
  }

  // --- Зона 5: ежедневные награды ---
  private buildRewards(
    zone: Phaser.GameObjects.Container, w: number, h: number,
    headSize: number, bodySize: number,
  ): void {
    const status = rewardStatus();
    const RT = rewardTexts(); // тексты из rewards.json (пункт 3)
    const days = getRewardDays(); // 14
    const perRow = days; // всё в одну строку
    // Раскладка сверху вниз: заголовок, ряд ячеек, строка награды.
    // Особые дни — 7-й и 14-й (красная толстая рамка).
    // НАСТРОЙКА ПОЛОЖЕНИЯ ОКНА НАГРАД (крути эти два числа под себя):
    // rewardsTopK — верх всего раздела (доля высоты экрана; меньше = раздел выше);
    // starsLift — ряд звёзд выше своего места на N px (больше = звёзды выше).
    const rewardsTopK = 0.78;
    const starsLift = 18;
    const zTop = h * rewardsTopK;
    const titleH = 40;
    // Баннер-совет над полосой (пункт 4): картинка-текст на текущем языке,
    // читаемая, без димминга. Ширина умеренная, высота по факту текстуры
    // (у ru/en файлов разные пропорции).
    let advH = 0;
    const advKey = langTex(TEX.MM_ADVICE, TEX.MM_ADVICE_EN);
    if (this.textures.exists(advKey)) {
      const advW = Math.min(w * 0.50, 400);
      const advSrc = this.textures.get(advKey).getSourceImage() as { width: number; height: number };
      advH = (advW * (advSrc.height || 470)) / (advSrc.width || 2752);
      const adv = this.add.image(this.cx, zTop / 1.01, advKey);
      adv.setDisplaySize(advW, advH);
      zone.add(adv);
    }
    // Отступ строки награды от ячеек — как у кнопки «Весь список»
    // от последней черты в ТОП-10 (пункт 1)
    const textPad = 14;
    const textH = 26;
    const boxPad = 8;
    // topUsed: место сверху (баннер, если есть) — ячейки ужаты автоматом
    const topUsed = advH > 0 ? 6 + advH + 8 : 8;
    // Ряд звёзд серии над полосой (по центру): звезда за каждый забранный день.
    // Высота ряда отъедает место у ячеек — они ужмутся той же формулой.
    const starSlotSize = Math.max(14, Math.min(50, (w * 0.88) / maxStars() - 4));
    const starStep = starSlotSize + 4;
    const starsH = starSlotSize + 10;
    // Центр ряда звёзд — подними/опусти через starsLift выше (НАСТРОЙКА ПОЛОЖЕНИЯ)
    const starsRowY = zTop + topUsed + starsH / 2 - starsLift;
    let cell = Math.min(52, (w * 0.88) / perRow - 6);
    cell = Math.max(14, Math.min(cell, h - zTop - topUsed - starsH - 2 - titleH - textPad - textH - boxPad));
    const cellH = cell + boxPad;
    const titleY = zTop + topUsed + starsH;
    const rowY = titleY + titleH + cellH / 2;
    const textY = rowY + cellH / 2 + textPad + textH / 2;
    // Заголовок серии (без эмодзи, пункт 3)
    const seriesDays = status.claimedToday ? status.streak : status.broken ? 0 : status.streak;
    const streakText = this.add
      .text(this.cx, titleY, RT.streakTitle(seriesDays), {
        color: '#ffffff',
        fontSize: `${headSize}px`,
      })
      .setOrigin(0.5, 0);
    zone.add(streakText);
    // Заработанные звёзды — в фиксированных слотах ряда (слева направо).
    // Пропуск дня гасит ряд (звёзды «уходят обратно в ячейки»),
    // после открытия Мистических ряд полный навсегда.
    const rowStars: Phaser.GameObjects.Image[] = [];
    if (this.textures.exists(TEX.MM_STAR)) {
      const stars = starCount();
      // Группа всегда по центру экрана: середина отрезка первая–последняя
      // совпадает с центром (при каждой новой звезде старые сдвигаются)
      const x0 = this.cx - (starStep * (stars - 1)) / 2;
      for (let i = 0; i < stars; i++) {
        const im = this.add.image(x0 + i * starStep, starsRowY, TEX.MM_STAR);
        im.setDisplaySize(starSlotSize, (starSlotSize * 140) / 120);
        zone.add(im);
        rowStars.push(im);
      }
    }
    // Ячейки в одну строку (ссылки храним — обновим без перезагрузки меню)
    const cells: { box: Phaser.GameObjects.Rectangle; mark: Phaser.GameObjects.Text }[] = [];
    // Содержимое ячеек: в обычных — маленькая звезда (улетает в ряд при заборе),
    // в 7-й и 14-й (пока сеты закрыты) — круглые камни скинов (исчезают при заборе).
    const cellStar: (Phaser.GameObjects.Image | undefined)[] = [];
    const skinGem = new Map<number, Phaser.GameObjects.Image>();
    const cellStarSize = cell * 0.5;
    const skinStoneSize = cell * 0.72;
    const stoneLocked = !isSkinUnlocked('stone');
    const mysticLocked = !isSkinUnlocked('mystic');
    let pulse: Phaser.Tweens.Tween | undefined;
    const startX = this.cx - ((cell + 6) * (days - 1)) / 2;
    const markSize = Math.max(10, Math.round(cell * 0.4));
    const numSize = Math.max(9, Math.round(cell * 0.34));
    for (let day = 1; day <= days; day++) {
      const x = startX + (day - 1) * (cell + 6);
      const y = rowY;
      const isPast = day < status.pos || (day === status.pos && status.claimedToday);
      const isToday = day === status.pos && !status.claimedToday;
      const box = this.add.rectangle(x, y, cell, cellH, 0x000000);
      if (day === 7 || day === days) box.setStrokeStyle(4, gameConfig.colors.red); // особые дни
      else if (isToday) box.setStrokeStyle(2, gameConfig.colors.red);
      else box.setStrokeStyle(2, 0xffffff, isPast ? 1 : 0.3);
      const mark = this.add
        .text(x, y - cellH / 2 + markSize * 0.8, isPast ? '✓' : isToday ? '🎁' : '', {
          color: '#d7263d',
          fontSize: `${markSize}px`,
        })
        .setOrigin(0.5, 0);
      const num = this.add
        .text(x, y + cellH / 2 - numSize - 2, `${day}`, {
          color: isPast || isToday ? '#ffffff' : '#888888',
          fontSize: `${numSize}px`,
        })
        .setOrigin(0.5, 1);
      zone.add([box, mark, num]);
      cells.push({ box, mark });
      // Центр ячейки свободен (метка сверху, номер снизу) — кладём звезду или камень сета
      const skinDay = day === 7 ? 'stone' : day === days ? 'mystic' : null;
      const skinLocked = skinDay === 'stone' ? stoneLocked : skinDay === 'mystic' ? mysticLocked : false;
      if (!isPast && skinDay && skinLocked) {
        // Круглый камень сета (чёрное солнце лицом) — или звезда, если атласа нет
        let gem: Phaser.GameObjects.Image | undefined;
        if (skinDay === 'stone' && hasStoneFrame(this, 'black', 'face')) {
          gem = this.add.image(x, y, TEX.STONE, stoneFrame('black', 'face'));
        } else if (skinDay === 'mystic' && hasMysticFrame(this, 'black', 'face')) {
          gem = this.add.image(x, y, TEX.MYSTIC, mysticFrame('black', 'face'));
        }
        if (gem) {
          gem.setDisplaySize(skinStoneSize, skinStoneSize);
          zone.add(gem);
          skinGem.set(day, gem);
          cellStar.push(undefined);
        } else if (this.textures.exists(TEX.MM_STAR)) {
          const st = this.add.image(x, y, TEX.MM_STAR);
          st.setDisplaySize(cellStarSize, (cellStarSize * 140) / 120);
          zone.add(st);
          cellStar.push(st);
        } else {
          cellStar.push(undefined);
        }
      } else if (!isPast && this.textures.exists(TEX.MM_STAR)) {
        const st = this.add.image(x, y, TEX.MM_STAR);
        st.setDisplaySize(cellStarSize, (cellStarSize * 140) / 120);
        zone.add(st);
        cellStar.push(st);
      } else {
        cellStar.push(undefined);
      }
      if (isToday) {
        pulse = this.tweens.add({ targets: box, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      }
    }
        // Кнопка «Забрать» — ниже ячеек, с зазором (текста награды больше нет:
    // пропуски за рекламу не показываем)
    const claimX = this.bx + w * 0.87;
    const claimY = textY + 10;
    // Пункт 1: красная подсветка кнопки (свечение как у «Играть»).
    // Гаснет вместе с кнопкой после забора.
    let claimGlow: Phaser.GameObjects.Rectangle[] = [];
    if (!status.claimedToday) {
      const glow1 = this.add.rectangle(claimX, claimY, 180 + 12, 34 + 12);
      glow1.setStrokeStyle(4, gameConfig.colors.red, 0.22);
      const glow2 = this.add.rectangle(claimX, claimY, 180 + 26, 34 + 26);
      glow2.setStrokeStyle(5, gameConfig.colors.red, 0.1);
      zone.add([glow2, glow1]);
      claimGlow = [glow1, glow2];
    }
    // Пункт 1: своя кнопка (не makeButton — у него чужой ховер):
    // активна — красная заливка + красная рамка + белый текст;
    // забрана — белая рамка без фона + серая надпись.
    const claimW = 180;
    const claimH = 34;
    const claimBg = this.add.rectangle(0, 0, claimW, claimH);
    const claimTx = this.add
      .text(0, 0, '', { fontSize: `${Math.max(12, bodySize - 5)}px` })
      .setOrigin(0.5);
    const claimRoot = this.add.container(claimX, claimY, [claimBg, claimTx]);
    claimRoot.setSize(claimW, claimH);
    claimRoot.setInteractive({ useHandCursor: true });
    claimRoot.on('pointerover', () => claimRoot.setScale(1.04));
    claimRoot.on('pointerout', () => claimRoot.setScale(1));
    claimRoot.on('pointerdown', () => {
      SoundSystem.play(this, 'tap');
      this.doClaim();
    });
    zone.add(claimRoot);
    // Запоминаем всё для точечного обновления (пункт 3)
    this.rw = {
      streak: streakText, cells, pos: status.pos, pulse,
      claimRoot, claimBg, claimTx, claimGlow,
      cellStar, rowStars, skinGem,
      starSlotStep: starStep, starSlotY: starsRowY,
      starSlotSize, cellStarSize,
    };
    this.paintClaim(!status.claimedToday);
    // Низ полосы — для защиты от вылезания за экран (пункт 5)
    this.rewardsBottom = textY + 19;
  }

  // Забрать награду дня БЕЗ перезагрузки меню (пункт 3):
  // обновляем серию, ячейку, кнопку и счётчик достижений на месте
  private doClaim(): void {
    if (rewardStatus().claimedToday || !this.rw) return;
    const RT = rewardTexts();
    claimReward();
    getPlatform().saveCloud(); // серия в облако (тихо)
    addRewardClaim();
    syncAchievements(loadStats());
    SoundSystem.play(this, 'victory');
    // Серия выросла
    const st = rewardStatus();
    this.rw.streak.setText(RT.streakTitle(st.streak));
    this.rw.pos = st.pos;
    // Сегодняшняя ячейка: 🎁 → ✓, пульс останавливаем
    const cell = this.rw.cells[st.pos - 1];
    if (cell) {
      cell.mark.setText('✓');
      cell.box.setStrokeStyle(2, 0xffffff, 1);
      if (this.rw.pulse) {
        this.rw.pulse.stop();
        cell.box.setAlpha(1);
      }
    }
    // Звезда дня: из ячейки в ряд над полосой; камень сета из ячейки исчезает.
    // Ряд всегда центрируется: старые звёзды сдвигаются, новая встаёт последней.
    // Разблокировки скинов по новой серии — с тостом (Каменные/Мистические навсегда).
    const newly = checkSkinUnlocks(st.streak);
    const have = starCount(); // уже включая новую звезду (или 14 навсегда)
    const slot = have - 1;
    const step = this.rw.starSlotStep;
    const newCount = this.rw.rowStars.length + 1;
    if (slot >= 0 && slot < maxStars() && this.rw.rowStars.length <= slot) {
      // Центрируем ряд под новое количество и сдвигаем старые звёзды
      const x0 = this.cx - (step * (newCount - 1)) / 2;
      this.rw.rowStars.forEach((im, i) => {
        this.tweens.add({ targets: im, x: x0 + i * step, duration: 450, ease: 'Cubic.easeOut' });
      });
      const cs = this.rw.cellStar[st.pos - 1];
      if (cs) {
        // Полёт звезды из ячейки в последний слот
        const f = this.rw.starSlotSize / this.rw.cellStarSize;
        this.rw.cellStar[st.pos - 1] = undefined;
        this.tweens.add({
          targets: cs,
          x: x0 + slot * step, y: this.rw.starSlotY,
          scaleX: cs.scaleX * f, scaleY: cs.scaleY * f,
          duration: 450, ease: 'Cubic.easeOut',
          onComplete: () => { if (this.rw) this.rw.rowStars.push(cs); },
        });
      } else if (this.textures.exists(TEX.MM_STAR)) {
        // В ячейке был камень сета — звезда просто появляется последней
        const pop = this.add.image(x0 + slot * step, this.rw.starSlotY, TEX.MM_STAR);
        pop.setDisplaySize(this.rw.starSlotSize, (this.rw.starSlotSize * 140) / 120);
        // Появление через масштаб: запоминаем целевой и растим
        const tx = pop.scaleX, ty = pop.scaleY;
        pop.setScale(0);
        this.tweens.add({ targets: pop, scaleX: tx, scaleY: ty, duration: 350, ease: 'Back.easeOut' });
        this.rw.rowStars.push(pop);
      }
    } else {
      // Ряд полон (14 навсегда): лишняя звезда из ячейки просто гаснет
      const cs = this.rw.cellStar[st.pos - 1];
      if (cs) {
        this.rw.cellStar[st.pos - 1] = undefined;
        this.tweens.add({ targets: cs, alpha: 0, duration: 300, onComplete: () => cs.destroy() });
      }
    }
    const gem = this.rw.skinGem.get(st.pos);
    if (gem) {
      // Камень забрали — исчезает из ячейки и всё
      this.rw.skinGem.delete(st.pos);
      this.tweens.add({
        targets: gem, scaleX: 0, scaleY: 0, alpha: 0, duration: 350,
        onComplete: () => gem.destroy(),
      });
    }
    // С тестовыми порогами сет может открыться раньше своей ячейки —
    // камень всё равно убираем из 7-й/14-й ячейки
    for (const s of newly) {
      const gemDay = s === 'stone' ? 7 : getRewardDays();
      const g2 = gemDay !== st.pos ? this.rw.skinGem.get(gemDay) : undefined;
      if (g2) {
        this.rw.skinGem.delete(gemDay);
        this.tweens.add({
          targets: g2, scaleX: 0, scaleY: 0, alpha: 0, duration: 350,
          onComplete: () => g2.destroy(),
        });
      }
    }
    newly.forEach((s, i) => this.showSkinUnlockToast(s, i));
    // Кнопка: активная красная → белая рамка без фона (пункт 1)
    this.paintClaim(false);
    this.rw.claimRoot.removeInteractive();
    for (const g of this.rw.claimGlow) g.setAlpha(0);
    // Могла открыться ачивка «3 награды» — обновляем панель
    this.fillAchRows();
  }

  // Тост об открытии сета (из doClaim и при входе в меню задним числом)
  private showSkinUnlockToast(s: SkinId, i: number): void {
    const toast = this.add.text(
      this.cx, this.scale.height * 0.45 - i * 36,
      t('skinsUnlocked', { name: skinName(s) }),
      { color: '#d7263d', fontSize: '26px' },
    ).setOrigin(0.5);
    this.tweens.add({
      targets: toast, y: toast.y - 30, alpha: 0, duration: 2600, delay: 400,
      onComplete: () => toast.destroy(),
    });
    SoundSystem.play(this, 'victory');
  }

  // Вид кнопки награды (пункт 1): вызывать при создании и после забора.
  private paintClaim(active: boolean): void {
    if (!this.rw) return;
    if (active) {
      this.rw.claimBg.setFillStyle(gameConfig.colors.red, 1);
      this.rw.claimBg.setStrokeStyle(2, gameConfig.colors.red, 1);
      this.rw.claimTx.setColor('#ffffff');
      this.rw.claimTx.setText(rewardTexts().claim);
    } else {
      this.rw.claimBg.setFillStyle(0x000000, 0);
      this.rw.claimBg.setStrokeStyle(2, 0xffffff, 1);
      this.rw.claimTx.setColor('#888888');
      this.rw.claimTx.setText(rewardTexts().claimed);
    }
  }

  // Таймер до полуночи для задачи дня
  private updateCountdown(): void {
    if (!this.countdownText) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    let s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    const hh = `${Math.floor(s / 3600)}`.padStart(2, '0');
    const mm = `${Math.floor((s % 3600) / 60)}`.padStart(2, '0');
    const ss = `${s % 60}`.padStart(2, '0');
    this.countdownText.setText(t('dailyNext', { t: `${hh}:${mm}:${ss}` }));
  }

  private handleResize(): void {
    this.scene.restart();
  }
}
