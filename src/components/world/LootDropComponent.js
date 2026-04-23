import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { LOOT, PLAYER } from '../../constants.js';

const COLORS = {
  credits: 0xffb347,
  scrapMetal: 0xaaaaaa,
  plasmaCrystals: 0x00f5ff,
  bioEssence: 0x39ff14,
  darkMatter: 0x9b30ff,
  stellarDust: 0xffd700,
};

// All loot crystals share one unit geometry; per-drop size is applied via
// mesh.scale.setScalar(size) so we never allocate a fresh OctahedronGeometry.
const LOOT_GEO = new THREE.OctahedronGeometry(1, 0);

// Materials are cached per currency so every drop of the same currency shares
// a single Material instance -> fewer shader swaps, fewer uploads.
const LOOT_MAT_CACHE = new Map();
function getLootMaterial(currencyType) {
  let mat = LOOT_MAT_CACHE.get(currencyType);
  if (!mat) {
    const color = COLORS[currencyType] || 0xffffff;
    mat = new THREE.MeshBasicMaterial({ color });
    LOOT_MAT_CACHE.set(currencyType, mat);
  }
  return mat;
}

function sizeForAmount(amount) {
  if (amount >= 1000) return 0.26;
  if (amount >= 100)  return 0.18;
  if (amount >= 10)   return 0.12;
  return 0.08;
}

/**
 * Visualizes a currency drop as a floating crystal. Follows the player by
 * magnet attraction and emits LOOT_COLLECTED on pickup.
 */
export class LootDropComponent extends Component {
  constructor({ currencyType, amount }) {
    super();
    this.currencyType = currencyType;
    this.amount = amount;
    this._time = Math.random() * Math.PI * 2;
    this._scene = null;

    this._color = COLORS[currencyType] || 0xffffff;
    const mat = getLootMaterial(currencyType);
    this.mesh = new THREE.Mesh(LOOT_GEO, mat);
    this.mesh.scale.setScalar(sizeForAmount(amount));

    const angle = Math.random() * Math.PI * 2;
    this._vx = Math.cos(angle) * LOOT.SPAWN_SPEED;
    this._vz = Math.sin(angle) * LOOT.SPAWN_SPEED;

    // Light is acquired from the pool on attach so the scene's light count
    // stays constant (see LightPool.js -- avoids shader recompile stalls).
    this._light = null;
    this._lightPool = null;
  }

  onAttach(ctx) {
    this._scene = ctx.scene;
    const t = this.entity.get('TransformComponent');
    this.mesh.position.copy(t.position);
    ctx.scene.groups.loot.add(this.mesh);

    this._lightPool = ctx.lightPool ?? null;
    if (this._lightPool) {
      this._light = this._lightPool.acquire(this._color, 0.8, 2.5);
      if (this._light) this._light.position.copy(t.position);
    }

    this.entity.get('ColliderComponent').onHit = (other) => {
      if (!other.hasTag('player')) return;
      this._collect(ctx);
    };
  }

  onDetach() {
    if (this._scene) {
      this._scene.groups.loot.remove(this.mesh);
    }
    if (this._lightPool) this._lightPool.release(this._light);
    this._light = null;
    this._lightPool = null;
    // geometry and material are cached/shared - do not dispose here.
  }

  _collect(ctx) {
    eventBus.emit(EVENTS.LOOT_COLLECTED, { currencyType: this.currencyType, amount: this.amount });
    if (ctx.audio) ctx.audio.play(this.currencyType === 'darkMatter' ? 'rarePickup' : 'pickup');
    this.entity.destroy();
  }

  update(dt, ctx) {
    this._time += dt * 2.5;
    const t = this.entity.get('TransformComponent'); if (!t) return;

    if (this._vx !== 0 || this._vz !== 0) {
      t.position.x += this._vx * dt;
      t.position.z += this._vz * dt;
      const decay = Math.exp(-LOOT.SPAWN_FRICTION * dt);
      this._vx *= decay;
      this._vz *= decay;
      if (Math.abs(this._vx) < 0.01 && Math.abs(this._vz) < 0.01) {
        this._vx = 0;
        this._vz = 0;
      }
    }

    const playerEnt = ctx?.playerEntity;
    const playerT = playerEnt?.get('TransformComponent');
    if (playerT) {
      const dx = playerT.position.x - t.position.x;
      const dz = playerT.position.z - t.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.01) {
        const stats = playerEnt.get('PlayerStatsComponent');
        const mr = stats?.magnetRange ?? PLAYER.BASE_MAGNET_RANGE;
        const inMagnet = dist < mr;
        let mult = 1;
        if (inMagnet) {
          const extra = Math.max(0, mr - PLAYER.BASE_MAGNET_RANGE);
          mult = LOOT.MAGNET_MULT_BASE + extra * LOOT.MAGNET_MULT_PER_RANGE;
        }
        const speed = LOOT.DRIFT_SPEED * mult * (1 + Math.max(0, 1 - dist / 8));
        const step = Math.min(dist, speed * dt);
        t.position.x += (dx / dist) * step;
        t.position.z += (dz / dist) * step;
        t.position.y = playerT.position.y + 0.5;
      }
    }
    this.mesh.position.copy(t.position);
    if (this._light) {
      this._light.position.copy(t.position);
      this._light.intensity = 0.6 + Math.sin(this._time * 3) * 0.2;
    }
  }
}
