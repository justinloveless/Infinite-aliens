import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Wires ColliderComponent.onHit → damage path → destroy/pierce/etc.
 * The projectile prefab attaches this + ColliderComponent + Transform + Mesh.
 */
export class ProjectileDamageComponent extends Component {
  constructor({
    damage = 1,
    isCrit = false,
    isPlayerProjectile = true,
    pierces = 0,
    onKillHealAmount = null,
    onKill = null,
  } = {}) {
    super();
    this.damage = damage;
    this.isCrit = isCrit;
    this.isPlayerProjectile = isPlayerProjectile;
    this.piercesLeft = pierces;
    this._hitEntities = new Set();
    this._onKillHeal = onKillHealAmount;
    this._onKill = onKill;
  }

  onAttach() {
    const col = this.entity.get('ColliderComponent');
    if (!col) return;

    col.shouldCollide = (other) => !this._hitEntities.has(other.id);

    col.onHit = (other, ctx) => {
      const health = other.get('HealthComponent');
      if (!health || health.dead) return;

      if (this.isPlayerProjectile) {
        const dealt = health.takeDamage(this.damage, { isCrit: this.isCrit, source: this.entity });
        if (ctx?.audio) {
          if (health.dead) ctx.audio.play('explosion');
          else ctx.audio.play(this.isCrit ? 'crit' : 'hit');
        }
        if (health.dead) {
          if (this._onKillHeal != null && ctx?.playerEntity) {
            const pH = ctx.playerEntity.get('HealthComponent');
            if (pH) {
              const heal = Math.max(1, Math.ceil(dealt * this._onKillHeal));
              pH.heal(heal);
              eventBus.emit(EVENTS.PLAYER_HEALED, { amount: heal });
            }
          }
          if (typeof this._onKill === 'function') this._onKill(other, ctx);
        }
      } else {
        // Enemy projectile hitting player
        if (!other.hasTag('player')) return;
        const shield = other.get('ShieldComponent');
        const remaining = shield ? shield.absorb(this.damage) : this.damage;
        if (remaining > 0) health.takeDamage(remaining, { source: 'enemyProjectile' });
        else if (ctx?.audio) ctx.audio.play('shieldHit');
      }

      this._hitEntities.add(other.id);
      if (this.piercesLeft > 0) {
        this.piercesLeft--;
      } else {
        this.entity.destroy();
      }
    };
  }
}
