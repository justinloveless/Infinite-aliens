import { Component } from '../../ecs/Component.js';

/**
 * Periodically pushes enemies within `radius` away from the owner and
 * optionally deals `damage`. Timer resets on round start.
 */
export class RepulserComponent extends Component {
  constructor({ interval = 3, radius = 6, damage = 0 } = {}) {
    super();
    this.interval = interval;
    this.radius = radius;
    this.damage = damage;
    this._timer = 0;
  }

  update(dt, ctx) {
    if (ctx?.state?.round?.phase !== 'combat') return;
    this._timer += dt;
    if (this._timer < this.interval) return;
    this._timer = 0;

    const t = this.entity.get('TransformComponent'); if (!t) return;
    const enemies = ctx.world.getFrameEnemies();
    const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const et = e.get('TransformComponent'); if (!et) continue;
      const d2 = et.position.distanceToSquared(t.position);
      if (d2 > r2) continue;
      const dir = et.position.clone().sub(t.position);
      if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
      dir.normalize();
      et.position.addScaledVector(dir, this.radius * 0.5);
      if (this.damage > 0) e.get('HealthComponent')?.takeDamage(this.damage);
    }
  }
}
