import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { PLAYER } from '../../constants.js';

/**
 * When this enemy overlaps the player, deals its `damage` via PLAYER_DAMAGED.
 * If `meleeSuicide` is true the enemy also dies on contact; otherwise (bosses)
 * contact damage pulses on a 1s cooldown.
 */
export class ContactDamageComponent extends Component {
  constructor({ damage = 1, meleeSuicide = true, cooldown = 1.0, ignorePlayerArmor = false } = {}) {
    super();
    this.damage = damage;
    this.meleeSuicide = meleeSuicide;
    this.cooldown = cooldown;
    this.ignorePlayerArmor = ignorePlayerArmor;
    this._cooldownRemaining = 0;
  }

  update(dt, ctx) {
    if (this._cooldownRemaining > 0) this._cooldownRemaining -= dt;
    const t = this.entity.get('TransformComponent');
    const playerT = ctx.playerEntity?.get('TransformComponent');
    if (!t || !playerT) return;
    const d2 = t.position.distanceToSquared(playerT.position);
    const r = PLAYER.COLLISION_RADIUS + (this.entity.get('ColliderComponent')?.radius ?? 0.5);
    if (d2 > r * r) return;

    if (this._cooldownRemaining > 0) return;
    eventBus.emit(EVENTS.PLAYER_DAMAGED, {
      amount: this.damage,
      source: 'contact',
      ignorePlayerArmor: this.ignorePlayerArmor,
    });
    if (ctx.audio) ctx.audio.play('playerDamage');

    if (this.meleeSuicide) {
      const h = this.entity.get('HealthComponent');
      if (h) h.takeDamage(h.hp, { ignoreArmor: true });
    } else {
      this._cooldownRemaining = this.cooldown;
    }
  }
}
