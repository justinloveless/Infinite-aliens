import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { MANUAL_GUN, PLAYER } from '../../constants.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Player-controlled cannon firing straight ahead. Owns its own heat/overheat
 * state and exposes `fire()` for input bindings and `getHeatState()` for UI.
 */
export class ManualGunComponent extends Component {
  constructor({ heatPerShotMult = 1, overheatDurationMult = 1 } = {}) {
    super();
    this.heatPerShotMult = heatPerShotMult;
    this.overheatDurationMult = overheatDurationMult;
    this._heat = 0;
    this._overheated = false;
    this._overheatTimer = 0;
    this._fireCooldown = 0;
    this._firing = false;
    this._ctx = null;
  }

  onAttach(ctx) { this._ctx = ctx; }
  onDetach() { this._ctx = null; }

  getHeatState() {
    return { heat: this._heat, max: MANUAL_GUN.HEAT_MAX, overheated: this._overheated };
  }

  fire() {
    const ctx = this._ctx;
    if (!ctx || ctx.state?.round?.phase !== 'combat') return;
    if (this._overheated || this._fireCooldown > 0) return;

    this._fireCooldown = MANUAL_GUN.FIRE_COOLDOWN;
    this._heat += MANUAL_GUN.HEAT_PER_SHOT * this.heatPerShotMult;
    const ratio = this._heat / MANUAL_GUN.HEAT_MAX;

    if (ctx.audio) ctx.audio.playAtRate('manualShot', 0.85 + ratio * 0.6);

    if (this._heat >= MANUAL_GUN.HEAT_MAX) {
      this._heat = MANUAL_GUN.HEAT_MAX;
      this._overheated = true;
      this._overheatTimer = MANUAL_GUN.OVERHEAT_DURATION * this.overheatDurationMult;
      if (ctx.audio) ctx.audio.play('manualOverheat');
    }

    const t = this.entity.get('TransformComponent');
    const stats = this.entity.get('PlayerStatsComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    const pos = visuals
      ? visuals.getPrimaryWeaponMuzzleWorldPosition()
      : t.position.clone().add(new THREE.Vector3(0, 0, -1.0));
    const dir = new THREE.Vector3(0, 0, -1);
    const damage = stats?.damage ?? PLAYER.BASE_DAMAGE;
    const pierces = stats?.projectilePierces ?? 0;

    ctx.world.spawn(createProjectile({
      position: pos, direction: dir,
      type: 'manual', damage, isCrit: false, isPlayer: true,
      pierces, heatRatio: ratio,
    }));
    eventBus.emit(EVENTS.MANUAL_FIRED);
    this._firing = true;
  }

  stopFiring() {
    this._firing = false;
  }

  update(dt) {
    if (this._firing) {
      this.fire();
    }

    this._heat = Math.max(0, this._heat - MANUAL_GUN.HEAT_COOL_RATE * dt);
    this._fireCooldown = Math.max(0, this._fireCooldown - dt);
    if (this._overheated) {
      this._overheatTimer -= dt;
      if (this._overheatTimer <= 0) {
        this._overheated = false;
        this._heat = 0;
      }
    }
  }
}
