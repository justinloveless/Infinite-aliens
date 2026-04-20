// ===== GAME CONSTANTS =====

export const GAME = {
  VERSION: 16,
  AUTO_SAVE_INTERVAL: 30000,  // ms
  OFFLINE_CAP: 8 * 3600,     // seconds
  OFFLINE_EFFICIENCY: 0.5,
};

/** Continuous run: difficulty tier from distance; bosses at distance milestones. */
export const RUN = {
  DISTANCE_PER_TIER: 38,       // +1 effective tier (enemy scaling / unlocks) per this many units moved
  BOSS_DISTANCE_INTERVAL: 135, // first boss at this distance, then each +interval after the prior boss dies
  MAX_CONCURRENT_ENEMIES: 15,
  SPAWN_INTERVAL_BASE: 2.35,
  SPAWN_INTERVAL_MIN: 0.45,
  /** Seconds between spawns tightens slightly per tier (like old per-round curve). */
  SPAWN_INTERVAL_PER_TIER: 0.048,
};

/** @deprecated use RUN — kept for tech-tree copy / tooling that still says "round" */
export const ROUND = RUN;

export const PLAYER = {
  BASE_HP: 100,
  BASE_DAMAGE: 12,
  BASE_ATTACK_SPEED: 0.6,     // shots per second
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
  BASE_VISION_RANGE: 60,
  BASE_TARGETING_RANGE: 50,
  BASE_LOOT_MULT: 1.0,
  STELLAR_DUST_RATE: 0,       // per second, unlocked via tree
  CLICK_COOLDOWN: 0.2,        // seconds
  COLLISION_RADIUS: 1.0,
  // Stellar Nova (stellar_burst): AoE interval shrinks per upgrade level
  STELLAR_NOVA_BASE_INTERVAL: 8,
  STELLAR_NOVA_INTERVAL_PER_LEVEL: 1.25,
  STELLAR_NOVA_MIN_INTERVAL: 3.5,
  STELLAR_NOVA_BASE_DAMAGE: 32,
  STELLAR_NOVA_DAMAGE_PER_LEVEL: 16,
  STELLAR_NOVA_BASE_RADIUS: 4.5,
  STELLAR_NOVA_RADIUS_PER_LEVEL: 0.65,
};

/** Dropped currency: drift toward ship; magnet range boosts pull speed (pickup is on contact). */
export const LOOT = {
  DRIFT_SPEED: 5,
  /** Speed multiplier while inside the magnet radius (horizontal dist). */
  MAGNET_MULT_BASE: 2.15,
  /** Extra multiplier per unit of magnet range above the player base. */
  MAGNET_MULT_PER_RANGE: 0.065,
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
  credits:         { label: 'Credits',         icon: '⬡', color: '#ffb347' },
  scrapMetal:      { label: 'Scrap Metal',     icon: '⚙', color: '#aaaaaa' },
  plasmaCrystals:  { label: 'Plasma Crystals', icon: '◆', color: '#00f5ff' },
  bioEssence:      { label: 'Bio Essence',     icon: '✦', color: '#39ff14' },
  darkMatter:      { label: 'Dark Matter',     icon: '◉', color: '#9b30ff' },
  stellarDust:     { label: 'Stellar Dust',    icon: '★', color: '#ffd700' },
};

export const TECH_TREE = {
  // Deterministic radial layout: four branches from ring-0 starters + specials on diagonals (see TechTreeGenerator).
  CENTER_RADIUS: 150,            // Radius of ring 0 (the starter ring)
  RING_SPACING: 110,             // Distance between consecutive rings
  /** Angular width of each branch sector (radians). π/4 = 45°. */
  BRANCH_SLICE_RAD: Math.PI / 4,
  /** Min / max nodes per main branch per ring (ring ≥ 1); count scales with ring radius (see TechTreeGenerator). */
  BRANCH_NODES_MIN: 2,
  BRANCH_NODES_MAX: 12,
  /** Min center-to-center spacing along the ring ≈ NODE_W * this, in layout px, vs ring radius → angular gap. */
  BRANCH_NODE_SEPARATION_MULT: 1.12,
  COST_SCALING_BASE: 2.0,        // cost * COST_SCALING^(ring/2)
  EFFECT_TIER_BONUS: 0.05,       // +5% per ring on effect values
  LEVEL_COST_SCALING: 1.4,       // level cost * LEVEL_COST^currentLevel
  /** Fraction of the original level price returned when selling one level (right-click node). */
  SELL_REFUND_FRACTION: 0.5,
  NODE_W: 124, NODE_H: 48,
};

export const SCENE = {
  FOG_NEAR: 40, FOG_FAR: 85,
  FOG_COLOR: 0x3e2f6f,
  AMBIENT_COLOR: 0x2f4f6f,
  AMBIENT_INTENSITY: 0.7,
  DIR_COLOR: 0xffffff,
  DIR_INTENSITY: 2.13,
};

export const BLOOM = {
  STRENGTH: 0.45,
  RADIUS: 0.74,
  THRESHOLD: 0.65,
};

// ===== UPGRADE GRAMMAR ENUMS =====

export const EFFECT_OPERATORS = {
  MULTIPLY:   'multiply',
  ADD:        'add',
  SET:        'set',
  ADD_WEAPON: 'add_weapon',
  SPECIAL:    'special',
  MIN:        'min',       // stat = Math.max(stat, value) — floor
  MAX:        'max',       // stat = Math.min(stat, value) — cap
  APPEND:     'append',    // push string into a named array
  TOGGLE:     'toggle',    // stat = !stat
  ADD_FLAT:   'add_flat',  // stat += value (no level scaling)
};

export const SCALE_MODES = {
  LINEAR:      'linear',       // value * level
  EXPONENTIAL: 'exponential',  // value ^ level
  FIXED:       'fixed',        // value (level ignored)
  DIMINISHING: 'diminishing',  // diminishing returns per level
};

export const EFFECT_TARGETS = {
  PLAYER:   'player',   // modifies computed player stats (default)
  ENEMY:    'enemy',    // modifies enemyModifiers (applied at spawn)
  CURRENCY: 'currency', // modifies loot rates or passive rates
  ROUND:    'round',    // modifies round spawn parameters
};

export const CONDITION_TYPES = {
  STAT_GTE:   'stat_gte',    // computed[stat] >= threshold
  STAT_LTE:   'stat_lte',    // computed[stat] <= threshold
  ROUND_GTE:  'round_gte',   // state.round.current (sector from distance) >= threshold
  ROUND_LTE:  'round_lte',   // state.round.current <= threshold
  PHASE_IS:   'phase_is',    // state.round.phase === value
  NODE_OWNED: 'node_owned',  // templateId is unlocked
  LEVEL_GTE:  'level_gte',   // this node's currentLevel >= threshold
};

export const TRIGGER_EVENTS = {
  ON_KILL:         'enemy:killed',
  ON_HIT:          'enemy:damaged',
  ON_DAMAGE_TAKEN: 'player:damaged',
  ON_HEAL:         'player:healed',
  ON_ROUND_START:  'round:started',
  ON_ROUND_END:    'round:complete',
  ON_LOOT_COLLECT: 'loot:collected',
};

export const TRIGGER_ACTIONS = {
  HEAL_PLAYER:  'heal_player',
  BOOST_STAT:   'boost_stat',
  EMIT_DAMAGE:  'emit_damage',
  ADD_CURRENCY: 'add_currency',
};

export const RARITY_TIERS = {
  COMMON:    'common',
  UNCOMMON:  'uncommon',
  RARE:      'rare',
  EPIC:      'epic',
  LEGENDARY: 'legendary',
};

export const RARITY_META = {
  common:    { color: '#aaaaaa', glowColor: '#888888', borderAnim: 'none'   },
  uncommon:  { color: '#44ff88', glowColor: '#00aa44', borderAnim: 'none'   },
  rare:      { color: '#4488ff', glowColor: '#0044ff', borderAnim: 'pulse'  },
  epic:      { color: '#cc44ff', glowColor: '#8800cc', borderAnim: 'pulse'  },
  legendary: { color: '#ffd700', glowColor: '#ff8800', borderAnim: 'rotate' },
};

export const MANUAL_GUN = {
  HEAT_PER_SHOT:     20,
  HEAT_MAX:         100,
  HEAT_COOL_RATE:    25,   // units per second
  OVERHEAT_DURATION:  2.0, // seconds locked after overheating
  FIRE_COOLDOWN:      0.12, // minimum seconds between shots
};

/** Warp gate system: gates unlock every N tiers reached and allow starting a new run mid-progression. */
export const WARP = {
  GATE_TIER_INTERVAL: 10,   // a new gate unlocks every 10 tiers reached
};

export const ASTEROID = {
  SPAWN_INTERVAL: 5.0, // seconds between large asteroid spawns
};

export const ENERGY = {
  BASE_MAX:   100,
  BASE_REGEN:   0,   // zero until generators are installed
};

export const BEAM_LASER = {
  ON_DURATION:  1.0,  // seconds the beam fires continuously
  OFF_DURATION: 2.0,  // seconds recharging between bursts
  TICK_RATE:    0.05, // damage applied every 50 ms (20 ticks/sec)
  DAMAGE_RATIO: 0.02, // fraction of player.damage per tick
};
