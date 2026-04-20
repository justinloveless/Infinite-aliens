import { Component } from '../../ecs/Component.js';
import { isCombatPhase } from '../../core/phaseUtil.js';

/** Deals continuous damage-per-second to every enemy within `radius`. */
export class CorrosiveAuraComponent extends Component {
  constructor({ dps = 10, radius = 6 } = {}) {
    super();
    this.dps = dps;
    this.radius = radius;
  }

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) return;
    if (this.dps <= 0) return;
    const t = this.entity.get('TransformComponent'); if (!t) return;
    const dmg = Math.max(1, Math.ceil(this.dps * dt));
    const enemies = ctx.world.getFrameEnemies();
    const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const et = e.get('TransformComponent'); if (!et) continue;
      if (et.position.distanceToSquared(t.position) <= r2) {
        e.get('HealthComponent')?.takeDamage(dmg);
      }
    }
  }
}
