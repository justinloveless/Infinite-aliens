import { Component } from '../../ecs/Component.js';

/**
 * Tracks timed status effects (burn, slow). `slowMult` is read by movement
 * behavior components, and burn damage is applied at 2 Hz to the entity's
 * HealthComponent.
 */
export class StatusEffectsComponent extends Component {
  constructor() {
    super();
    this.effects = [];
    this._burnTickTimer = 0;
    this.slowMult = 1;
  }

  apply(type, { dps = 0, mult = 1, duration = 3 } = {}) {
    const existing = this.effects.find(s => s.type === type);
    if (existing) {
      existing.remaining = duration;
      if (type === 'burn') existing.dps = Math.max(existing.dps, dps);
      if (type === 'slow') existing.mult = Math.min(existing.mult, mult);
    } else {
      this.effects.push({ type, remaining: duration, dps, mult });
    }
  }

  update(dt) {
    let slow = 1;
    this._burnTickTimer += dt;
    const health = this.entity.get('HealthComponent');
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const s = this.effects[i];
      s.remaining -= dt;
      if (s.remaining <= 0) { this.effects.splice(i, 1); continue; }
      if (s.type === 'slow') slow = Math.min(slow, s.mult);
      if (s.type === 'burn' && this._burnTickTimer >= 0.5 && health) {
        const dmg = Math.max(1, Math.ceil(s.dps * 0.5));
        health.takeDamage(dmg);
      }
    }
    if (this._burnTickTimer >= 0.5) this._burnTickTimer -= 0.5;
    this.slowMult = slow;
  }
}
