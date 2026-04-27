import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { MANUAL_GUN, ENERGY } from '../../constants.js';
import { getWeaponCombatMods } from '../../data/weaponCombatMods.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
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
    if (!ctx || !isCombatPhase(ctx.state?.round?.phase)) return;
    if (this._overheated || this._fireCooldown > 0) return;
    const stats = this.entity.get('PlayerStatsComponent');
    if (!stats || (stats.weaponsDisabledTimer ?? 0) > 0) return;

    const energy = this.entity.get('EnergyComponent');
    if (energy && !energy.systemsOnline) return;
    energy?.spend(ENERGY.COST_MANUAL_GUN);

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
    const visuals = this.entity.get('ShipVisualsComponent');
    // Spawn one projectile per installed main cannon. Extra cannons fire
    // parallel to the primary along the ship's yaw (not converging).
    const positions = visuals
      ? visuals.getManualMuzzleWorldPositions()
      : [t.position.clone().add(new THREE.Vector3(0, 0, -1.0))];
    // Fire along the ship's current yaw so the manual gun points where the
    // ship's nose is (essential for arena flight controls).
    const q = new THREE.Quaternion().setFromEuler(t.rotation);
    const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const pierces = stats?.projectilePierces ?? 0;
    const killsThisRun = ctx.state.round.killsThisRun || 0;
    const resonance = this.entity.get('ResonanceFieldComponent')?.level ?? 0;
    const w = getWeaponCombatMods('manual');
    const { damage, isCrit } = stats.calcDamage({
      killsThisRun, resonanceFieldLevel: resonance, ...w,
    });

    for (const pos of positions) {
      ctx.world.spawn(createProjectile({
        position: pos, direction: baseDir.clone(),
        type: 'manual', damage, isCrit, isPlayer: true,
        pierces, heatRatio: ratio,
      }));
    }
    eventBus.emit(EVENTS.MANUAL_FIRED);
    this._firing = true;
  }

  stopFiring() {
    this._firing = false;
  }

  onPrimaryFirePress() { this.fire(); }
  onPrimaryFireRelease() { this.stopFiring(); }

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
