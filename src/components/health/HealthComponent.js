import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Owns HP, armor, and the takeDamage flow. Emits damage/kill events the UI
 * and other components listen to.
 *
 *   entity tagged 'enemy'  -> ENEMY_DAMAGED / ENEMY_KILLED events
 *   entity tagged 'player' -> PLAYER_DAMAGED / PLAYER_DIED events
 */
export class HealthComponent extends Component {
  constructor({ hp = 10, maxHp = 10, armor = 0, damageReceivedMult = 1, flashOnHit = true } = {}) {
    super();
    this.hp = hp;
    this.maxHp = maxHp;
    this.armor = armor;
    this.damageReceivedMult = damageReceivedMult;
    this.flashOnHit = flashOnHit;
    this.dead = false;
    this._lastDamageSource = null;
  }

  setMaxHp(value, healToNew = false) {
    const delta = value - this.maxHp;
    this.maxHp = Math.max(1, value);
    if (healToNew && delta > 0) this.hp = Math.min(this.maxHp, this.hp + delta);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
  }

  /** Raw, pre-armor damage. Returns effective damage dealt. */
  takeDamage(raw, { isCrit = false, source = null, ignoreArmor = false } = {}) {
    if (this.dead || !this.entity?.active) return 0;
    const armor = ignoreArmor ? 0 : (this.armor || 0);
    const dmg = Math.max(1, Math.ceil((raw - armor) * this.damageReceivedMult));
    this.hp = Math.max(0, this.hp - dmg);
    this._lastDamageSource = source;

    const entity = this.entity;
    if (entity.hasTag('enemy')) {
      eventBus.emit(EVENTS.ENEMY_DAMAGED, { entity, damage: dmg, isCrit });
      if (this.flashOnHit) {
        const visuals = entity.get('EnemyVisualsComponent');
        if (visuals && typeof visuals.flash === 'function') visuals.flash();
      }
    }

    if (this.hp <= 0) {
      this.dead = true;
      if (entity.hasTag('enemy')) {
        eventBus.emit(EVENTS.ENEMY_KILLED, { entity });
      } else if (entity.hasTag('player')) {
        eventBus.emit(EVENTS.PLAYER_DIED);
      }
    }

    return dmg;
  }

  heal(amount) {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }
}
