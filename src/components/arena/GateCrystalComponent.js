import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { createExplosion } from '../../prefabs/createExplosion.js';

/**
 * Visual + lifecycle for a single gate crystal. Crystals orbit their parent
 * gate on the XZ plane, take damage from player projectiles via the shared
 * ColliderComponent, and self-destruct when HP reaches 0. On destruction
 * emits GATE_CRYSTAL_DESTROYED so the gate can count them down.
 *
 * Crystals deliberately do NOT carry the 'enemy' entity tag, so auto-fire
 * weapons (which pick from world.getFrameEnemies()) skip them. The collider
 * still uses layer: 'enemy' so player projectiles hit them.
 */
export class GateCrystalComponent extends Component {
  constructor({ gateId, gatePosition, orbitAngle = 0, orbitRadius = 4, orbitSpeed = 0.6, y = 0 }) {
    super();
    this._gateId = gateId;
    this._gatePos = gatePosition.clone();
    this._orbitAngle = orbitAngle;
    this._orbitRadius = orbitRadius;
    this._orbitSpeed = orbitSpeed;
    // Collider/transform Y: kept flat with the ship so projectiles (y≈0) hit
    // reliably. Visual mesh lifts inside the group for a nicer silhouette.
    this._y = y;
    this._visualLift = 0.6;
    this._group = null;
    this._mesh = null;
    this._light = null;
    this._lightPool = null;
    this._destroyedEmitted = false;
    this._spinTime = Math.random() * Math.PI * 2;
  }

  /** Called by the gate if it moves (currently gates are static). */
  setGatePosition(pos) {
    this._gatePos.copy(pos);
  }

  onAttach(ctx) {
    this._group = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(0.55, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff55ff,
      emissive: 0xaa00cc,
      emissiveIntensity: 1.4,
      metalness: 0.4,
      roughness: 0.35,
    });
    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.position.y = this._visualLift;
    this._group.add(this._mesh);

    // Pooled point light — creating a fresh PointLight here would force
    // MeshStandardMaterial to recompile shaders on every crystal spawn/
    // destroy, which causes nasty frame hitches during the fight.
    this._lightPool = ctx.lightPool ?? null;
    this._light = this._lightPool?.acquire(0xaa00ff, 1.8, 6) ?? null;

    ctx.scene.groups.effects.add(this._group);

    this._writeTransformFromOrbit(0);
  }

  _writeTransformFromOrbit(dt) {
    this._orbitAngle += this._orbitSpeed * dt;
    this._spinTime += dt * 2.5;

    const px = this._gatePos.x + Math.cos(this._orbitAngle) * this._orbitRadius;
    const pz = this._gatePos.z + Math.sin(this._orbitAngle) * this._orbitRadius;
    const py = this._y;

    const t = this.entity.get('TransformComponent');
    if (t) t.position.set(px, py, pz);

    if (this._group) {
      this._group.position.set(px, py, pz);
      this._mesh.rotation.x = this._spinTime;
      this._mesh.rotation.y = this._spinTime * 0.7;
    }
    if (this._light) {
      this._light.position.set(px, py + this._visualLift, pz);
    }
  }

  update(dt, ctx) {
    if (!this._group) return;

    const health = this.entity.get('HealthComponent');
    if (health?.dead) {
      this._handleDeath(ctx);
      return;
    }

    this._writeTransformFromOrbit(dt);

    // Flash intensity while damaged
    if (health && this._mesh) {
      const pct = Math.max(0, Math.min(1, health.hp / health.maxHp));
      this._mesh.material.emissiveIntensity = 1.0 + pct * 1.0;
    }
  }

  _handleDeath(ctx) {
    if (this._destroyedEmitted) return;
    this._destroyedEmitted = true;

    const t = this.entity.get('TransformComponent');
    if (t && ctx?.world) {
      ctx.world.spawn(createExplosion(t.position, { color: 0xff66ff, scale: 0.8 }));
    }
    if (ctx?.audio) ctx.audio.play('explosion');

    eventBus.emit(EVENTS.GATE_CRYSTAL_DESTROYED, { gateId: this._gateId });
    this.entity.destroy();
  }

  onDetach() {
    if (this._lightPool && this._light) {
      this._lightPool.release(this._light);
    }
    this._light = null;
    this._lightPool = null;

    if (this._group) {
      this._group.parent?.remove(this._group);
      this._group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this._group = null;
      this._mesh = null;
    }
  }
}
