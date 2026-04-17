import { GAME, RUN } from '../constants.js';
import { eventBus, EVENTS } from './EventBus.js';
import { createInitialState, serializeState, deserializeState } from './GameState.js';

const SAVE_KEY = 'infinite_aliens_save';

function migrateSaveToV3(data) {
  if (!data.round) return;
  const r = data.round;
  if (r.distanceTraveled == null) {
    r.distanceTraveled = Math.max(0, ((r.current || 1) - 1) * RUN.DISTANCE_PER_TIER);
  }
  if (r.bossesDefeated == null) {
    r.bossesDefeated = Math.max(0, Math.floor(((r.current || 1) - 1) / 5));
  }
  r.bossIsActive = false;
  delete r.enemiesRequired;
}

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
      if (data.version === 2) {
        migrateSaveToV3(data);
        data.version = 3;
      }
      // v4: tech tree node ids / graph layout changed — reset tech progress so saves stay consistent
      if (data.version === 3) {
        data.version = 4;
        data.techTree = { unlockedNodes: {}, generatedTiers: 0 };
      }
      // v5: multi-node-per-ring branch slices — reset tech (node indices / graph changed)
      if (data.version === 4) {
        data.version = 5;
        data.techTree = { unlockedNodes: {}, generatedTiers: 0 };
      }
      // v6: branch node count scales with ring radius — reset tech (graph shape changed)
      if (data.version === 5) {
        data.version = 6;
        data.techTree = { unlockedNodes: {}, generatedTiers: 0 };
      }
      // v7: specials pack per diagonal per ring — reset tech (graph shape changed)
      if (data.version === 6) {
        data.version = 7;
        data.techTree = { unlockedNodes: {}, generatedTiers: 0 };
      }
      // v8: warp gate system added
      if (data.version === 7) {
        data.version = 8;
        if (!data.warpGates) {
          data.warpGates = { maxTierReached: 0 };
        }
      }
      // v9: vision and targeting range stats added
      if (data.version === 8) {
        data.version = 9;
        if (data.player) {
          if (data.player.visionRange == null) data.player.visionRange = 60;
          if (data.player.targetingRange == null) data.player.targetingRange = 50;
        }
      }
      // v10: transient manual focus field on round (null on load)
      if (data.version === 9) {
        data.version = 10;
        if (data.round && data.round.manualFocusEnemyId === undefined) {
          data.round.manualFocusEnemyId = null;
        }
      }
      // v11: auto turret is an upgrade — existing saves keep prior always-on behavior
      if (data.version === 10) {
        data.version = 11;
        if (data.player && data.player.hasAutoFire === undefined) {
          data.player.hasAutoFire = true;
        }
      }
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
