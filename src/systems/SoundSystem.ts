// ============================================================
// SoundSystem — Этап 3: отдельный звуковой модуль (GDD 5.2).
// Читает список звуков из gameConfig.sounds.
// Если файла нет (заглушка) — играет тихий программный тон той же
// длительности, игра НЕ падает. Когда появятся настоящие .mp3 —
// достаточно положить их в public/assets/sounds, код не меняется.
// Вкл/выкл — настройка в главном меню (GDD 3.2).
// ============================================================
import { gameConfig } from '../config/gameConfig';

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

  // Включён ли звук (по умолчанию — из gameConfig)
  static isEnabled(): boolean {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw === 'on') return true;
      if (raw === 'off') return false;
    } catch {
      // localStorage недоступен — просто используем дефолт
    }
    return gameConfig.soundEnabledByDefault;
  }

  static setEnabled(on: boolean): void {
    try {
      localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    } catch {
      // Тихо игнорируем
    }
  }

  // Главный метод: играть звук по имени.
  // Сначала пробуем загруженный файл, иначе — программный тон.
  static play(scene: Phaser.Scene, name: SoundName): void {
    if (!this.isEnabled()) return;
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
