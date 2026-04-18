import * as THREE from 'three';
import { LOOT, PLAYER } from '../constants.js';

const COLORS = {
  scrapMetal:     0xaaaaaa,
  plasmaCrystals: 0x00f5ff,
  bioEssence:     0x39ff14,
  darkMatter:     0x9b30ff,
  stellarDust:    0xffd700,
};

// Size by denomination: 1 → 0.08, 10 → 0.12, 100 → 0.18, 1000 → 0.26
function sizeForAmount(amount) {
  if (amount >= 1000) return 0.26;
  if (amount >= 100)  return 0.18;
  if (amount >= 10)   return 0.12;
  return 0.08;
}

export class LootDrop {
  constructor(pos, currencyType, amount, scene) {
    this.currencyType = currencyType;
    this.amount = amount;
    this.active = true;
    this.collisionRadius = 0.5;
    this._time = Math.random() * Math.PI * 2;
    this._baseY = pos.y + 0.5;

    const geo = new THREE.OctahedronGeometry(sizeForAmount(amount), 0);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS[currencyType] || 0xffffff,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos);
    this.mesh.position.y = this._baseY;

    // Glow light
    const color = COLORS[currencyType] || 0xffffff;
    this._light = new THREE.PointLight(color, 0.8, 2.5);
    this._light.position.copy(this.mesh.position);
    scene.groups.loot.add(this.mesh);
    scene.groups.loot.add(this._light);
    this._scene = scene;
  }

  update(delta, playerPos, attraction) {
    if (!this.active) return;
    this._time += delta * 2.5;

    // Home toward player so loot can't be stranded far from the ship.
    if (playerPos) {
      const dx = playerPos.x - this.mesh.position.x;
      const dz = playerPos.z - this.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.01) {
        let attractionSpeed;
        if (typeof attraction === 'number') {
          attractionSpeed = attraction;
        } else if (attraction && typeof attraction.magnetRange === 'number') {
          const mr = attraction.magnetRange;
          const inMagnet = dist < mr;
          let mult = 1;
          if (inMagnet) {
            const extra = Math.max(0, mr - PLAYER.BASE_MAGNET_RANGE);
            mult = LOOT.MAGNET_MULT_BASE + extra * LOOT.MAGNET_MULT_PER_RANGE;
          }
          attractionSpeed = LOOT.DRIFT_SPEED * mult;
        } else {
          attractionSpeed = LOOT.DRIFT_SPEED;
        }
        const speed = attractionSpeed * (1 + Math.max(0, 1 - dist / 8));
        const step = Math.min(dist, speed * delta);
        this.mesh.position.x += (dx / dist) * step;
        this.mesh.position.z += (dz / dist) * step;
        this._baseY = playerPos.y + 0.5;
      }
    }

    this._light.position.copy(this.mesh.position);

    // Pulse light
    this._light.intensity = 0.6 + Math.sin(this._time * 3) * 0.2;
  }

  collect() {
    this.active = false;
    this._scene.groups.loot.remove(this.mesh);
    this._scene.groups.loot.remove(this._light);
  }

  get position() { return this.mesh.position; }
}
