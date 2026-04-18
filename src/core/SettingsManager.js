const STORAGE_KEY = 'ia-settings-v1';

export const KEYBIND_ACTIONS = [
  { id: 'moveUp',    label: 'Move Up' },
  { id: 'moveDown',  label: 'Move Down' },
  { id: 'moveLeft',  label: 'Move Left' },
  { id: 'moveRight', label: 'Move Right' },
];

const DEFAULTS = {
  sfxVolume:   0.5,
  musicVolume: 0.25,
  muted:       false,
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

  get sfxVolume()   { return this._s.sfxVolume; }
  get musicVolume() { return this._s.musicVolume; }
  get muted()       { return this._s.muted; }
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

  setMuted(v) {
    this._s.muted = !!v;
    this._save();
    this._emit('muted', this._s.muted);
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
