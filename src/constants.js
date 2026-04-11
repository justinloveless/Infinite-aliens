// ===== GAME CONSTANTS =====

export const GAME = {
  VERSION: 1,
  AUTO_SAVE_INTERVAL: 30000,  // ms
  OFFLINE_CAP: 8 * 3600,     // seconds
  OFFLINE_EFFICIENCY: 0.5,
};

export const ROUND = {
  BASE_ENEMIES: 5,
  ENEMY_SCALING: 1.08,        // enemies = floor(BASE * SCALING^(round-1))
  TRANSITION_DURATION: 2500,  // ms before opening tech tree
  MAX_CONCURRENT_ENEMIES: 15,
  SPAWN_INTERVAL_BASE: 2.5,   // seconds between spawns
  SPAWN_INTERVAL_MIN: 0.5,
};

export const PLAYER = {
  BASE_HP: 100,
  BASE_DAMAGE: 12,
  BASE_ATTACK_SPEED: 1.2,     // shots per second
  BASE_PROJECTILE_COUNT: 1,
  BASE_PROJECTILE_SPEED: 25,
  BASE_CRIT_CHANCE: 0.05,
  BASE_CRIT_MULT: 2.0,
  BASE_SHIELD: 0,
  BASE_SHIELD_REGEN: 0,
  BASE_HP_REGEN: 0,
  BASE_ARMOR: 0,
  BASE_SPEED: 3,
  BASE_MAGNET_RANGE: 4,
  BASE_LOOT_MULT: 1.0,
  STELLAR_DUST_RATE: 0,       // per second, unlocked via tree
  CLICK_COOLDOWN: 0.2,        // seconds
  COLLISION_RADIUS: 1.0,
};

export const ENEMY = {
  HP_SCALING: 1.12,           // per round
  DAMAGE_SCALING: 1.05,
  SPEED_SCALING: 1.005,
  SPAWN_Z: -55,
  CONTACT_Z: 2.5,             // z position to trigger contact damage
};

export const PLAY_AREA = {
  X_MIN: -18, X_MAX: 18,
  Y_SHIP: 0,
  Z_SHIP: 0,
  ENEMY_X_SPREAD: 16,
};

export const CURRENCIES = {
  scrapMetal:      { label: 'Scrap Metal',     icon: '⚙', color: '#aaaaaa' },
  plasmaCrystals:  { label: 'Plasma Crystals', icon: '◆', color: '#00f5ff' },
  bioEssence:      { label: 'Bio Essence',     icon: '✦', color: '#39ff14' },
  darkMatter:      { label: 'Dark Matter',     icon: '◉', color: '#9b30ff' },
  stellarDust:     { label: 'Stellar Dust',    icon: '★', color: '#ffd700' },
};

export const TECH_TREE = {
  BASE_SEED: 42,
  TIER_PRIME: 7919,
  ROOT_TIER_COUNTS: [1, 2, 3],   // forced counts for tiers 0, 1, 2
  MIN_NODES_PER_TIER: 2,
  MAX_NODES_PER_TIER: 4,
  COST_SCALING_BASE: 2.0,        // cost * COST_SCALING^tier
  EFFECT_TIER_BONUS: 0.05,       // +5% per tier on effect values
  LEVEL_COST_SCALING: 1.4,       // level cost * LEVEL_COST^currentLevel
  NODE_W: 130, NODE_H: 52,
  NODE_PADDING_X: 60,
  NODE_PADDING_Y: 90,
  GRID_OFFSET_X: 80,
  GRID_OFFSET_Y: 60,
};

export const SCENE = {
  FOG_NEAR: 40, FOG_FAR: 85,
  FOG_COLOR: 0x000011,
  AMBIENT_COLOR: 0x223344,
  AMBIENT_INTENSITY: 0.5,
  DIR_COLOR: 0xffffff,
  DIR_INTENSITY: 0.9,
};

export const BLOOM = {
  STRENGTH: 0.7,
  RADIUS: 0.4,
  THRESHOLD: 0.65,
};
