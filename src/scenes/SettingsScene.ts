// ============================================================
// SettingsScene — экран настроек (Main_menu.md, кнопка НАСТРОЙКИ).
// Звук, подписи, скин камней, сложность (числа — в data/difficulty.json),
// язык (русский/английский, тексты — в utils/lang.ts).
// Аккаунт — на Этапе 4 (SDK Yandex).
// ============================================================
import Phaser from 'phaser';
import { SCENES } from '../utils/constants';
import { SoundSystem } from '../systems/SoundSystem';
import { loadLabelsEnabled, setLabelsEnabled } from '../utils/storage';
import { loadDifficulty, saveDifficulty, nextDifficulty } from '../utils/storage';
import { difficultyTitle } from '../utils/difficulty';
import { rewardStatus } from '../utils/daily';
import { effectiveSkin, nextOpenSkin, setSkin, isSkinUnlocked, unlockStreak } from '../utils/skins';
import { t, currentLang, saveLang, nextLang, langName, skinName, soundModeName } from '../utils/lang';
import { getPlatform } from '../utils/platform';
import { onEsc } from '../utils/keyboard';

export class SettingsScene extends Phaser.Scene {
  private soundText!: Phaser.GameObjects.Text;
  private labelsText!: Phaser.GameObjects.Text;
  private skinText!: Phaser.GameObjects.Text;
  private skinHint!: Phaser.GameObjects.Text;
  private langText!: Phaser.GameObjects.Text;
  private diffText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.SETTINGS);
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add
      .text(w / 2, h * 0.25, t('setTitle'), { color: '#ffffff', fontSize: '30px' })
      .setOrigin(0.5);

    this.soundText = this.add
      .text(w / 2, h * 0.38, '', { color: '#ffffff', fontSize: '24px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshSound();
    this.soundText.on('pointerdown', () => {
      SoundSystem.setMode(SoundSystem.nextMode(SoundSystem.getMode()));
      this.refreshSound();
    });

    // Пункт 2: подписи «СВЕТ»/«ТЬМА» на камнях (применится со следующей партии)
    this.labelsText = this.add
      .text(w / 2, h * 0.45, '', { color: '#ffffff', fontSize: '24px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshLabels();
    this.labelsText.on('pointerdown', () => {
      setLabelsEnabled(!loadLabelsEnabled());
      getPlatform().saveCloud();
      this.refreshLabels();
    });

    // Пункт 4: скин камней (применится с новой партии).
    // Тумблер крутит только ОТКРЫТЫЕ сеты; закрытые — в подсказке ниже.
    this.skinText = this.add
      .text(w / 2, h * 0.52, '', { color: '#ffffff', fontSize: '24px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshSkin();
    this.skinText.on('pointerdown', () => {
      setSkin(nextOpenSkin());
      getPlatform().saveCloud();
      this.refreshSkin();
    });
    // Подсказка про закрытые сеты (серая, мелкая — основной шаг не ломает)
    this.skinHint = this.add
      .text(w / 2, h * 0.555, '', { color: '#888888', fontSize: '15px' })
      .setOrigin(0.5);
    this.refreshSkinHint();

    // Сложность: лёгкий → средний → сложный (применится с новой партии).
    // Шаг 0.07 — как у всех пунктов выше и у строки языка ниже.
    this.diffText = this.add
      .text(w / 2, h * 0.59, '', { color: '#ffffff', fontSize: '24px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshDiff();
    this.diffText.on('pointerdown', () => {
      saveDifficulty(nextDifficulty(loadDifficulty()));
      getPlatform().saveCloud();
      this.refreshDiff();
    });

    // Язык: русский/английский. Переключение — сразу (сцена перестраивается).
    this.langText = this.add
      .text(w / 2, h * 0.66, '', {
        color: '#ffffff',
        fontSize: '20px',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.refreshLang();
    this.langText.on('pointerdown', () => {
      saveLang(nextLang(currentLang()));
      getPlatform().saveCloud();
      this.scene.restart();
    });

    const back = this.add
      .text(w / 2, h * 0.75, t('back'), { color: '#d7263d', fontSize: '26px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start(SCENES.MAIN_MENU));

    // Esc — как кнопка «Назад» (пункт 2)
    onEsc(this, () => this.scene.start(SCENES.MAIN_MENU));

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private refreshSound(): void {
    this.soundText.setText(t('setSound', { v: soundModeName(SoundSystem.getMode()) }));
  }

  private refreshLabels(): void {
    this.labelsText.setText(t('setLabels', { v: loadLabelsEnabled() ? t('on') : t('off') }));
  }

  private refreshSkin(): void {
    this.skinText.setText(t('setStones', { name: skinName(effectiveSkin()) }));
  }

  private refreshLang(): void {
    this.langText.setText(t('setLang', { l: langName(currentLang()) }));
  }

  // Что ещё закрыто и сколько дней серии осталось (подробности — в «Как играть», п.7)
  private refreshSkinHint(): void {
    const parts: string[] = [];
    const st = rewardStatus();
    const have = st.broken ? 0 : st.streak;
    if (!isSkinUnlocked('stone')) {
      const need = unlockStreak('stone');
      parts.push(t('skinHintStone', { need, have: Math.min(have, need) }));
    }
    if (!isSkinUnlocked('mystic')) {
      const need = unlockStreak('mystic');
      parts.push(t('skinHintMystic', { need, have: Math.min(have, need) }));
    }
    this.skinHint.setText(parts.length > 0 ? parts.join(' • ') : t('skinHintAll'));
  }

  private refreshDiff(): void {
    this.diffText.setText(t('setDiff', { t: difficultyTitle(loadDifficulty()) }));
  }

  private handleResize(): void {
    this.scene.restart();
  }
}
