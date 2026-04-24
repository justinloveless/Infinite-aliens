import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * On nearby kills, spawns a short-lived weak copy (half HP) for harassment.
 * Uses `ctx.spawnEnemyClone` (wired from main) to avoid a circular import with createEnemy.
 */
export class WreckAnimatorComponent extends Component {
  constructor({ range = 22 } = {}) {
    super();
    this.range = range;
    this._unsub = null;
  }

  onAttach(ctx) {
    this._ctx = ctx;
    this._unsub = eventBus.on(EVENTS.ENEMY_KILLED, ({ entity }) => this._onKill(entity));
  }

  onDetach() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
  }

  _onKill(entity) {
    if (!entity || entity === this.entity || entity.hasTag?.('wreck_zombie')) return;
    if (entity.hasTag?.('gate_crystal')) return;
    const ctx = this._ctx;
    const et = this.entity.get('TransformComponent');
    const ot = entity.get('TransformComponent');
    if (!ctx?.world || !et || !ot) return;
    if (et.position.distanceTo(ot.position) > this.range) return;
    const spawnFn = ctx.spawnEnemyClone;
    if (typeof spawnFn !== 'function') return;
    const tier = Math.max(1, ctx.state?.round?.current ?? 1);
    const stats = ctx.playerEntity?.get('PlayerStatsComponent');
    const type = entity.enemyType && entity.enemyType !== 'boss' ? entity.enemyType : 'scout';
    const z = spawnFn(type, tier, stats, {
      x: ot.position.x + (Math.random() - 0.5),
      z: ot.position.z + (Math.random() - 0.5),
    });
    z.addTag('wreck_zombie');
    const h = z.get('HealthComponent');
    if (h) {
      h.maxHp = Math.max(1, Math.floor(h.maxHp * 0.5));
      h.hp = h.maxHp;
    }
    ctx.world.spawn(z);
  }
}
