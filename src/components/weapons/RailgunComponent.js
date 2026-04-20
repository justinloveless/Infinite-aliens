import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Replacement for the manual gun: charges, consumes energy, then fires a
 * high-damage piercing shot straight ahead.
 */
export class RailgunComponent extends Component {
  constructor({ chargeTime = 2.5, damageMultiplier = 0, energyCost = 40 } = {}) {
    super();
    this.chargeTime = chargeTime;
    this.damageMultiplier = damageMultiplier;
    this.energyCost = energyCost;
    this._charging = false;
    this._charge = 0;
    this._ctx = null;
  }

  onAttach(ctx) { this._ctx = ctx; }
  onDetach() { this._ctx = null; }

  beginCharge() {
    const ctx = this._ctx;
    if (!ctx || !isCombatPhase(ctx.state?.round?.phase)) return;
    const energy = this.entity.get('EnergyComponent');
    if (!energy || energy.current < this.energyCost) return;
    this._charging = true;
    this._charge = 0;
  }

  releaseCharge() {
    if (!this._charging) return;
    this._charging = false;
    if (this._charge < this.chargeTime) { this._charge = 0; return; }
    this._fire();
    this._charge = 0;
  }

  _fire() {
    const ctx = this._ctx;
    const energy = this.entity.get('EnergyComponent');
    if (!energy?.spend(this.energyCost)) return;

    const t = this.entity.get('TransformComponent');
    const stats = this.entity.get('PlayerStatsComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    const yaw = t?.rotation?.y ?? 0;
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const pos = visuals
      ? visuals.getPrimaryWeaponMuzzleWorldPosition()
      : t.position.clone().add(new THREE.Vector3(0, 0, -1.2));
    const dmg = Math.ceil((stats?.damage ?? 1) * (this.damageMultiplier || 1));

    ctx.world.spawn(createProjectile({
      position: pos, direction: dir, type: 'manual',
      damage: dmg, isCrit: true, isPlayer: true, pierces: 999,
    }));
    if (ctx.audio) ctx.audio.play('plasma');
    eventBus.emit(EVENTS.MANUAL_FIRED);
  }

  update(dt) {
    if (this._charging) this._charge = Math.min(this.chargeTime, this._charge + dt);
  }

  getChargeRatio() { return this._charge / this.chargeTime; }
}
