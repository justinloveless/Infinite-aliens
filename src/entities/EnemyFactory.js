import * as THREE from 'three';
import { Enemy } from './Enemy.js';

// Enemy type definitions
const ENEMY_DEFS = {
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
      // Occasional early drops so tech nodes aren’t hard-locked before swarm/sniper rounds
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
    attackSpeed: 0.5,   // shots/sec
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
    spawnWeight: 0, // never random
  },
};

// Which enemy types are available per round
function getAvailableTypes(round) {
  const types = ['scout'];
  if (round >= 4) types.push('tank');
  if (round >= 7) types.push('swarm');
  if (round >= 10) types.push('sniper');
  return types;
}

function weightedPick(types, rng) {
  const defs = types.map(t => ENEMY_DEFS[t]);
  const total = defs.reduce((s, d) => s + d.spawnWeight, 0);
  let r = rng() * total;
  for (let i = 0; i < defs.length; i++) {
    r -= defs[i].spawnWeight;
    if (r <= 0) return defs[i];
  }
  return defs[0];
}

export class EnemyFactory {
  create(typeName, round, scene, computed = null) {
    const def = ENEMY_DEFS[typeName];
    if (!def) throw new Error(`Unknown enemy type: ${typeName}`);
    return new Enemy(def, round, scene, computed);
  }

  spawnRandom(round, scene, computed = null) {
    const types = getAvailableTypes(round);
    const def = weightedPick(types, Math.random);
    return this._spawnFromDef(def, round, scene, computed);
  }

  /**
   * Like spawnRandom but only picks enemy types whose pack size (spawnCount) fits the cap.
   * Used on boss rounds so the final spawn slot can always be the boss (swarm would skip it).
   */
  spawnRandomCapped(round, scene, maxPackSize, computed = null) {
    const cap = Math.max(1, maxPackSize);
    const types = getAvailableTypes(round).filter(
      (t) => (ENEMY_DEFS[t].spawnCount || 1) <= cap
    );
    if (types.length === 0) {
      return this._spawnFromDef(ENEMY_DEFS.scout, round, scene, computed);
    }
    const def = weightedPick(types, Math.random);
    return this._spawnFromDef(def, round, scene, computed);
  }

  _spawnFromDef(def, round, scene, computed = null) {
    const enemies = [];
    const count = def.spawnCount || 1;
    for (let i = 0; i < count; i++) {
      const enemy = new Enemy(def, round, scene, computed);
      if (count > 1) {
        enemy.group.position.x += (i - 1) * 2.5;
      }
      enemies.push(enemy);
    }
    return enemies;
  }

  spawnBoss(round, scene, computed = null) {
    return [new Enemy(ENEMY_DEFS.boss, round, scene, computed)];
  }
}
