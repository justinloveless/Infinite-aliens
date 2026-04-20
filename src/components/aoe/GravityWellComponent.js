import { Component } from '../../ecs/Component.js';
import { isCombatPhase } from '../../core/phaseUtil.js';

/** Slows enemies within `radius` by refreshing a short-duration slow status. */
export class GravityWellComponent extends Component {
  constructor({ radius = 6, slowMult = 0.45 } = {}) {
    super();
    this.radius = radius;
    this.slowMult = slowMult;
  }

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) return;
    const t = this.entity.get('TransformComponent'); if (!t) return;
    const r2 = this.radius * this.radius;
    const enemies = ctx.world.getFrameEnemies();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const et = e.get('TransformComponent'); if (!et) continue;
      if (et.position.distanceToSquared(t.position) <= r2) {
        e.get('StatusEffectsComponent')?.apply('slow', { mult: this.slowMult, duration: 0.25 });
      }
    }
  }
}
