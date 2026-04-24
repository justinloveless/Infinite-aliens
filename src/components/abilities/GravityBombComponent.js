import { AbilityComponent } from './AbilityComponent.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Over its `duration`, pulls every enemy within `radius` toward the cast
 * origin and, if `damage` > 0, deals it on final resolve.
 */
export class GravityBombComponent extends AbilityComponent {
  constructor({ cooldown = 25, radius = 10, damage = 30, duration = 1.5, pullStrength = 8, energyCost = 25 } = {}) {
    super({ id: 'gravity_bomb', icon: '◉', cooldown, energyCost });
    this.radius = radius;
    this.damage = damage;
    this.duration = duration;
    this.pullStrength = pullStrength;
    this._active = 0;
    this._origin = null;
    this._ctx = null;
    this._exploded = false;
  }

  onAttach(ctx) { this._ctx = ctx; }

  activate(ctx) {
    const t = this.entity.get('TransformComponent'); if (!t) return;
    this._origin = t.position.clone();
    this._active = this.duration;
    this._exploded = false;
  }

  update(dt) {
    super.update(dt);
    const ctx = this._ctx;
    if (!ctx) return;

    const wasPulling = this._active > 0;
    if (wasPulling) {
      this._active -= dt;
      const enemies = ctx.world.query('enemy');
      for (const e of enemies) {
        if (!e.active || e.hasTag('gravity_immune')) continue;
        const et = e.get('TransformComponent'); if (!et) continue;
        const dir = this._origin.clone().sub(et.position);
        const dist = dir.length();
        if (dist > this.radius || dist < 0.001) continue;
        dir.normalize();
        et.position.addScaledVector(dir, this.pullStrength * dt);
      }
    }

    if (wasPulling && this._active <= 0 && !this._exploded && this._origin) {
      this._exploded = true;
      const enemies = ctx.world.query('enemy');
      if (this.damage > 0) {
        for (const e of enemies) {
          if (!e.active) continue;
          const et = e.get('TransformComponent'); if (!et) continue;
          if (et.position.distanceTo(this._origin) <= this.radius) {
            e.get('HealthComponent')?.takeDamage(this.damage);
          }
        }
      }
      eventBus.emit(EVENTS.GRAVITY_BOMB_EXPLODED, { origin: this._origin, radius: this.radius });
    }
  }
}
