// Audio manager: optional MP3 SFX (decoded buffers) + synth fallback; <audio> for music loops
import { MUSIC_BY_KEY, SFX_BY_KEY, SFX_SPECS, urlPublicAudio } from '../audio/audioAssets.js';

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._muted = false;
    this._sfxVolume = 0.5;
    this._musicVolume = 0.25;
    this._musicEl = null;
    this._currentTrack = null;
    this._initialized = false;
    /** @type {Map<string, AudioBuffer>} */
    this._sfxBuffers = new Map();
  }

  init() {
    if (this._initialized) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
      this._preloadSfx();
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  _preloadSfx() {
    const ctx = this._ctx;
    if (!ctx) return;
    for (const [key, file] of Object.entries(SFX_BY_KEY)) {
      fetch(urlPublicAudio(file))
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
        .then((ab) => ctx.decodeAudioData(ab.slice(0)))
        .then((buf) => {
          this._sfxBuffers.set(key, buf);
        })
        .catch(() => {});
    }
  }

  play(name) {
    this.playAtRate(name, 1.0);
  }

  /** Play a buffered SFX at a given playback rate (pitch shift). Falls back to synth. */
  playAtRate(name, rate = 1.0) {
    if (this._muted || !this._initialized || !this._ctx) return;

    const specVol = SFX_SPECS[name]?.volume ?? 1;
    const buf = this._sfxBuffers.get(name);
    if (buf) {
      try {
        const ctx = this._ctx;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const g = ctx.createGain();
        g.gain.value = this._sfxVolume * specVol;
        src.connect(g);
        g.connect(ctx.destination);
        src.start();
      } catch (_) {}
      return;
    }

    this._playSynth(name, rate, specVol);
  }

  _playSynth(name, rate = 1.0, volMult = 1) {
    const defs = {
      laser: { freq: 880, type: 'sawtooth', duration: 0.12, decay: 0.08, vol: 0.15, sweep: 0.3 },
      missile: { freq: 440, type: 'square', duration: 0.25, decay: 0.15, vol: 0.2, sweep: -0.2 },
      plasma: { freq: 660, type: 'sine', duration: 0.18, decay: 0.1, vol: 0.18, sweep: 0.5 },
      hit: { freq: 220, type: 'sawtooth', duration: 0.08, decay: 0.05, vol: 0.12, sweep: -0.5 },
      explosion: {
        freq: 120,
        type: 'sawtooth',
        duration: 0.35,
        decay: 0.3,
        vol: 0.25,
        sweep: -0.8,
        noise: true,
      },
      bossExplosion: {
        freq: 80,
        type: 'sawtooth',
        duration: 0.7,
        decay: 0.6,
        vol: 0.35,
        sweep: -0.9,
        noise: true,
      },
      pickup: { freq: 1200, type: 'sine', duration: 0.1, decay: 0.08, vol: 0.15, sweep: 0.8 },
      rarePickup: { freq: 600, type: 'sine', duration: 0.25, decay: 0.2, vol: 0.2, sweep: 0.5 },
      shieldHit: { freq: 500, type: 'sine', duration: 0.15, decay: 0.1, vol: 0.15, sweep: 0.1 },
      playerDamage: { freq: 200, type: 'square', duration: 0.15, decay: 0.1, vol: 0.2, sweep: -0.3 },
      upgrade: { freq: 800, type: 'sine', duration: 0.4, decay: 0.35, vol: 0.25, sweep: 0.6 },
      hover: { freq: 600, type: 'sine', duration: 0.06, decay: 0.04, vol: 0.06, sweep: 0.1 },
      launch: { freq: 300, type: 'sawtooth', duration: 0.5, decay: 0.4, vol: 0.3, sweep: 0.4 },
      crit: { freq: 1400, type: 'sine', duration: 0.15, decay: 0.1, vol: 0.2, sweep: 0.9 },
      roundComplete: { freq: 600, type: 'sine', duration: 0.6, decay: 0.5, vol: 0.3, sweep: 0.7 },
      death: { freq: 220, type: 'sine', duration: 0.55, decay: 0.5, vol: 0.2, sweep: -0.45 },
      droneSpawn: { freq: 400, type: 'sine', duration: 0.45, decay: 0.38, vol: 0.22, sweep: 0.55 },
      manualShot: { freq: 320, type: 'sawtooth', duration: 0.2, decay: 0.14, vol: 0.22, sweep: -0.55 },
      manualOverheat: { freq: 280, type: 'sawtooth', duration: 1.0, decay: 0.9, vol: 0.28, sweep: -0.75, noise: true },
      warning: { freq: 520, type: 'square', duration: 0.6, decay: 0.5, vol: 0.22, sweep: -0.2 },
      warp: { freq: 180, type: 'sawtooth', duration: 2.4, decay: 2.0, vol: 0.3, sweep: 1.4, noise: true },
      railgunCharge: { freq: 80, type: 'sawtooth', duration: 2.5, decay: 2.4, vol: 0.28, sweep: 6.0 },
      railgunFire: { freq: 200, type: 'sawtooth', duration: 0.35, decay: 0.28, vol: 0.38, sweep: -0.85, noise: true },
      bossNovaExplosion: { freq: 40, type: 'sawtooth', duration: 5.0, decay: 4.8, vol: 0.5, sweep: -0.97, noise: true },
    };

    const def = defs[name];
    if (!def) return;

    try {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = def.type;
      osc.frequency.setValueAtTime(def.freq * rate, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(10, def.freq * rate * (1 + def.sweep)),
        t + def.duration
      );

      gain.gain.setValueAtTime(def.vol * this._sfxVolume * volMult, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + def.decay);

      osc.start(t);
      osc.stop(t + def.duration + 0.01);

      if (def.noise) {
        const bufferSize = ctx.sampleRate * def.duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(def.vol * this._sfxVolume * 0.6 * volMult, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + def.decay);
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(t);
        noise.stop(t + def.duration);
      }
    } catch (_) {}
  }

  playMusic(trackName, loop = true) {
    if (trackName === this._currentTrack) return;
    this._currentTrack = trackName;
    if (this._musicEl) {
      this._musicEl.pause();
    }
    const file = MUSIC_BY_KEY[trackName] ?? `${trackName}.mp3`;
    const path = urlPublicAudio(file);
    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = this._muted ? 0 : this._musicVolume;
    audio.play().catch(() => {});
    this._musicEl = audio;
  }

  stopMusic() {
    if (this._musicEl) {
      this._musicEl.pause();
      this._musicEl = null;
    }
    this._currentTrack = null;
  }

  pauseMusic() {
    if (this._musicEl) this._musicEl.pause();
  }

  resumeMusic() {
    if (this._musicEl) {
      this._musicEl.play().catch(() => {});
    }
  }

  setMusicVolume(v) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this._musicEl) {
      this._musicEl.volume = this._muted ? 0 : this._musicVolume;
    }
  }

  setSfxVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
  }

  setMuted(v) {
    this._muted = !!v;
    if (this._musicEl) {
      this._musicEl.volume = this._muted ? 0 : this._musicVolume;
    }
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  get muted()       { return this._muted; }
  get musicVolume() { return this._musicVolume; }
  get sfxVolume()   { return this._sfxVolume; }
}
