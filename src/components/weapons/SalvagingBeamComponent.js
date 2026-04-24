import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * On enemy kill, converts a fraction of the killing damage into hull repair
 * via PLAYER_HEALED. Requires the player to have energy remaining.
 */
export class SalvagingBeamComponent extends Component {
  constructor({ count = 1, healRatio = 0.05 } = {}) {
    super();
    this.count = count;
    this.healRatio = healRatio;
    this._ctx = null;
  }

  onAttach(ctx) {
    this._ctx = ctx;
    this.listen(EVENTS.ENEMY_KILLED, ({ damage, entity }) => this._onKill(damage || 0, entity));
  }

  _onKill(killingDamage, entity) {
    const ctx = this._ctx;
    if (!ctx || entity?.hasTag?.('wreck_zombie')) return;
    const energy = this.entity.get('EnergyComponent');
    if (!energy || energy.current <= 0) return;
    const heal = Math.max(1, Math.ceil(killingDamage * this.healRatio * this.count));
    eventBus.emit(EVENTS.PLAYER_HEALED, { amount: heal });
  }
}
