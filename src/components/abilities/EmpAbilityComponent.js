import { AbilityComponent } from './AbilityComponent.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Short stun + AoE damage to every active enemy. Applies a strong slow so
 * no new behavior system is required — movement components read slow status.
 */
export class EmpAbilityComponent extends AbilityComponent {
  constructor({ cooldown = 20, duration = 2, damage = 10, energyCost = 30 } = {}) {
    super({ id: 'emp', icon: '☇', cooldown, energyCost });
    this.duration = duration;
    this.damage = damage;
  }

  activate(ctx) {
    const enemies = ctx.world.query('enemy');
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.enemyType === 'emp_reflector') continue;
      e.get('StatusEffectsComponent')?.apply('slow', { mult: 0.02, duration: this.duration });
      if (this.damage > 0) e.get('HealthComponent')?.takeDamage(this.damage);
    }
    eventBus.emit(EVENTS.EMP_FIRED, { duration: this.duration, damage: this.damage });
  }
}
