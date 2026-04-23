import { Component } from '../../ecs/Component.js';
import { ENERGY } from '../../constants.js';

/**
 * Absorbs damage before HealthComponent. The player's damage path checks this
 * via `entity.get('ShieldComponent')?.absorb(amount)`.
 */
export class ShieldComponent extends Component {
  constructor({ maxHp = 0, hp = 0, regen = 0 } = {}) {
    super();
    this.maxHp = maxHp;
    this.hp = hp;
    this.regen = regen;
  }

  setMaxHp(value) {
    this.maxHp = Math.max(0, value);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  /** Returns remaining damage after the shield absorbs as much as it can. */
  absorb(amount) {
    if (this.hp <= 0 || this.maxHp <= 0) return amount;
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    return amount - taken;
  }

  update(dt) {
    const energy = this.entity?.get('EnergyComponent');
    if (energy && !energy.systemsOnline) return;
    if (this.regen > 0 && this.hp < this.maxHp) {
      const healed = Math.min(this.maxHp - this.hp, this.regen * dt);
      this.hp += healed;
      energy?.spend(healed * ENERGY.SHIELD_RECHARGE_COST_RATIO);
    }
  }
}
