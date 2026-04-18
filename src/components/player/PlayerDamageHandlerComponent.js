import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Routes PLAYER_DAMAGED events through shield → health, plays feedback.
 * Listens to PLAYER_HEALED and applies healing to HealthComponent.
 */
export class PlayerDamageHandlerComponent extends Component {
  onAttach(ctx) {
    this.listen(EVENTS.PLAYER_DAMAGED, ({ amount, source }) => this._onDamage(amount, source, ctx));
    this.listen(EVENTS.PLAYER_HEALED, ({ amount }) => this._onHeal(amount));
  }

  _onDamage(amount, source, ctx) {
    // Skip processing re-emitted PLAYER_DAMAGED from takeDamage to avoid loops.
    if (source === '_internal') return;

    const shield = this.entity.get('ShieldComponent');
    const health = this.entity.get('HealthComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    const audio = ctx?.audio;

    const remaining = shield ? shield.absorb(amount) : amount;
    if (!shield || shield.hp <= 0 || remaining === amount) {
      // Shield absent or broken — full damage flashes red.
      if (remaining > 0) {
        if (health) {
          health.hp = Math.max(0, health.hp - remaining);
          if (health.hp <= 0 && !health.dead) {
            health.dead = true;
            eventBus.emit(EVENTS.PLAYER_DIED);
          }
        }
        if (visuals) visuals.flash(0xff0000);
        if (audio) audio.play('playerDamage');
      } else if (audio) {
        audio.play('shieldHit');
      }
    } else if (remaining > 0) {
      if (health) {
        health.hp = Math.max(0, health.hp - remaining);
        if (health.hp <= 0 && !health.dead) {
          health.dead = true;
          eventBus.emit(EVENTS.PLAYER_DIED);
        }
      }
      if (visuals) visuals.flash(0xff0000);
      if (audio) audio.play('playerDamage');
    } else if (audio) {
      audio.play('shieldHit');
    }

    // Camera shake
    ctx?.camera?.shake?.(0.35, 0.2);
  }

  _onHeal(amount) {
    const health = this.entity.get('HealthComponent');
    if (health && !health.dead) health.heal(amount);
  }
}
