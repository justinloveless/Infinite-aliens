import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Routes PLAYER_DAMAGED events through shield → health, plays feedback.
 * Listens to PLAYER_HEALED and applies healing to HealthComponent.
 */
export class PlayerDamageHandlerComponent extends Component {
  onAttach(ctx) {
    this.listen(EVENTS.PLAYER_DAMAGED, (payload) => this._onDamage(payload, ctx));
    this.listen(EVENTS.PLAYER_HEALED, ({ amount }) => this._onHeal(amount));
  }

  _onDamage(payload, ctx) {
    const { amount, source, ignorePlayerArmor = false } = payload || {};
    // Skip processing re-emitted PLAYER_DAMAGED from takeDamage to avoid loops.
    if (source === '_internal') return;

    const shield = this.entity.get('ShieldComponent');
    const health = this.entity.get('HealthComponent');
    const stats = this.entity.get('PlayerStatsComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    const audio = ctx?.audio;

    let remaining = amount;
    if (shield && shield.maxHp > 0) {
      const hpBefore = shield.hp;
      remaining = shield.absorb(amount);
      const absorbed = amount - remaining;
      if (absorbed > 0) {
        eventBus.emit(EVENTS.SHIELD_DAMAGED, { absorbed, hp: shield.hp, maxHp: shield.maxHp });
        if (hpBefore > 0 && shield.hp <= 0) {
          eventBus.emit(EVENTS.SHIELD_BROKEN, { maxHp: shield.maxHp });
        }
      }
    }
    const armor = ignorePlayerArmor ? 0 : Math.max(0, (health?.armor ?? 0) - (stats?.corrosionArmorBypass ?? 0));
    const hullFrom = (dmg) => Math.max(1, dmg - armor);

    if (!shield || shield.hp <= 0 || remaining === amount) {
      // Shield absent or broken — full damage flashes red.
      if (remaining > 0) {
        if (health) {
          const hullDmg = hullFrom(remaining);
          health.hp = Math.max(0, health.hp - hullDmg);
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
        const hullDmg = hullFrom(remaining);
        health.hp = Math.max(0, health.hp - hullDmg);
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
