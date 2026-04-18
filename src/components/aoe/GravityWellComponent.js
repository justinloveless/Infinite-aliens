import { Component } from '../../ecs/Component.js';

/** Slows enemies within `radius` by refreshing a short-duration slow status. */
export class GravityWellComponent extends Component {
  constructor({ radius = 6, slowMult = 0.45 } = {}) {
    super();
    this.radius = radius;
    this.slowMult = slowMult;
  }

  update(dt, ctx) {
    if (ctx?.state?.round?.phase !== 'combat') return;
    const t = this.entity.get('TransformComponent'); if (!t) return;
    const r2 = this.radius * this.radius;
    const enemies = ctx.world.query('enemy');
    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.get('TransformComponent'); if (!et) continue;
      if (et.position.distanceToSquared(t.position) <= r2) {
        e.get('StatusEffectsComponent')?.apply('slow', { mult: this.slowMult, duration: 0.25 });
      }
    }
  }
}
