import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { ENERGY } from '../../constants.js';
import { resolveTarget } from './CombatTargeting.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Base class for secondary turret weapons (laser / missile / plasma).
 * Subclasses supply `projectileType`, optional `isHoming`, and `rateMultiplier`
 * (multiplier on the player's base fire interval — higher = slower).
 */
export class TurretWeaponComponent extends Component {
  constructor({ projectileType, rateMultiplier = 2.0, isHoming = false, sound = null, energyCostPerShot = ENERGY.COST_TURRET_LASER }) {
    super();
    this.projectileType = projectileType;
    this.rateMultiplier = rateMultiplier;
    this.isHoming = isHoming;
    this.sound = sound || (projectileType === 'missile' ? 'missile'
      : projectileType === 'plasma' ? 'plasma' : 'laser');
    this.energyCostPerShot = energyCostPerShot;
    this._timer = 0;
  }

  // Turret meshes are owned by ShipVisualsComponent and synced from the
  // hangar slot map by UpgradeApplier. The weapon component only fires.
  onAttach() {}
  onDetach() {}

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) { this._timer = 0; return; }
    const stats = this.entity.get('PlayerStatsComponent');
    const t = this.entity.get('TransformComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    if (!stats || !t || !visuals) return;

    const slotIds = visuals.getTurretSlotsFor(this.projectileType);
    if (!slotIds.length) { this._timer = 0; return; }

    this._timer += dt;
    const interval = stats.calcFireInterval() * this.rateMultiplier;
    if (this._timer < interval) return;

    const target = resolveTarget(ctx.world, t.position, stats, ctx.state.round);
    if (!target) return;

    const energy = this.entity.get('EnergyComponent');
    if (energy && !energy.systemsOnline) { this._timer = 0; return; }
    this._timer = 0;
    energy?.spend(this.energyCostPerShot);

    const tgtT = target.get('TransformComponent');
    const killsThisRun = ctx.state.round.killsThisRun || 0;
    const resonance = this.entity.get('ResonanceFieldComponent')?.level ?? 0;
    const visualOverride = stats.projectileVisuals.get(this.projectileType)
      || stats.projectileVisuals.get('all') || null;

    // Fire one projectile from every slot hosting this weapon type. Installing
    // two of the same turret therefore doubles effective DPS (and looks it).
    for (const slotId of slotIds) {
      const spawnPos = visuals.getTurretMuzzleForFire(this.projectileType, slotId);
      const dir = new THREE.Vector3().subVectors(tgtT.position, spawnPos).normalize();
      const { damage, isCrit } = stats.calcDamage({ killsThisRun, resonanceFieldLevel: resonance });

      ctx.world.spawn(createProjectile({
        position: spawnPos,
        direction: dir,
        type: this.projectileType,
        damage, isCrit,
        isPlayer: true,
        target: this.isHoming ? target : null,
        visualOverride,
      }));
    }

    if (ctx.audio) ctx.audio.play(this.sound);
    eventBus.emit(EVENTS.PROJECTILE_FIRED);
  }
}

export class LaserTurretComponent extends TurretWeaponComponent {
  constructor() { super({ projectileType: 'laser', rateMultiplier: 1.5, energyCostPerShot: ENERGY.COST_TURRET_LASER }); }
}

export class MissileTurretComponent extends TurretWeaponComponent {
  constructor() { super({ projectileType: 'missile', rateMultiplier: 2.5, isHoming: true, energyCostPerShot: ENERGY.COST_TURRET_MISSILE }); }
}

export class PlasmaTurretComponent extends TurretWeaponComponent {
  constructor() { super({ projectileType: 'plasma', rateMultiplier: 3.0, energyCostPerShot: ENERGY.COST_TURRET_PLASMA }); }
}
