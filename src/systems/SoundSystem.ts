// ============================================================
// SoundSystem — звук игры (GDD 5.2).
// Режимы (тумблер в Настройках): выкл / системные / музыка / всё сразу.
// Системные — короткие эффекты через Phaser. Музыка — фоновый MP3
// через обычный Audio-элемент: он сквозной через все сцены
// (звук сцены умирал бы при смене сцены) и переживает рестарты.
// На время рекламы музыка приглушается (дакинг из platform.ts).
// ============================================================
import { gameConfig } from '../config/gameConfig';

// Режим звука: что играет (хранится в localStorage как есть)
export type SoundMode = 'off' | 'system' | 'music' | 'all';

const MUSIC_SRC = 'assets/sounds/background_music.mp3';
const MUSIC_VOLUME = 0.35; // фон тише эффектов

// Тип имён звуков — строго по ключам из gameConfig.sounds
export type SoundName = keyof typeof gameConfig.sounds;

// Высота программного тона-заглушки для каждого звука (Гц)
const PLACEHOLDER_PITCH: Record<SoundName, number> = {
  tap: 660,
  drag: 440,
  line: 880,
  echo: 330,
  flip: 220,
  tick: 990,
  victory: 780,
  defeat: 180,
};

const PREF_KEY = 'tct_sound'; // вкл/выкл звук

export class SoundSystem {
  private static ctx: AudioContext | null = null;
  private static musicEl: HTMLAudioElement | null = null;
  private static musicDucked = false; // приглушено на время рекламы
  private static booted = false;

  // Текущий режим (со старого вкл/выкл мигрируем: on → всё сразу)
  static getMode(): SoundMode {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw === 'off' || raw === 'system' || raw === 'music' || raw === 'all') {
        return raw;
      }
      if (raw === 'on') return 'all';
    } catch {
      // localStorage недоступен — используем дефолт
    }
    return gameConfig.soundEnabledByDefault ? 'all' : 'off';
  }

  static setMode(mode: SoundMode): void {
    try {
      localStorage.setItem(PREF_KEY, mode);
    } catch {
      // Тихо игнорируем
    }
    this.applyMusic();
  }

  // Следующий режим по кругу (для тумблера настроек)
  static nextMode(mode: SoundMode): SoundMode {
    const order: SoundMode[] = ['off', 'system', 'music', 'all'];
    return order[(order.indexOf(mode) + 1) % order.length];
  }

  // Играют ли системные звуки (режим system/all)
  static systemOn(): boolean {
    const m = this.getMode();
    return m === 'system' || m === 'all';
  }

  // Хочет ли режим музыку (режим music/all)
  static musicWanted(): boolean {
    const m = this.getMode();
    return m === 'music' || m === 'all';
  }

  // Запуск при старте игры: пробуем включить музыку и ждём первый жест
  // (браузеры запрещают аудио до жеста — договариваемся по pointerdown).
  static boot(): void {
    if (this.booted) return;
    this.booted = true;
    try {
      this.applyMusic();
      document.addEventListener('pointerdown', () => this.applyMusic());
    } catch {
      // Не браузер — пропускаем
    }
  }

  // Применить желание музыки к факту: вкл/выкл/дакинг
  static applyMusic(): void {
    try {
      if (!this.musicWanted() || this.musicDucked) {
        if (this.musicEl) this.musicEl.pause();
        return;
      }
      if (!this.musicEl) {
        this.musicEl = new Audio(MUSIC_SRC);
        this.musicEl.loop = true;
        this.musicEl.volume = MUSIC_VOLUME;
      }
      const p = this.musicEl.play();
      if (p instanceof Promise) {
        p.catch(() => {
          // До первого жеста запрещено — попробуем на следующем жесте
        });
      }
    } catch {
      // Без музыки игра тоже работает
    }
  }

  // Приглушить/вернуть музыку на время рекламы (зовёт platform.ts)
  static setMusicDucked(ducked: boolean): void {
    this.musicDucked = ducked;
    this.applyMusic();
  }

  // Главный метод: играть системный звук по имени.
  // Сначала пробуем загруженный файл, иначе — программный тон.
  static play(scene: Phaser.Scene, name: SoundName): void {
    if (!this.systemOn()) return;
    try {
      const key = `snd_${name}`;
      // Настоящий файл: подхватится сам, когда появится в public/assets
      if (scene.cache.audio.exists(key)) {
        scene.sound.play(key);
        return;
      }
      this.blip(PLACEHOLDER_PITCH[name]);
    } catch {
      // Звук никогда не должен ронять игру
    }
  }

  // Тихая короткая заглушка через WebAudio (потом заменится файлами).
  // Контекст создаём лениво, при первом звуке (после жеста игрока).
  private static blip(freq: number): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t); // очень тихо
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch {
      // Молча: без звука игра тоже работает
    }
  }
}
