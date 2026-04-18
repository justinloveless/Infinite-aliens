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
    loot: [{ currency: 'scrapMetal', min: 5, max: 12 }],
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
    loot: [{ currency: 'bioEssence', min: 1, max: 3 }],
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
      { currency: 'plasmaCrystals', min: 2, max: 5 },
      { currency: 'scrapMetal', min: 1, max: 3 },
    ],
    spawnWeight: 15,
  },
  boss: {
    type: 'boss',
    geometry: new THREE.IcosahedronGeometry(1.4, 1),
    color: 0xaa00ff,
    baseHp: 300,
    baseDamage: 20,
    baseSpeed: 1.2,
    collisionRadius: 1.8,
    behavior: 'boss',
    scale: 1,
    loot: [
      { currency: 'darkMatter', min: 1, max: 3 },
      { currency: 'scrapMetal', min: 15, max: 30 },
      { currency: 'plasmaCrystals', min: 8, max: 15 },
      { currency: 'bioEssence', min: 5, max: 10 },
    ],
    spawnWeight: 0,
  },
};

export const DEBUG_ENEMY_SPAWN_TYPES = ['scout', 'tank', 'swarm', 'sniper', 'boss'];

export function getAvailableTypes(tier) {
  const types = ['scout'];
  if (tier >= 4) types.push('tank');
  if (tier >= 7) types.push('swarm');
  if (tier >= 10) types.push('sniper');
  return types;
}

export function weightedPick(types, rng = Math.random) {
  const defs = types.map(t => ENEMY_DEFS[t]);
  const total = defs.reduce((s, d) => s + d.spawnWeight, 0);
  let r = rng() * total;
  for (let i = 0; i < defs.length; i++) {
    r -= defs[i].spawnWeight;
    if (r <= 0) return defs[i];
  }
  return defs[0];
}
