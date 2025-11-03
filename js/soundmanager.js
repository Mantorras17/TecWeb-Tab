/**
 * Manages background music and sound effects for the app.
 * - Register assets with add(name, file, { loop, volume }).
 * - Play singleton/looped sounds via play(name, { singleton: true }) or stop(name).
 * - Master volume and mute apply to all registered sounds.
 *
 * Notes:
 * - For short SFX, play() clones the element so overlapping plays are possible.
 * - For looped/singleton sounds (e.g., BGM), the original element is reused.
 */
export default class SoundManager {
  /**
   * @param {string} [basePath='audio/'] Base folder for audio files.
   */
  constructor(basePath = 'audio/') {
    /** Base path for audio files. */ this.basePath = basePath;
    /** Master gain in [0,1]. */      this.master = 0.8;
    /** Global mute flag. */          this.muted = false;
		/** Start background music. */    this.playBgm = () => this.play('background', { singleton: true });
    /** Stop background music. */     this.stopBgm = () => this.stop('background');
    /** Registered sounds.
      * Map name -> { el: HTMLAudioElement, baseVolume: number, loop: boolean }
      * @type {Map<string, { el: HTMLAudioElement, baseVolume: number, loop: boolean }>}
      */                              this.sounds = new Map();
  }


  /**
   * Register an audio asset.
   * @param {string} name Logical name to reference the sound.
   * @param {string} file File name relative to basePath.
   * @param {{ loop?: boolean, volume?: number }} [opts]
   *        loop: whether the sound should loop (default false)
   *        volume: base volume [0..1] before master gain (default 1)
   */
  add(name, file, opts = {}) {
    const el = new Audio(this.basePath + file);
    el.preload = 'auto';
    el.loop = !!opts.loop;
    const baseVolume = Math.max(0, Math.min(1, opts.volume ?? 1));
    el.volume = baseVolume * this.master;
    el.muted = this.muted;
    this.sounds.set(name, { el, baseVolume, loop: el.loop })
  }


  /**
   * Set master volume for all sounds.
   * @param {number} v Value in [0,1].
   */
  setMasterVolume(v) {
    this.master = Math.max(0, Math.min(1, v));
    for (const { el, baseVolume } of this.sounds.values()) {
      el.volume = baseVolume * this.master;
    }
  }


  /**
   * Mute or unmute all sounds.
   * @param {boolean} m
   */
  setMuted(m) {
    this.muted = !!m;
    for (const { el } of this.sounds.values()) {
      el.muted = this.muted;
    }
  }


  /** 
	 * Toggle global mute. 
	 */
  toggleMute() {
    this.setMuted(!this.muted);
  }


  /**
   * Play a sound by name.
   * - If the sound is looped or opts.singleton is true, reuse the same element.
   * - Otherwise, clone the element so multiple overlapping plays are possible.
   * @param {string} name
   * @param {{ singleton?: boolean }} [opts]
   */
  play(name, opts = {}) {
    const snd = this.sounds.get(name);
    if (!snd) return;
    const { el, baseVolume, loop } = snd;

    const isSingleton = loop || opts.singleton;
    if (isSingleton) {
      try {
        el.currentTime = 0;
        el.volume = baseVolume * this.master;
        el.muted = this.muted;
        el.play().catch(() => {});
      } catch {}
      return;
    }
    try {
      const clone = el.cloneNode(true);
      clone.loop = false;
      clone.volume = baseVolume * this.master;
      clone.muted = this.muted;
      clone.play().catch(() => {});
      clone.addEventListener('ended', () => clone.remove());
    } catch {}
  }


  /**
   * Stop a named sound (if playing) and reset its time.
   * @param {string} name
   */
  stop(name) {
    const snd = this.sounds.get(name);
    if (!snd) return;
    try {
      snd.el.pause();
      snd.el.currentTime = 0;
    } catch {}
  }


  /** 
	 * Stop all registered sounds. 
	 */
  stopAll() {
    for (const name of this.sounds.keys()) this.stop(name);
  }
}