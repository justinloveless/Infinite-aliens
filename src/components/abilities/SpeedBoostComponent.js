import { AbilityComponent } from './AbilityComponent.js';

/**
 * Temporary speed boost applied via PlayerStatsComponent.activeBoosts.
 * PlayerInputComponent reads the boost multiplier each frame.
 */
export class SpeedBoostComponent extends AbilityComponent {
  constructor({ cooldown = 15, duration = 3, multiplier = 1.8, energyCost = 15 } = {}) {
    super({ id: 'speed_booster', icon: '⚡', cooldown, energyCost });
    this.duration = duration;
    this.multiplier = multiplier;
  }

  activate() {
    const stats = this.entity.get('PlayerStatsComponent');
    if (stats) stats.activeBoosts.push({ stat: 'speed', multiplier: this.multiplier, remaining: this.duration });
  }
}
