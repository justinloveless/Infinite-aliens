import { PLAYER, GAME, ENERGY } from '../constants.js';
import {
  getDefaultShipId, getShipDef, createLoadoutForShip,
  rebindShipAlias, applyShipBaseStatsToState,
} from '../data/ships.js';

/**
 * Legacy shape of `state.ship` used by the v14 migration path. Preserved so
 * pre-v16 saves can be upgraded through v14 → v15 → v16 using the existing
 * migration blocks. New game state uses `createInitialShipsState()` instead.
 */
export function createInitialShip() {
  const defaultId = getDefaultShipId();
  const def = getShipDef(defaultId);
  const loadout = createLoadoutForShip(def);
  return {
    slots: loadout.slots,
    ownedItems: ['main_cannon'],
    unlockedSlots: [...(loadout.unlockedSlots || ['weapon_mid'])],
    research: {},
  };
}

/** Fresh multi-ship roster: only the default ship is owned + selected. */
export function createInitialShipsState() {
  const defaultId = getDefaultShipId();
  const def = getShipDef(defaultId);
  return {
    selectedId: defaultId,
    ownedIds: [defaultId],
    loadouts: {
      [defaultId]: createLoadoutForShip(def),
    },
  };
}

export function createInitialInventory() {
  return { ownedItems: ['main_cannon'] };
}

export function createInitialState() {
  const state = {
    version: GAME.VERSION,
    seed: Math.floor(Math.random() * 0xffffffff),

    round: {
      current: 1,
      phase: 'start',
      distanceTraveled: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      bossIsActive: false,
      killsThisRun: 0,
      /** When set, auto-attack prefers this enemy until it dies (requires Priority Designator upgrade). */
      manualFocusEnemyId: null,
    },

    lastRun: null,

    player: {
      hp: PLAYER.BASE_HP,
      maxHp: PLAYER.BASE_HP,
      shieldHp: PLAYER.BASE_SHIELD,
      maxShieldHp: PLAYER.BASE_SHIELD,
      damage: PLAYER.BASE_DAMAGE,
      attackSpeed: PLAYER.BASE_ATTACK_SPEED,
      projectileCount: PLAYER.BASE_PROJECTILE_COUNT,
      projectileSpeed: PLAYER.BASE_PROJECTILE_SPEED,
      critChance: PLAYER.BASE_CRIT_CHANCE,
      critMultiplier: PLAYER.BASE_CRIT_MULT,
      shieldRegen: PLAYER.BASE_SHIELD_REGEN,
      hpRegen: PLAYER.BASE_HP_REGEN,
      armor: PLAYER.BASE_ARMOR,
      speed: PLAYER.BASE_SPEED,
      magnetRange: PLAYER.BASE_MAGNET_RANGE,
      visionRange: PLAYER.BASE_VISION_RANGE,
      targetingRange: PLAYER.BASE_TARGETING_RANGE,
      lootMultiplier: PLAYER.BASE_LOOT_MULT,
      stellarDustRate: PLAYER.STELLAR_DUST_RATE,
      projectileType: 'laser',
      hasDrone: false,
      hasAutoFire: false,
      hasVampire: false,
      hasDamageReflect: false,
      hasOvercharge: false,
      overchargeCounter: 0,
      energy: ENERGY.BASE_MAX,
    },

    computed: null,

    currencies: {
      credits: 0,
      scrapMetal: 0,
      plasmaCrystals: 0,
      bioEssence: 0,
      darkMatter: 0,
      stellarDust: 0,
    },

    roundLoot: {},

    techTree: {
      unlockedNodes: {},
      generatedTiers: 0,
    },

    warpGates: {
      maxTierReached: 0,
    },

    // Shared inventory: items owned across all ships.
    inventory: createInitialInventory(),
    // Roster of ships + per-ship loadouts. `ship` below is a live alias to the
    // currently-selected loadout (with `ownedItems` shared from `inventory`).
    ships: createInitialShipsState(),

    lastSaveTime: Date.now(),
    lastActiveTime: Date.now(),
  };

  rebindShipAlias(state);
  applyShipBaseStatsToState(state, getShipDef(state.ships.selectedId));
  return state;
}

/**
 * Serialize the state for persistence. `state.ship` is a live alias onto the
 * active loadout, so we strip it before JSON-serializing (otherwise the save
 * would contain two diverging copies of the same loadout after a ship swap).
 * `_computed` and `_unlockedTemplates` are transient caches and are also
 * stripped.
 */
export function serializeState(state) {
  const { ship, _computed, _unlockedTemplates, ...persistable } = state;
  void ship; void _computed; void _unlockedTemplates;
  return JSON.stringify(persistable);
}

export function deserializeState(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
