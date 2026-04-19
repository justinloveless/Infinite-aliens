import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { PLAYER } from '../../constants.js';

/**
 * Intercepts PLAYER_DIED: if off cooldown, revives at 25% HP and emits an AoE
 * Stellar Nova pulse via the standard nova event path.
 */
export class PhoenixDriveComponent extends Component {
  constructor({ cooldown = 300, corona = 0 } = {}) {
    super();
    this.cooldown = cooldown;
    this.corona = corona;
    this._remaining = 0;
  }

  onAttach() {
    // Listen BEFORE other death handlers by emitting PHOENIX_REVIVED which tells
    // main.js to abort its death flow. We subscribe to PLAYER_DIED with a
    // special high-priority trick: emit revive state through a flag on the
    // entity health comp, and let main.js check.
    this.listen(EVENTS.PLAYER_DIED, () => this._onDeath());
  }

  update(dt) {
    if (this._remaining > 0) this._remaining = Math.max(0, this._remaining - dt);
  }

  _onDeath() {
    if (this._remaining > 0) return;
    const health = this.entity?.get('HealthComponent');
    if (!health) return;
    this._remaining = this.cooldown;
    health.hp = Math.ceil(health.maxHp * 0.25);
    health.dead = false;

    if (this.corona > 0) {
      const t = this.entity.get('TransformComponent');
      if (t) {
        eventBus.emit('trigger:emit_damage', {
          position: t.position.clone(),
          amount: this.corona,
          radius: 8,
        });
      }
    }
    eventBus.emit(EVENTS.PHOENIX_REVIVED, {});
    eventBus.emit(EVENTS.STELLAR_NOVA, { radius: PLAYER.STELLAR_NOVA_BASE_RADIUS });
  }
}
