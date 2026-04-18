import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { resolveTarget } from './CombatTargeting.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Base class for secondary turret weapons (laser / missile / plasma).
 * Subclasses supply `projectileType`, optional `isHoming`, and `rateMultiplier`
 * (multiplier on the player's base fire interval — higher = slower).
 */
export class TurretWeaponComponent extends Component {
  constructor({ projectileType, rateMultiplier = 2.0, isHoming = false, sound = null }) {
    super();
    this.projectileType = projectileType;
    this.rateMultiplier = rateMultiplier;
    this.isHoming = isHoming;
    this.sound = sound || (projectileType === 'missile' ? 'missile'
      : projectileType === 'plasma' ? 'plasma' : 'laser');
    this._timer = 0;
  }

  onAttach(ctx) {
    const visuals = this.entity.get('ShipVisualsComponent');
    if (visuals) visuals.syncTurrets([...Object.keys(visuals._turretMeshes), this.projectileType]);
  }

  onDetach() {
    const visuals = this.entity.get('ShipVisualsComponent');
    if (!visuals) return;
    const remaining = Object.keys(visuals._turretMeshes).filter(k => k !== this.projectileType);
    visuals.syncTurrets(remaining);
  }

  update(dt, ctx) {
    if (ctx?.state?.round?.phase !== 'combat') { this._timer = 0; return; }
    const stats = this.entity.get('PlayerStatsComponent');
    const t = this.entity.get('TransformComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    if (!stats || !t || !visuals) return;

    this._timer += dt;
    const interval = stats.calcFireInterval() * this.rateMultiplier;
    if (this._timer < interval) return;

    const target = resolveTarget(ctx.world, t.position, stats, ctx.state.round);
    if (!target) return;
    this._timer = 0;

    const spawnPos = visuals.getTurretWorldPosition(this.projectileType);
    const tgtT = target.get('TransformComponent');
    const dir = new THREE.Vector3().subVectors(tgtT.position, spawnPos).normalize();

    const killsThisRun = ctx.state.round.killsThisRun || 0;
    const resonance = this.entity.get('ResonanceFieldComponent')?.level ?? 0;
    const { damage, isCrit } = stats.calcDamage({ killsThisRun, resonanceFieldLevel: resonance });
    const visualOverride = stats.projectileVisuals.get(this.projectileType)
      || stats.projectileVisuals.get('all') || null;

    ctx.world.spawn(createProjectile({
      position: spawnPos,
      direction: dir,
      type: this.projectileType,
      damage, isCrit,
      isPlayer: true,
      target: this.isHoming ? target : null,
      visualOverride,
    }));

    if (ctx.audio) ctx.audio.play(this.sound);
    eventBus.emit(EVENTS.PROJECTILE_FIRED);
  }
}

export class LaserTurretComponent extends TurretWeaponComponent {
  constructor() { super({ projectileType: 'laser', rateMultiplier: 1.5 }); }
}

export class MissileTurretComponent extends TurretWeaponComponent {
  constructor() { super({ projectileType: 'missile', rateMultiplier: 2.5, isHoming: true }); }
}

export class PlasmaTurretComponent extends TurretWeaponComponent {
  constructor() { super({ projectileType: 'plasma', rateMultiplier: 3.0 }); }
}
