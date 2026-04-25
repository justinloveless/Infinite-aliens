import * as THREE from 'three';

/** Shared enemy type definitions used by the createEnemy prefab. */
export const ENEMY_DEFS = {
  scout: {
    type: 'scout',
    geometry: new THREE.ConeGeometry(0.45, 1.3, 5),
    color: 0x44ee44,
    baseHp: 20,
    baseDamage: 5,
    baseSpeed: 4.5,
    collisionRadius: 0.55,
    behavior: 'charge',
    eyeZ: 0.35,
    scale: 1,
    loot: [
      { currency: 'credits', min: 1, max: 3 },
      { currency: 'scrapMetal', min: 2, max: 5 },
      { currency: 'plasmaCrystals', min: 0, max: 1 },
      { currency: 'bioEssence', min: 0, max: 1 },
    ],
    spawnWeight: 40,
  },
  tank: {
    type: 'tank',
    geometry: new THREE.BoxGeometry(1.3, 0.8, 1.5),
    color: 0x888899,
    baseHp: 80,
    baseDamage: 10,
    baseSpeed: 1.6,
    collisionRadius: 1.1,
    behavior: 'steady',
    eyeZ: 0.45,
    scale: 1,
    loot: [
      { currency: 'credits', min: 4, max: 8 },
      { currency: 'scrapMetal', min: 5, max: 12 },
    ],
    spawnWeight: 20,
  },
  swarm: {
    type: 'swarm',
    geometry: new THREE.TetrahedronGeometry(0.5),
    color: 0x88ff88,
    baseHp: 10,
    baseDamage: 3,
    baseSpeed: 5.5,
    collisionRadius: 0.45,
    behavior: 'zigzag',
    eyeZ: 0.25,
    scale: 0.9,
    loot: [
      { currency: 'credits', min: 1, max: 2 },
      { currency: 'bioEssence', min: 1, max: 3 },
    ],
    spawnWeight: 25,
    spawnCount: 3,
  },
  sniper: {
    type: 'sniper',
    geometry: new THREE.OctahedronGeometry(0.6),
    color: 0xff4499,
    baseHp: 30,
    baseDamage: 15,
    attackSpeed: 0.5,
    baseSpeed: 2.2,
    collisionRadius: 0.65,
    behavior: 'keepRange',
    keepRangeDist: 14,
    eyeZ: 0.35,
    scale: 1,
    loot: [
      { currency: 'credits', min: 3, max: 6 },
      { currency: 'plasmaCrystals', min: 2, max: 5 },
      { currency: 'scrapMetal', min: 1, max: 3 },
    ],
    spawnWeight: 15,
  },
  boss: {
    type: 'boss',
    geometry: new THREE.TorusKnotGeometry(5, 1.8, 100, 16),
    color: 0xaa00ff,
    baseHp: 300,
    baseDamage: 20,
    baseSpeed: 1.2,
    collisionRadius: 9,
    behavior: 'boss',
    scale: 1,
    loot: [
      { currency: 'credits', min: 25, max: 50 },
      { currency: 'darkMatter', min: 1, max: 3 },
      { currency: 'scrapMetal', min: 15, max: 30 },
      { currency: 'plasmaCrystals', min: 8, max: 15 },
      { currency: 'bioEssence', min: 5, max: 10 },
    ],
    spawnWeight: 0,
  },

  // —— Counter campaign enemies (spawnWeight > 0 in pool when injected) ——
  zigzagger: {
    type: 'zigzagger',
    geometry: new THREE.ConeGeometry(0.35, 1.0, 4),
    color: 0xff6600,
    baseHp: 25, baseDamage: 8, baseSpeed: 6.5, collisionRadius: 0.4,
    behavior: 'zigzag_fast', eyeZ: 0.3, scale: 0.85, spawnWeight: 16,
    loot: [{ currency: 'credits', min: 2, max: 4 }],
  },
  mirror_drone: {
    type: 'mirror_drone',
    geometry: new THREE.OctahedronGeometry(0.55),
    color: 0x88eeff,
    baseHp: 32, baseDamage: 6, baseSpeed: 3.2, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 14, attackSpeed: 0.35, eyeZ: 0.3, scale: 0.9, spawnWeight: 14,
    loot: [{ currency: 'plasmaCrystals', min: 1, max: 3 }],
  },
  flare_ship: {
    type: 'flare_ship',
    geometry: new THREE.ConeGeometry(0.4, 1.1, 5),
    color: 0xffaa44,
    baseHp: 28, baseDamage: 7, baseSpeed: 4.0, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 16, eyeZ: 0.35, scale: 0.88, spawnWeight: 12,
    loot: [{ currency: 'scrapMetal', min: 2, max: 5 }],
  },
  plasma_eater: {
    type: 'plasma_eater',
    geometry: new THREE.DodecahedronGeometry(0.5),
    color: 0xff00cc,
    baseHp: 40, baseDamage: 9, baseSpeed: 2.8, collisionRadius: 0.55,
    behavior: 'steady', eyeZ: 0.3, scale: 1, spawnWeight: 14,
    loot: [{ currency: 'plasmaCrystals', min: 2, max: 6 }],
  },
  prism_shard: {
    type: 'prism_shard',
    geometry: new THREE.TetrahedronGeometry(0.55),
    color: 0xff1133,
    baseHp: 30, baseDamage: 10, baseSpeed: 3.4, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 13, attackSpeed: 0.45, eyeZ: 0.28, scale: 0.92, spawnWeight: 13,
    loot: [{ currency: 'credits', min: 3, max: 6 }],
  },
  fortress: {
    type: 'fortress',
    geometry: new THREE.BoxGeometry(2.0, 2.0, 2.5),
    color: 0x556677,
    baseHp: 180, baseDamage: 15, baseSpeed: 0.8, baseArmor: 50, collisionRadius: 1.6,
    behavior: 'steady', eyeZ: 0.55, scale: 1, spawnWeight: 10,
    loot: [{ currency: 'scrapMetal', min: 10, max: 20 }],
  },
  titan: {
    type: 'titan',
    geometry: new THREE.BoxGeometry(1.4, 1.6, 1.2),
    color: 0x6688aa,
    baseHp: 90, baseDamage: 18, baseSpeed: 1.4, collisionRadius: 1.0,
    behavior: 'charge', eyeZ: 0.4, scale: 1, spawnWeight: 12,
    loot: [{ currency: 'scrapMetal', min: 4, max: 10 }],
  },
  corroder: {
    type: 'corroder',
    geometry: new THREE.IcosahedronGeometry(0.45, 0),
    color: 0x88aa44,
    baseHp: 35, baseDamage: 5, baseSpeed: 3.0, collisionRadius: 0.48,
    behavior: 'charge', eyeZ: 0.25, scale: 0.95, spawnWeight: 14,
    loot: [{ currency: 'bioEssence', min: 1, max: 3 }],
  },
  nullifier: {
    type: 'nullifier',
    geometry: new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8),
    color: 0x00ccff,
    baseHp: 34, baseDamage: 6, baseSpeed: 2.6, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 15, attackSpeed: 0.28, eyeZ: 0.32, scale: 0.9, spawnWeight: 12,
    stripPlayerShield: true,
    loot: [{ currency: 'plasmaCrystals', min: 1, max: 4 }],
  },
  scatter_drone: {
    type: 'scatter_drone',
    geometry: new THREE.TorusGeometry(0.35, 0.12, 6, 16),
    color: 0xffcc00,
    baseHp: 22, baseDamage: 4, baseSpeed: 4.2, collisionRadius: 0.45,
    behavior: 'zigzag', eyeZ: 0.22, scale: 0.85, spawnWeight: 14,
    loot: [{ currency: 'credits', min: 2, max: 5 }],
  },
  anchor_mine: {
    type: 'anchor_mine',
    geometry: new THREE.OctahedronGeometry(0.5),
    color: 0x886644,
    baseHp: 38, baseDamage: 8, baseSpeed: 2.2, collisionRadius: 0.52,
    behavior: 'steady', eyeZ: 0.3, scale: 1, spawnWeight: 11,
    loot: [{ currency: 'scrapMetal', min: 3, max: 7 }],
  },
  repair_jammer: {
    type: 'repair_jammer',
    geometry: new THREE.ConeGeometry(0.4, 1.0, 6),
    color: 0x44ff66,
    baseHp: 26, baseDamage: 5, baseSpeed: 3.6, collisionRadius: 0.46,
    behavior: 'keepRange', keepRangeDist: 16, eyeZ: 0.3, scale: 0.88, spawnWeight: 13,
    loot: [{ currency: 'bioEssence', min: 1, max: 2 }],
  },
  gravity_anchor: {
    type: 'gravity_anchor',
    geometry: new THREE.SphereGeometry(0.55, 10, 10),
    color: 0x6633ff,
    baseHp: 45, baseDamage: 7, baseSpeed: 2.0, collisionRadius: 0.58,
    behavior: 'keepRange', keepRangeDist: 14, eyeZ: 0.3, scale: 1, spawnWeight: 12,
    loot: [{ currency: 'darkMatter', min: 0, max: 1 }],
  },
  ghost_ship: {
    type: 'ghost_ship',
    geometry: new THREE.ConeGeometry(0.42, 1.2, 5),
    color: 0xaaaaee,
    baseHp: 20, baseDamage: 6, baseSpeed: 4.8, collisionRadius: 0.48,
    behavior: 'charge', eyeZ: 0.3, scale: 0.82, spawnWeight: 15,
    loot: [{ currency: 'credits', min: 2, max: 4 }],
  },
  wreck_animator: {
    type: 'wreck_animator',
    geometry: new THREE.BoxGeometry(0.7, 0.5, 0.9),
    color: 0x88ff44,
    baseHp: 36, baseDamage: 6, baseSpeed: 2.5, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 18, eyeZ: 0.28, scale: 0.95, spawnWeight: 10,
    loot: [{ currency: 'scrapMetal', min: 2, max: 6 }],
  },
  rock_slinger: {
    type: 'rock_slinger',
    geometry: new THREE.DodecahedronGeometry(0.48),
    color: 0xccaa66,
    baseHp: 32, baseDamage: 9, baseSpeed: 2.4, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 14, attackSpeed: 0.4, eyeZ: 0.3, scale: 0.9, spawnWeight: 12,
    loot: [{ currency: 'credits', min: 1, max: 3 }],
  },
  power_siphon: {
    type: 'power_siphon',
    geometry: new THREE.TetrahedronGeometry(0.5),
    color: 0xffd700,
    baseHp: 24, baseDamage: 5, baseSpeed: 3.8, collisionRadius: 0.44,
    behavior: 'zigzag', eyeZ: 0.25, scale: 0.88, spawnWeight: 14,
    loot: [{ currency: 'stellarDust', min: 0, max: 1 }],
  },
  overloader: {
    type: 'overloader',
    geometry: new THREE.BoxGeometry(0.9, 0.6, 1.1),
    color: 0xff6600,
    baseHp: 42, baseDamage: 10, baseSpeed: 2.6, collisionRadius: 0.55,
    behavior: 'charge', eyeZ: 0.35, scale: 1, spawnWeight: 12,
    loot: [{ currency: 'scrapMetal', min: 3, max: 8 }],
  },
  eclipser: {
    type: 'eclipser',
    geometry: new THREE.RingGeometry(0.35, 0.65, 16),
    color: 0x333344,
    baseHp: 30, baseDamage: 5, baseSpeed: 2.8, collisionRadius: 0.55,
    behavior: 'keepRange', keepRangeDist: 17, eyeZ: 0.2, scale: 1, spawnWeight: 11,
    loot: [{ currency: 'credits', min: 2, max: 5 }],
  },
  viral_agent: {
    type: 'viral_agent',
    geometry: new THREE.IcosahedronGeometry(0.42, 1),
    color: 0x39ff14,
    baseHp: 28, baseDamage: 4, baseSpeed: 3.2, collisionRadius: 0.48,
    behavior: 'keepRange', keepRangeDist: 15, attackSpeed: 0.32, eyeZ: 0.26, scale: 0.9, spawnWeight: 12,
    loot: [{ currency: 'bioEssence', min: 2, max: 5 }],
  },
  crystal_leech: {
    type: 'crystal_leech',
    geometry: new THREE.OctahedronGeometry(0.52),
    color: 0x00f5ff,
    baseHp: 33, baseDamage: 7, baseSpeed: 3.0, collisionRadius: 0.5,
    behavior: 'charge', eyeZ: 0.3, scale: 0.92, spawnWeight: 13,
    loot: [{ currency: 'plasmaCrystals', min: 0, max: 2 }],
  },
  dampener: {
    type: 'dampener',
    geometry: new THREE.CylinderGeometry(0.4, 0.5, 0.75, 10),
    color: 0x9b30ff,
    baseHp: 38, baseDamage: 6, baseSpeed: 2.2, collisionRadius: 0.52,
    behavior: 'keepRange', keepRangeDist: 18, eyeZ: 0.3, scale: 1, spawnWeight: 11,
    loot: [{ currency: 'darkMatter', min: 0, max: 1 }],
  },
  emp_reflector: {
    type: 'emp_reflector',
    geometry: new THREE.BoxGeometry(0.75, 0.55, 0.75),
    color: 0xffff66,
    baseHp: 40, baseDamage: 8, baseSpeed: 2.5, collisionRadius: 0.52,
    behavior: 'steady', eyeZ: 0.32, scale: 0.95, spawnWeight: 11,
    loot: [{ currency: 'plasmaCrystals', min: 1, max: 3 }],
  },
  warp_disruptor: {
    type: 'warp_disruptor',
    geometry: new THREE.ConeGeometry(0.38, 1.05, 6),
    color: 0xaa44ff,
    baseHp: 26, baseDamage: 5, baseSpeed: 3.5, collisionRadius: 0.46,
    behavior: 'keepRange', keepRangeDist: 20, eyeZ: 0.3, scale: 0.88, spawnWeight: 13,
    loot: [{ currency: 'darkMatter', min: 0, max: 1 }],
  },
  dense_core: {
    type: 'dense_core',
    geometry: new THREE.DodecahedronGeometry(0.65),
    color: 0x440088,
    baseHp: 55, baseDamage: 12, baseSpeed: 1.5, collisionRadius: 0.62,
    behavior: 'steady', eyeZ: 0.35, scale: 1, spawnWeight: 10,
    loot: [{ currency: 'plasmaCrystals', min: 2, max: 5 }],
  },
  target_analyzer: {
    type: 'target_analyzer',
    geometry: new THREE.ConeGeometry(0.45, 1.15, 5),
    color: 0x00ccff,
    baseHp: 30, baseDamage: 8, baseSpeed: 4.2, collisionRadius: 0.5,
    behavior: 'charge', eyeZ: 0.32, scale: 0.9, spawnWeight: 14,
    loot: [{ currency: 'credits', min: 2, max: 5 }],
  },
  speed_matcher: {
    type: 'speed_matcher',
    geometry: new THREE.TetrahedronGeometry(0.48),
    color: 0xffffff,
    baseHp: 25, baseDamage: 7, baseSpeed: 3.5, collisionRadius: 0.45,
    behavior: 'speed_match', eyeZ: 0.28, scale: 0.85, spawnWeight: 15,
    loot: [{ currency: 'credits', min: 2, max: 4 }],
  },
  ship_clone: {
    type: 'ship_clone',
    geometry: new THREE.ConeGeometry(0.5, 1.4, 5),
    color: 0xffffff,
    baseHp: 80, baseDamage: 12, baseSpeed: 3.5, collisionRadius: 0.6,
    behavior: 'charge', eyeZ: 0.35, scale: 1, spawnWeight: 20,
    loot: [
      { currency: 'credits', min: 5, max: 10 },
      { currency: 'darkMatter', min: 1, max: 2 },
    ],
  },
};

function mothershipDef(counterType, color, geometry) {
  const b = ENEMY_DEFS.boss;
  return {
    type: `${counterType}_boss`,
    geometry: geometry ?? b.geometry.clone(),
    color,
    baseHp: b.baseHp,
    baseDamage: b.baseDamage,
    baseSpeed: b.baseSpeed,
    collisionRadius: b.collisionRadius,
    behavior: 'boss',
    scale: b.scale,
    loot: [...b.loot],
    spawnWeight: 0,
    mothershipFor: counterType,
  };
}

ENEMY_DEFS.zigzagger_boss     = mothershipDef('zigzagger',      0xff6600, new THREE.ConeGeometry(5, 12, 4));
ENEMY_DEFS.mirror_drone_boss  = mothershipDef('mirror_drone',   0x88eeff, new THREE.OctahedronGeometry(7, 2));
ENEMY_DEFS.flare_ship_boss    = mothershipDef('flare_ship',     0xffaa44, new THREE.ConeGeometry(4, 14, 6));
ENEMY_DEFS.plasma_eater_boss  = mothershipDef('plasma_eater',   0xff00cc, new THREE.DodecahedronGeometry(7, 1));
ENEMY_DEFS.prism_shard_boss   = mothershipDef('prism_shard',    0xff1133, new THREE.TetrahedronGeometry(8));
ENEMY_DEFS.fortress_boss      = mothershipDef('fortress',       0x556677, new THREE.BoxGeometry(12, 10, 14));
ENEMY_DEFS.titan_boss         = mothershipDef('titan',          0x6688aa, new THREE.BoxGeometry(10, 14, 9));
ENEMY_DEFS.corroder_boss      = mothershipDef('corroder',       0x88aa44, new THREE.IcosahedronGeometry(7, 2));
ENEMY_DEFS.nullifier_boss     = mothershipDef('nullifier',      0x00ccff, new THREE.CylinderGeometry(3, 6, 14, 12));
ENEMY_DEFS.scatter_drone_boss = mothershipDef('scatter_drone',  0xffcc00, new THREE.TorusGeometry(7, 3, 8, 24));
ENEMY_DEFS.anchor_mine_boss   = mothershipDef('anchor_mine',    0x886644, new THREE.OctahedronGeometry(8, 0));
ENEMY_DEFS.repair_jammer_boss = mothershipDef('repair_jammer',  0x44ff66, new THREE.CylinderGeometry(2.5, 2.5, 14, 8));
ENEMY_DEFS.gravity_anchor_boss= mothershipDef('gravity_anchor', 0x6633ff, new THREE.SphereGeometry(7, 20, 20));
ENEMY_DEFS.ghost_ship_boss    = mothershipDef('ghost_ship',     0x888899, new THREE.ConeGeometry(5, 16, 6));
ENEMY_DEFS.wreck_animator_boss= mothershipDef('wreck_animator', 0x88ff44, new THREE.BoxGeometry(14, 7, 10));
ENEMY_DEFS.rock_slinger_boss  = mothershipDef('rock_slinger',   0xccaa66, new THREE.DodecahedronGeometry(7));
ENEMY_DEFS.power_siphon_boss  = mothershipDef('power_siphon',   0xffd700, new THREE.TetrahedronGeometry(7));
ENEMY_DEFS.overloader_boss    = mothershipDef('overloader',     0xff6600, new THREE.BoxGeometry(10, 7, 12));
ENEMY_DEFS.eclipser_boss      = mothershipDef('eclipser',       0x222233, new THREE.TorusGeometry(8, 3.5, 12, 32));
ENEMY_DEFS.viral_agent_boss   = mothershipDef('viral_agent',    0x39ff14, new THREE.IcosahedronGeometry(6, 2));
ENEMY_DEFS.crystal_leech_boss = mothershipDef('crystal_leech',  0x00f5ff, new THREE.OctahedronGeometry(7, 1));
ENEMY_DEFS.dampener_boss      = mothershipDef('dampener',       0x9b30ff, new THREE.CylinderGeometry(5, 6, 12, 16));
ENEMY_DEFS.emp_reflector_boss = mothershipDef('emp_reflector',  0xffff66, new THREE.BoxGeometry(12, 8, 12));
ENEMY_DEFS.warp_disruptor_boss= mothershipDef('warp_disruptor', 0xaa44ff, new THREE.ConeGeometry(5, 16, 8));
ENEMY_DEFS.dense_core_boss    = mothershipDef('dense_core',     0x440088, new THREE.DodecahedronGeometry(8, 1));
ENEMY_DEFS.target_analyzer_boss=mothershipDef('target_analyzer',0x00ccff, new THREE.ConeGeometry(4, 14, 7));
ENEMY_DEFS.speed_matcher_boss = mothershipDef('speed_matcher',  0xeeeeff, new THREE.TetrahedronGeometry(7, 1));
ENEMY_DEFS.ship_clone_boss    = mothershipDef('ship_clone',     0xffffff, new THREE.ConeGeometry(6, 18, 5));

export const DEBUG_ENEMY_SPAWN_TYPES = [
  'scout', 'tank', 'swarm', 'sniper', 'boss',
  'zigzagger', 'mirror_drone', 'flare_ship', 'plasma_eater', 'prism_shard', 'fortress',
  'titan', 'corroder', 'nullifier', 'scatter_drone', 'anchor_mine', 'repair_jammer',
  'gravity_anchor', 'ghost_ship', 'wreck_animator', 'rock_slinger', 'power_siphon',
  'overloader', 'eclipser', 'viral_agent', 'crystal_leech', 'dampener', 'emp_reflector',
  'warp_disruptor', 'dense_core', 'target_analyzer', 'speed_matcher', 'ship_clone',
];

export function getAvailableTypes(tier) {
  const types = ['scout'];
  if (tier >= 4) types.push('tank');
  if (tier >= 7) types.push('swarm');
  if (tier >= 10) types.push('sniper');
  return types;
}

/** Corridor spawns: Milky Way (galaxy 0) stays scout-only; later galaxies use tier table. */
export function getCorridorBaseEnemyTypes(tier, galaxyIndex) {
  if (galaxyIndex === 0) return ['scout'];
  return getAvailableTypes(tier);
}

export function weightedPick(types, rng = Math.random) {
  const defs = types
    .map(t => ENEMY_DEFS[t])
    .filter(d => d && (d.spawnWeight ?? 0) > 0);
  if (!defs.length) return ENEMY_DEFS.scout;
  const total = defs.reduce((s, d) => s + d.spawnWeight, 0);
  let r = rng() * total;
  for (let i = 0; i < defs.length; i++) {
    r -= defs[i].spawnWeight;
    if (r <= 0) return defs[i];
  }
  return defs[0];
}
