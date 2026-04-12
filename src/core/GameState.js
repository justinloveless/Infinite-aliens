import { PLAYER, GAME, ROUND } from '../constants.js';

export function createInitialState() {
  return {
    version: GAME.VERSION,
    seed: Math.floor(Math.random() * 0xffffffff),

    // Round info
    round: {
      current: 1,
      phase: 'start',          // 'start' | 'combat' | 'vacuum' | 'transition' | 'upgrade'
      enemiesDefeated: 0,
      enemiesRequired: ROUND.BASE_ENEMIES,
      totalEnemiesDefeated: 0,
    },

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
      lootMultiplier: PLAYER.BASE_LOOT_MULT,
      stellarDustRate: PLAYER.STELLAR_DUST_RATE,
      projectileType: 'laser',  // 'laser' | 'missile' | 'plasma'
      hasDrone: false,
      hasVampire: false,
      hasDamageReflect: false,
      hasOvercharge: false,
      overchargeCounter: 0,
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

    // Loot earned this round (for transition display)
    roundLoot: {},

    // Tech tree
    techTree: {
      unlockedNodes: {},      // { nodeId: currentLevel }
      generatedTiers: 0,      // how many tiers have been generated
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
