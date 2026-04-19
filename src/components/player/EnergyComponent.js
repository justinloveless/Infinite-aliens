import { Component } from '../../ecs/Component.js';
import { ENERGY } from '../../constants.js';

export class EnergyComponent extends Component {
  constructor({ max = ENERGY.BASE_MAX, regen = ENERGY.BASE_REGEN, drain = 0, current = null } = {}) {
    super();
    this.max = max;
    this.regen = regen;
    this.drain = drain;
    this.current = current ?? max;
  }

  setMax(value) {
    this.max = Math.max(10, value);
    if (this.current > this.max) this.current = this.max;
  }

  spend(amount) {
    if (this.current < amount) return false;
    this.current -= amount;
    return true;
  }

  update(dt) {
    const net = this.regen - this.drain;
    this.current = Math.max(0, Math.min(this.max, this.current + net * dt));
  }
}
