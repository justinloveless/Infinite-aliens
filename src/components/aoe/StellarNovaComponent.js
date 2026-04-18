import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Periodic AoE pulse centered on the owner. When the timer elapses, damages
 * every enemy within `radius` and emits STELLAR_NOVA so the visuals component
 * can play its burst animation.
 */
export class StellarNovaComponent extends Component {
  constructor({ interval = 5, radius = 6, damage = 30, level = 1 } = {}) {
    super();
    this.interval = interval;
    this.radius = radius;
    this.damage = damage;
    this.level = level;
    this._timer = 0;
  }

  onAttach() {
    this.listen(EVENTS.ROUND_STARTED, () => { this._timer = 0; });
  }

  trigger(ctx) {
    const t = this.entity.get('TransformComponent'); if (!t) return;
    this._pulse(ctx, t.position);
  }

  _pulse(ctx, pos) {
    const enemies = ctx.world.query('enemy');
    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.get('TransformComponent'); if (!et) continue;
      if (et.position.distanceTo(pos) <= this.radius) {
        e.get('HealthComponent')?.takeDamage(this.damage);
      }
    }
    eventBus.emit(EVENTS.STELLAR_NOVA, { radius: this.radius });
  }

  update(dt, ctx) {
    if (ctx?.state?.round?.phase !== 'combat') return;
    if (this.interval <= 0) return;
    this._timer += dt;
    if (this._timer >= this.interval) {
      this._timer = 0;
      this.trigger(ctx);
    }
  }
}
