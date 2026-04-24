import { GAME, PLAYER, RUN } from '../constants.js';
import { eventBus, EVENTS } from './EventBus.js';
import {
  createInitialState, createInitialShip, createInitialInventory, createInitialShipsState,
  createItemInstance, serializeState, deserializeState,
} from './GameState.js';
import {
  getDefaultShipId, getShipDef, createLoadoutForShip,
  rebindShipAlias, applyShipBaseStatsToState,
} from '../data/ships.js';

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

  save(state) {
    const saveData = {
      ...JSON.parse(serializeState(state)),
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
      // v12: energy system added — inject player.energy if missing
      if (data.version === 11) {
        data.version = 12;
        if (data.player && data.player.energy === undefined) {
          data.player.energy = 100;
        }
      }
      // v13: ECS refactor — entity state no longer round-trips through `player`.
      // Old saves are incompatible because `computed` fields moved onto components.
      if (data.version === 12) return null;
      // v14: hangar / item slot system added — default ship struct on old saves;
      // legacy tech tree stays intact.
      if (data.version === 13) {
        data.version = 14;
        if (!data.ship) data.ship = createInitialShip();
      }
      // v15: credits currency + explicit unlockedSlots array (replaces slotCaps).
      if (data.version === 14) {
        data.version = 15;
        if (data.currencies && data.currencies.credits === undefined) {
          data.currencies.credits = 0;
        }
        if (data.ship) {
          if (!Array.isArray(data.ship.unlockedSlots)) {
            // Legacy slotCaps → pick the first N slots of each type as unlocked.
            const unlocked = ['weapon_mid'];
            const caps = data.ship.slotCaps || { weapon: 1, defense: 0, utility: 0 };
            if (caps.weapon > 1) unlocked.push('weapon_wing_l');
            if (caps.weapon > 2) unlocked.push('weapon_wing_r');
            if (caps.defense > 0) unlocked.push('defense_core');
            if (caps.defense > 1) unlocked.push('defense_hull');
            if (caps.utility > 0) unlocked.push('utility_aux');
            data.ship.unlockedSlots = unlocked;
          }
          delete data.ship.slotCaps;
        }
      }
      // v16: multi-ship roster. `state.ship` becomes a runtime alias onto the
      // selected loadout inside `state.ships`, and `ownedItems` is promoted to
      // a shared `state.inventory` array.
      if (data.version === 15) {
        data.version = 16;
        const defaultId = getDefaultShipId();
        const legacy = data.ship || createInitialShip();
        data.inventory = { ownedItems: Array.isArray(legacy.ownedItems) ? [...legacy.ownedItems] : ['main_cannon'] };
        data.ships = {
          selectedId: defaultId,
          ownedIds: [defaultId],
          loadouts: {
            [defaultId]: {
              slots: legacy.slots || createLoadoutForShip(getShipDef(defaultId)).slots,
              unlockedSlots: Array.isArray(legacy.unlockedSlots) ? [...legacy.unlockedSlots] : ['weapon_mid'],
              research: legacy.research || {},
            },
          },
        };
        delete data.ship;
      }
      // v17: galaxy campaign + boss arena + infinite mastery added
      if (data.version === 16) {
        data.version = 17;
        if (!data.campaign) {
          data.campaign = { galaxyIndex: 0, totalSectorsCleared: 0, infiniteMode: false, infiniteSector: 0 };
        }
        if (!data.bossArena) {
          data.bossArena = { active: false, subPhase: 'inactive', bossDefeated: false, gatesTotal: 3, gatesClosed: 0, buildProgress: 0 };
        }
        if (data.techTree && !data.techTree.masteryLevels) {
          data.techTree.masteryLevels = {};
        }
        // Inject researchMastery into every ship loadout
        if (data.ships?.loadouts) {
          for (const loadout of Object.values(data.ships.loadouts)) {
            if (!loadout.researchMastery) loadout.researchMastery = {};
          }
        }
      }
      // v18: arena interaction redesign — hold-E replaced with destructible
      // gate crystal rings, boss is optional. Save shape is unchanged; just
      // reset any in-flight arena state so stale subPhases don't persist.
      if (data.version === 17) {
        data.version = 18;
        if (data.bossArena) {
          data.bossArena.active = false;
          data.bossArena.subPhase = 'inactive';
          data.bossArena.gatesClosed = 0;
          data.bossArena.buildProgress = 0;
          data.bossArena.bossDefeated = false;
        }
      }
      // v19: item instances — ownedItems changes from string[] to ItemInstance[];
      // slot.installedItemId → installedInstanceId. Research progress is dropped
      // (all future upgrades live on instances via the new inline upgrade panel).
      if (data.version === 18) {
        data.version = 19;
        let seq = 0;
        const makeInst = (itemId) =>
          ({ instanceId: `inst_${Date.now()}_${seq++}`, itemId, upgrades: {} });

        const rawOwned = data.inventory?.ownedItems;
        const ownedItemIds = Array.isArray(rawOwned)
          ? rawOwned.filter(x => typeof x === 'string')
          : ['main_cannon'];

        // Build one instance per owned item and a fast lookup by itemId (first wins).
        const newInstances = ownedItemIds.map(id => makeInst(id));
        const firstInstByItemId = new Map();
        for (const inst of newInstances) {
          if (!firstInstByItemId.has(inst.itemId)) firstInstByItemId.set(inst.itemId, inst.instanceId);
        }

        // Migrate all ship slot installedItemId → installedInstanceId.
        if (data.ships?.loadouts) {
          for (const loadout of Object.values(data.ships.loadouts)) {
            for (const slot of Object.values(loadout.slots || {})) {
              if (slot && 'installedItemId' in slot) {
                const oldId = slot.installedItemId;
                slot.installedInstanceId = (oldId && firstInstByItemId.get(oldId)) || null;
                delete slot.installedItemId;
              }
            }
            delete loadout.research;
            delete loadout.researchMastery;
          }
        }
        if (data.inventory) data.inventory.ownedItems = newInstances;
      }
      // v20: tech tree removed. Drop techTree state from old saves.
      if (data.version === 19) {
        data.version = 20;
        delete data.techTree;
      }
      // v21: per-ship energy regen baseline added to player state.
      if (data.version === 20) {
        data.version = 21;
        if (data.player && data.player.energyRegen == null) {
          data.player.energyRegen = PLAYER.BASE_ENERGY_REGEN;
        }
      }
      if (data.version === 21) {
        data.version = 22;
        data.campaign ??= {};
        data.campaign.scannedItems ??= [];
        data.campaign.returnJourney ??= {
          active: false,
          currentGalaxy: 9,
          totalSectorsCleared: 0,
        };
      }
      if (data.version === 22) {
        data.version = 23;
        if (data.campaign) data.campaign.returnJourneyUnlocked ??= false;
      }
      if (data.version !== GAME.VERSION) return null;

      // Post-load: rehydrate transients + aliases that serializeState stripped.
      if (!data.inventory) data.inventory = createInitialInventory();
      if (!data.ships) data.ships = createInitialShipsState();
      rebindShipAlias(data);
      applyShipBaseStatsToState(data, getShipDef(data.ships.selectedId));
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
  update(delta, state) {
    this._saveTimer += delta * 1000;
    if (this._saveTimer >= GAME.AUTO_SAVE_INTERVAL) {
      this._saveTimer = 0;
      this.save(state);
    }
  }
}
