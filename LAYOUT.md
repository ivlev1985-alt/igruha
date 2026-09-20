# LAYOUT.md — все размеры и координаты игры

## 0. Как устроены координаты (прочитать первым!)

- Режим **FIT**: ландшафт — сцена **1280×720**, портрет — **720×1280**
  (`src/main.ts`, `LAND_W`/`LAND_H`, выбор через `orientationchange`).
  На любом мониторе цифры одни и те же — меняется только общий масштаб.
- Контент живёт в полосе по центру: `bw = min(w, contentMaxWidth)` (сейчас 1440 =
  во всю ширину дизайна; фон — на весь экран).
  `bx = (w - bw) / 2`, центр `cx = w / 2` (`MainMenu.create`, поля `bx/bw/cx`).
- Позиции — **долями** (`h * 0.4`), размеры — от `bw`/`bh` или константами с потолком.
- **Запрет:** множители больше ×1.2 в `setDisplaySize` — именно они всё ломали.
- После правок: `npm run build` без ошибок →DevTools→ проверить узкое и широкое окно.

Пример записи кода:
```ts
const playTop = h * (L ? 0.46 : 0.27);   // верх кнопки «Играть»: 40% высоты
const playCy = playTop + playH / 2;     // центр = верх + половина высоты
```

---

## 1. `src/config/gameConfig.ts` — все числа

```ts
contentMaxWidth: 1440   // полоса = весь дизайн (1100 было уже)
logoMaxWidth: 560       // логотип шире не растёт
boardRows/Cols: 8
tapCost/dragCost/echoCost: 1 / 2 / 3
timerStart/timerMax: 90
gaugeMin -30 / gaugeMax 500        // ТОЛЬКО показ шкал
boardGrid: { show, color 0xffffff, alpha 0.16, width 1 }
echoCooldownMoves 5, echoAnimDuration 3.0
victoryMin 50, progressTiers [50, 60, 80, 100, 150]
gemSheetRows ['red','white','black']  // какой ряд атласа = какой цвет
dailyTask { minScore 60, maxScore 150, maxAttempts 2 }
flipAnimDuration 0.35, dragAnimDuration 0.2, fallDuration 0.2
```

---

## 2. Главное меню — `src/scenes/MainMenu.ts`

### Шапка — `buildTitle()`
```ts
lw = min(logoMaxWidth, w * 0.8)   // ширина логотипа
lh = lw * 1072 / 2752             // высота (пропорции файла)
cyLogo = lh / 2 + 8               // центр логотипа
subY = cyLogo + lh / 2 + 14       // подзаголовок (две части: белая + красная)
// Эмблемы: embH = titleSize * 2.4; gap = lw/2 + embH*0.55; y = cyLogo
// Разделитель-полоса под названием: addDivider(), пульс alpha+scaleX
```

### Кнопки — `buildButtons()` — ВСЕГДА столбик, обе ориентации
```ts
bw = L ? min(w*0.24, 300) : 220          // ширина рамок
bh = L ? min(h*0.05, 44) : 38            // высота рамок
playTop = h * (L ? 0.46 : 0.27)           // верх «Играть»
playSize = L ? round(bodySize*1.3) : 20   // шрифт (playH = playSize*2)
playCy = playTop + playH/2
howCy = playTop + playH + 12 + bh/2
setCy = howCy + bh/2 + 12 + bh/2
// Свечение ИГРАТЬ: рамки bw+12 (alpha 0.22) и bw+26 (alpha 0.1)
```

### ТОП — `buildRating()` (rows: 10 всегда, как в E:)
```ts
cx = bx + w*0.15            // портрет: bx + w*0.21
topY = h*0.18               // портрет: h*0.21
colW = w*0.24               // портрет: w*0.34
nameX = cx - colW/2         // имена влево; scoreX = cx + colW/4, счёт по центру
firstY = topY + 40
gap: ландшафт — автоподбор; портрет — h*0.034 (10 строк влезают)
font = min(bodySize, gap*0.8)
// Заливка топ-1 и черты: от nameX-12 до правого края счёта (замер!)
// Кнопка 120x32: правый край = min(конец полосок, левый край эмблемы - 8),
// y = lastY + gap + 4 (ландшафт) / +8 (портрет)
```

### Рекорды — `buildRecords()`
```ts
cx = bx + w*0.825           // портрет (compact): bx + w*0.80
topY = h*0.18               // портрет: h*0.21 (поднят, пункт 1)
stepY: низ блока = низу блока топа — шаг считается из ratingBottom:
  fitStep = (ratingBottom - 10 - (bodySize+6) - firstY) / 4
  (фолбэк без рейтинга: h*0.075 / h*0.05)
halfW = min(95, w*0.2)
// 5 пунктов: подпись серая + значение белое, тем же кеглем, что топ
// Разделители mm_sep: 4 шт, ширина halfW*2-30
// Полоса mm_strip: x = fx1 + 20 (СПРАВА), высота = высоте блока
```

### Задача дня + достижения — `buildMidPanels()` — ВСЕГДА РЯДОМ
```ts
panelW = w*0.45; panelH = h*0.16
dailyX = bx + w*0.26;  achX = bx + w*0.74
dailyY = achY = h*0.76
// Фон mm_task_bg внутри рамки daily (contain, alpha 0.55)
// tryBtn: (dailyX + panelW/2 - 100, dailyY + panelH/2 - 30), рамка 180x34
// allBtn: (achX + panelW/2 - 100, achY + panelH/2 - 26), 180x34
// Эмблемы mm_emblem*: центры верхних граней, ширина 44
// Линия mm_line: y = низ рамок + 16, ширина от панели до панели, высота 16
// Достижения: лучшее из каждой группы JSON, 2 колонки (fillAchRows)
```

### Награды — `buildRewards()` — 14 ячеек в одну строку
```ts
zTop = landscape ? h*0.855 : h*0.84
cell = min(52, (w*0.88)/14 - 6, по высоте);  cellH = cell + 8
titleY = zTop + 8;  rowY = titleY + 20 + cellH/2
textY = rowY + cellH/2 + 4 + 13   // текст + кнопка 150x30 ниже ячеек
// Особые 7-й и 14-й: толстая красная рамка. Низ: rewardsBottom (защита)
```

---

## 3. Игра — `src/scenes/GameScene.ts`

```ts
computeLayout(): w = min(fullW, contentMaxWidth)
  topMargin 110, bottomMargin 150, sideMargin 64 (место под шкалы)
  cellSize = min((w-128)/8, (h-260)/8)   // ШАГ клеток
  boardX = (fullW - cellSize*8)/2; boardY = 110 + (h-260-cellSize*8)/2
drawGrid(): линии через cellSize от (boardX, boardY), вид — boardGrid
Камень = cellSize * 0.92. Подписи: cellSize * 0.16 (мин. 9px)
Рамка выбора: cellSize * 0.98, красная 4px
Фон: addBackground(..., GAME_BG, 'top') — полоса сверху (assets.ts)
Пульс: buildAmbient() — 3 круга в круге затмения eclipseGeom()
  (центр 0.487/0.413 ширины баннера, r 0.061; радиусы 0.55/0.8/1.05,
  alpha 0.14/0.08/0.045; белый/красный по лидеру; дыхание 450мс)
```

## 4. HUD — `src/scenes/UIScene.ts`

```ts
Таймер в круге затмения (eclipseGeom; нет баннера — верх по центру):
  timerNum 36px (белое/красное + чёрная обводка 6), (ex, ey-10)
  timerWord 13px серое, (ex, ey+18)     // «секунда/секунды/секунд»
  flipsText 12px серое, (ex, ey+46)
Минус-флоатер: красное 20px, +90px вправо за 0.9 сек
Шкалы: barW 22; leftX = rect.x-34; rightX = rect.x+rect.w+12
  счётчики 18px над шкалами; линии толщиной boardGrid.width;
  белая слева, красная справа; диапазон -30/500; долг — пунктир
Эмблемы на торцах: emblem_1 (110x146) слева, emblem (23x27) справа,
  ширина barW+20, сдвиг -6 (placeEmblem)
Эхо-картинка: ширина min(200, w*0.4), пропорции 870x300,
  Y — середина щели между полем и рядом (echoPos). Скрыта, пока не готова.
  Нет файла — серый круг 44px. Низ: Выход cx-130, Завершить cx+130 (by = h-70)
```

## 5. Остальные страницы

- **Как играть** (`HowToScene.ts`): заголовок `h*0.1`, текст 24px,
  камни `clamp(min(w,h)*0.1125, 34, 81)`, столбцы `0.39/0.61w`,
  разделитель по центру, Назад `h*0.88`. Переполнение — прокрутка.
- **Настройки** (`SettingsScene.ts`): заголовок `0.25h`, пункты
  `0.38/0.46/0.54/0.62h` 24px, язык 20px, Назад `0.75h`.
- **Достижения** (`AchievementsScene.ts`): заголовок y=24, 3 колонки,
  группы с заголовками и линиями, прокрутка, Назад `h-50`.
- **Рейтинг** (`RatingScene.ts`): то же, 2 колонки, топ-1 в рамке.
- **Финал** (`VictoryScene.ts`/`GameOverScene.ts`): всё по центру,
  кнопки через 40–50px.
- **Esc** (`utils/keyboard.ts`): игра — снять выбор, меню — Назад, финал — Выход.

## 6. Ассеты — `src/utils/assets.ts`

`TEX` — все ключи. `addBackground(scene, key, anchor)`:
`'center'` (cover) / `'top'` (полоса сверху).
`gameBannerRect()` / `eclipseGeom()` — геометрия баннера и круга.
Пути: `gameConfig.menuArt` (меню, грузятся всегда) и `sprites` (игра, за флагом).
Атласы: `gems_all` (морф 6 кадров, ряды `gemSheetRows`),
`gems_mystic` (`m_цвет_сторона`, мгновенно).
