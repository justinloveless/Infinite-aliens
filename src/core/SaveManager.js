import { GAME } from '../constants.js';
import { eventBus, EVENTS } from './EventBus.js';
import { createInitialState, serializeState, deserializeState } from './GameState.js';

const SAVE_KEY = 'infinite_aliens_save';

export class SaveManager {
  constructor() {
    this._saveTimer = 0;
  }

  save(state, techTreeState) {
    const saveData = {
      ...JSON.parse(serializeState(state)),
      techTree: techTreeState.getSaveData(),
      lastActiveTime: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      eventBus.emit(EVENTS.GAME_SAVED);
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== GAME.VERSION) return null;
      return data;
    } catch {
      return null;
    }
  }

  clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  // Calculate offline earnings
  calculateOfflineEarnings(lastActiveTime, stellarDustRate) {
    const elapsed = Math.min(
      (Date.now() - lastActiveTime) / 1000,
      GAME.OFFLINE_CAP
    );
    if (elapsed < 60) return null; // Less than 1 min, skip

    const stellarDust = stellarDustRate * elapsed * GAME.OFFLINE_EFFICIENCY;
    return { elapsed, earnings: { stellarDust: Math.floor(stellarDust) } };
  }

  // Auto-save tick
  update(delta, state, techTreeState) {
    this._saveTimer += delta * 1000;
    if (this._saveTimer >= GAME.AUTO_SAVE_INTERVAL) {
      this._saveTimer = 0;
      this.save(state, techTreeState);
    }
  }
}
