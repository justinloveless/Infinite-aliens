import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { ENERGY } from '../../constants.js';
import { resolveTarget } from './CombatTargeting.js';
import { createProjectile } from '../../prefabs/createProjectile.js';
import { getWeaponCombatMods } from '../../data/weaponCombatMods.js';

/**
 * Primary nose auto-fire. Picks nearest enemy, fires `projectileCount` shots
 * of the player's configured projectileType. Owns its own cadence.
 */
export class AutoFireWeaponComponent extends Component {
  constructor() {
    super();
    this._timer = 0;
  }

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) { this._timer = 0; return; }
    const stats = this.entity.get('PlayerStatsComponent');
    const t = this.entity.get('TransformComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    if (!stats || !t) return;
    if ((stats.weaponsDisabledTimer ?? 0) > 0) { this._timer = 0; return; }

    this._timer += dt;
    const interval = stats.calcFireInterval();
    if (this._timer < interval) return;

    const target = resolveTarget(ctx.world, t.position, stats, ctx.state.round);
    if (!target) return;

    const energy = this.entity.get('EnergyComponent');
    if (energy && !energy.systemsOnline) { this._timer = 0; return; }
    this._timer = 0;
    energy?.spend(ENERGY.COST_AUTO_FIRE);

    const { projectileVisuals } = stats;
    const type = stats.projectileType;
    const visualOverride = projectileVisuals.get(type) || projectileVisuals.get('all') || null;
    const pierces = stats.projectilePierces || 0;
    const count = stats.projectileCount;

    const tgtT = target.get('TransformComponent');
    const spawnBase = visuals
      ? visuals.getPrimaryWeaponMuzzleWorldPosition()
      : t.position.clone().add(new THREE.Vector3(0, 0, -0.5));
    const baseDir = new THREE.Vector3().subVectors(tgtT.position, spawnBase).normalize();

    const killsThisRun = ctx.state.round.killsThisRun || 0;
    const resonance = ctx.playerEntity?.get('ResonanceFieldComponent')?.level ?? 0;
    const vampire = stats.vampireHealRatio ?? 0;
    const w = getWeaponCombatMods('auto');

    for (let i = 0; i < count; i++) {
      const { damage, isCrit } = stats.calcDamage({
        killsThisRun, resonanceFieldLevel: resonance, ...w,
      });
      const dir = baseDir.clone();
      if (count > 1) {
        const spread = (i / (count - 1) - 0.5) * 0.4;
        dir.x += spread;
        dir.normalize();
      }
      ctx.world.spawn(createProjectile({
        position: spawnBase.clone(),
        direction: dir,
        type,
        damage,
        isCrit,
        isPlayer: true,
        target: stats.isHoming ? target : null,
        visualOverride,
        pierces,
        onKillHealAmount: vampire > 0 ? vampire : null,
      }));
    }

    if (ctx.audio) {
      const w = type;
      ctx.audio.play(w === 'missile' ? 'missile' : w === 'plasma' ? 'plasma' : 'laser');
    }
    eventBus.emit(EVENTS.PROJECTILE_FIRED);
  }
}
