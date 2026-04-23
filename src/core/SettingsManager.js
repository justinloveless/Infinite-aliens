const STORAGE_KEY = 'ia-settings-v1';

export const KEYBIND_ACTIONS = [
  { id: 'moveUp',    label: 'Move Up' },
  { id: 'moveDown',  label: 'Move Down' },
  { id: 'moveLeft',  label: 'Move Left' },
  { id: 'moveRight', label: 'Move Right' },
];

export const GRAPHICS_QUALITY_OPTIONS = ['auto', 'high', 'medium', 'low'];

const DEFAULTS = {
  sfxVolume:        0.5,
  musicVolume:      0.25,
  voiceVolume:      0.9,
  voiceEnabled:     true,
  subtitlesEnabled: true,
  muted:            false,
  showFps:          false,
  cameraTiltEnabled: true,
  graphicsQuality:  'auto',
  keybinds: {
    moveUp:    'KeyW',
    moveDown:  'KeyS',
    moveLeft:  'KeyA',
    moveRight: 'KeyD',
  },
};

export class SettingsManager {
  constructor() {
    this._s = this._load();
    this._listeners = [];
  }

  // ---- Persistence ----

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          ...DEFAULTS,
          ...p,
          keybinds: { ...DEFAULTS.keybinds, ...(p.keybinds || {}) },
        };
      }
    } catch {}
    return { ...DEFAULTS, keybinds: { ...DEFAULTS.keybinds } };
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._s)); } catch {}
  }

  // ---- Getters ----

  get sfxVolume()    { return this._s.sfxVolume; }
  get musicVolume()  { return this._s.musicVolume; }
  get voiceVolume()  { return this._s.voiceVolume ?? DEFAULTS.voiceVolume; }
  get voiceEnabled()     { return this._s.voiceEnabled !== false; }
  get subtitlesEnabled() { return this._s.subtitlesEnabled !== false; }
  get muted()            { return this._s.muted; }
  get showFps()      { return !!this._s.showFps; }
  get cameraTiltEnabled() { return this._s.cameraTiltEnabled !== false; }
  get graphicsQuality() {
    const v = this._s.graphicsQuality;
    return GRAPHICS_QUALITY_OPTIONS.includes(v) ? v : 'auto';
  }
  getKeybind(action) { return this._s.keybinds[action] ?? DEFAULTS.keybinds[action]; }

  // ---- Setters (notify listeners + save) ----

  setSfxVolume(v) {
    this._s.sfxVolume = Math.max(0, Math.min(1, v));
    this._save();
    this._emit('sfxVolume', this._s.sfxVolume);
  }

  setMusicVolume(v) {
    this._s.musicVolume = Math.max(0, Math.min(1, v));
    this._save();
    this._emit('musicVolume', this._s.musicVolume);
  }

  setVoiceVolume(v) {
    this._s.voiceVolume = Math.max(0, Math.min(1, v));
    this._save();
    this._emit('voiceVolume', this._s.voiceVolume);
  }

  setVoiceEnabled(v) {
    this._s.voiceEnabled = !!v;
    this._save();
    this._emit('voiceEnabled', this._s.voiceEnabled);
  }

  setSubtitlesEnabled(v) {
    this._s.subtitlesEnabled = !!v;
    this._save();
    this._emit('subtitlesEnabled', this._s.subtitlesEnabled);
  }

  setMuted(v) {
    this._s.muted = !!v;
    this._save();
    this._emit('muted', this._s.muted);
  }

  setShowFps(v) {
    this._s.showFps = !!v;
    this._save();
    this._emit('showFps', this._s.showFps);
  }

  setCameraTiltEnabled(v) {
    this._s.cameraTiltEnabled = !!v;
    this._save();
    this._emit('cameraTiltEnabled', this._s.cameraTiltEnabled);
  }

  setGraphicsQuality(v) {
    const next = GRAPHICS_QUALITY_OPTIONS.includes(v) ? v : 'auto';
    this._s.graphicsQuality = next;
    this._save();
    this._emit('graphicsQuality', next);
  }

  setKeybind(action, code) {
    this._s.keybinds[action] = code;
    this._save();
    this._emit('keybinds', this._s.keybinds);
  }

  resetDefaults() {
    this._s = { ...DEFAULTS, keybinds: { ...DEFAULTS.keybinds } };
    this._save();
    this._emit('reset', this._s);
  }

  // ---- Subscriptions ----

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _emit(key, value) {
    this._listeners.forEach(fn => fn(key, value));
  }
}
