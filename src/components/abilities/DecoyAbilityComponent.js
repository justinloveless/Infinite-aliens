import { AbilityComponent } from './AbilityComponent.js';
import { eventBus } from '../../core/EventBus.js';

/**
 * Spawns holographic decoy entities near the player that draw enemy fire.
 * Actual decoy entity creation is delegated to ctx.spawnDecoy(position) if
 * provided, otherwise just emits an event.
 */
export class DecoyAbilityComponent extends AbilityComponent {
  constructor({ cooldown = 40, duration = 5, count = 1, energyCost = 20 } = {}) {
    super({ id: 'decoy', icon: '◈', cooldown, energyCost });
    this.duration = duration;
    this.count = count;
  }

  activate(ctx) {
    const t = this.entity.get('TransformComponent'); if (!t) return;
    eventBus.emit('ability:decoy', {
      position: t.position.clone(),
      duration: this.duration,
      count: this.count,
    });
  }
}
