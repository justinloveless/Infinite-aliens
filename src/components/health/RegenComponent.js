import { Component } from '../../ecs/Component.js';

/**
 * Passive HP regen/drain. Negative `rate` drains but never kills (floors at 1 HP).
 */
export class RegenComponent extends Component {
  constructor({ rate = 0 } = {}) {
    super();
    this.rate = rate;
  }

  update(dt) {
    const h = this.entity?.get('HealthComponent');
    if (!h || h.dead) return;
    const jam = this.entity.get('PlayerStatsComponent')?.regenJammedMult ?? 1;
    const effRate = this.rate * jam;
    if (effRate > 0 && h.hp < h.maxHp) {
      h.hp = Math.min(h.maxHp, h.hp + effRate * dt);
    } else if (this.rate < 0 && h.hp > 1) {
      h.hp = Math.max(1, h.hp + this.rate * dt);
    }
  }
}
