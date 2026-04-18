import { PLAYER, GAME, ENERGY } from '../constants.js';

export function createInitialState() {
  return {
    version: GAME.VERSION,
    seed: Math.floor(Math.random() * 0xffffffff),

    // Run progression (tier in `current` is derived from distance during combat)
    round: {
      current: 1,
      phase: 'start',          // 'start' | 'combat' | 'dead'
      distanceTraveled: 0,
      enemiesDefeated: 0,
      bossesDefeated: 0,
      bossIsActive: false,
      killsThisRun: 0,
      /** When set, auto-attack prefers this enemy until it dies (requires Priority Designator upgrade). */
      manualFocusEnemyId: null,
    },

    // Stats from the most recently completed run — null on a fresh save
    lastRun: null,

    // Player base stats (upgrades modify computedStats, not these)
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
      projectileType: 'laser',  // 'laser' | 'missile' | 'plasma'
      hasDrone: false,
      /** Continuous aimed turret fire (primary + side turrets + beam); false = manual nose cannon only until upgraded. */
      hasAutoFire: false,
      hasVampire: false,
      hasDamageReflect: false,
      hasOvercharge: false,
      overchargeCounter: 0,
      energy: ENERGY.BASE_MAX,
    },

    // Computed stats (rebuilt when upgrades change)
    computed: null,

    // Currencies
    currencies: {
      scrapMetal: 0,
      plasmaCrystals: 0,
      bioEssence: 0,
      darkMatter: 0,
      stellarDust: 0,
    },

    // Loot earned this combat session (HUD / debugging)
    roundLoot: {},

    // Tech tree
    techTree: {
      unlockedNodes: {},      // { nodeId: currentLevel }
      generatedTiers: 0,      // how many tiers have been generated
    },

    // Warp gates (persistent across runs)
    warpGates: {
      maxTierReached: 0,   // highest tier ever reached; new gates unlock every 10 tiers
    },

    // Timestamps
    lastSaveTime: Date.now(),
    lastActiveTime: Date.now(),
  };
}

// Deep clone the state (for saves)
export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
