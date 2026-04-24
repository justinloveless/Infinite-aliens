import { Component } from '../../ecs/Component.js';
import { ENERGY } from '../../constants.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

export class EnergyComponent extends Component {
  constructor({ max = ENERGY.BASE_MAX, regen = ENERGY.BASE_REGEN, drain = 0, current = null } = {}) {
    super();
    this.max = max;
    this.regen = regen;
    this.drain = drain;
    this.current = current ?? max;
    this.systemsOnline = true;
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
    const ps = this.entity.get('PlayerStatsComponent');
    const regenMul = ps?.eclipseRegenMult ?? 1;
    const net = this.regen * regenMul - this.drain;
    this.current = Math.max(0, Math.min(this.max, this.current + net * dt));

    if (this.systemsOnline && this.current <= ENERGY.OFFLINE_THRESHOLD) {
      this.systemsOnline = false;
      eventBus.emit(EVENTS.ENERGY_OFFLINE);
    } else if (!this.systemsOnline && this.current >= this.max * ENERGY.ONLINE_THRESHOLD_FRACTION) {
      this.systemsOnline = true;
      eventBus.emit(EVENTS.ENERGY_ONLINE);
    }
  }
}
