import { AbilityComponent } from './AbilityComponent.js';

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
  }

  onAttach(ctx) { this._ctx = ctx; }

  activate(ctx) {
    const t = this.entity.get('TransformComponent'); if (!t) return;
    this._origin = t.position.clone();
    this._active = this.duration;
  }

  update(dt) {
    super.update(dt);
    if (this._active <= 0) return;
    this._active -= dt;
    const ctx = this._ctx;
    if (!ctx) return;

    const enemies = ctx.world.query('enemy');
    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.get('TransformComponent'); if (!et) continue;
      const dir = this._origin.clone().sub(et.position);
      const dist = dir.length();
      if (dist > this.radius || dist < 0.001) continue;
      dir.normalize();
      et.position.addScaledVector(dir, this.pullStrength * dt);
    }
    if (this._active <= 0 && this.damage > 0) {
      for (const e of enemies) {
        if (!e.active) continue;
        const et = e.get('TransformComponent'); if (!et) continue;
        if (et.position.distanceTo(this._origin) <= this.radius) {
          e.get('HealthComponent')?.takeDamage(this.damage);
        }
      }
    }
  }
}
