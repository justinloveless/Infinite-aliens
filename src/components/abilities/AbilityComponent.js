import { Component } from '../../ecs/Component.js';

/**
 * Base class for active abilities. Handles cooldown tracking, energy cost,
 * and invokes `activate(ctx)` on successful trigger. Subclasses override
 * `activate(ctx)` to perform their effect.
 */
export class AbilityComponent extends Component {
  constructor({ id, icon = '?', cooldown = 10, energyCost = 0 } = {}) {
    super();
    this.id = id;
    this.icon = icon;
    this.cooldown = cooldown;
    this.energyCost = energyCost;
    this.remaining = 0;
  }

  canTrigger() {
    if (this.remaining > 0) return false;
    const energy = this.entity.get('EnergyComponent');
    return !energy || energy.current >= this.energyCost;
  }

  trigger(ctx) {
    if (!this.canTrigger()) return false;
    const energy = this.entity.get('EnergyComponent');
    if (energy && !energy.spend(this.energyCost)) return false;
    this.remaining = this.cooldown;
    this.activate(ctx);
    return true;
  }

  activate(_ctx) {}

  update(dt) {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
  }
}
