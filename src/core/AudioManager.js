// Audio manager using Web Audio API for SFX + <audio> elements for music
export class AudioManager {
  constructor() {
    this._ctx = null;
    this._muted = false;
    this._sfxVolume = 0.5;
    this._musicVolume = 0.25;
    this._musicEl = null;
    this._currentTrack = null;
    this._initialized = false;
  }

  // Must be called after a user gesture
  init() {
    if (this._initialized) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  // Play a procedurally generated synth sound (no files needed)
  play(name) {
    if (this._muted || !this._initialized || !this._ctx) return;

    const defs = {
      laser:       { freq: 880, type: 'sawtooth', duration: 0.12, decay: 0.08, vol: 0.15, sweep: 0.3 },
      missile:     { freq: 440, type: 'square',   duration: 0.25, decay: 0.15, vol: 0.2,  sweep: -0.2 },
      plasma:      { freq: 660, type: 'sine',      duration: 0.18, decay: 0.1,  vol: 0.18, sweep: 0.5 },
      hit:         { freq: 220, type: 'sawtooth', duration: 0.08, decay: 0.05, vol: 0.12, sweep: -0.5 },
      explosion:   { freq: 120, type: 'sawtooth', duration: 0.35, decay: 0.3,  vol: 0.25, sweep: -0.8, noise: true },
      bossExplosion:{ freq: 80, type: 'sawtooth', duration: 0.7,  decay: 0.6,  vol: 0.35, sweep: -0.9, noise: true },
      pickup:      { freq: 1200, type: 'sine',    duration: 0.1,  decay: 0.08, vol: 0.15, sweep: 0.8 },
      rarePickup:  { freq: 600, type: 'sine',     duration: 0.25, decay: 0.2,  vol: 0.2,  sweep: 0.5 },
      shieldHit:   { freq: 500, type: 'sine',     duration: 0.15, decay: 0.1,  vol: 0.15, sweep: 0.1 },
      playerDamage:{ freq: 200, type: 'square',   duration: 0.15, decay: 0.1,  vol: 0.2,  sweep: -0.3 },
      upgrade:     { freq: 800, type: 'sine',     duration: 0.4,  decay: 0.35, vol: 0.25, sweep: 0.6 },
      hover:       { freq: 600, type: 'sine',     duration: 0.06, decay: 0.04, vol: 0.06, sweep: 0.1 },
      launch:      { freq: 300, type: 'sawtooth', duration: 0.5,  decay: 0.4,  vol: 0.3,  sweep: 0.4 },
      crit:        { freq: 1400, type: 'sine',    duration: 0.15, decay: 0.1,  vol: 0.2,  sweep: 0.9 },
      roundComplete:{ freq: 600, type: 'sine',    duration: 0.6,  decay: 0.5,  vol: 0.3,  sweep: 0.7 },
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
      osc.frequency.setValueAtTime(def.freq, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(10, def.freq * (1 + def.sweep)),
        t + def.duration
      );

      gain.gain.setValueAtTime(def.vol * this._sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + def.decay);

      osc.start(t);
      osc.stop(t + def.duration + 0.01);

      // Noise layer for explosions
      if (def.noise) {
        const bufferSize = ctx.sampleRate * def.duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(def.vol * this._sfxVolume * 0.6, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + def.decay);
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(t);
        noise.stop(t + def.duration);
      }
    } catch (e) {
      // Ignore audio errors silently
    }
  }

  // Play background music from a file path
  playMusic(trackName, loop = true) {
    if (trackName === this._currentTrack) return;
    this._currentTrack = trackName;
    // Music file support is optional - just set up the infrastructure
    // Files would go in public/audio/
    if (this._musicEl) {
      this._musicEl.pause();
    }
    const path = `./audio/${trackName}.mp3`;
    const audio = new Audio(path);
    audio.loop = loop;
    audio.volume = this._muted ? 0 : this._musicVolume;
    audio.play().catch(() => {}); // Ignore autoplay restrictions
    this._musicEl = audio;
  }

  stopMusic() {
    if (this._musicEl) {
      this._musicEl.pause();
      this._musicEl = null;
    }
    this._currentTrack = null;
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._musicEl) {
      this._musicEl.volume = this._muted ? 0 : this._musicVolume;
    }
    return this._muted;
  }

  get muted() { return this._muted; }
}
