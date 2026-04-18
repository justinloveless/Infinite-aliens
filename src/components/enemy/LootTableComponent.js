import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

/**
 * Spawns loot drop entities at this enemy's position when it dies.
 * Loot generation is delegated to `ctx.currency.generateLoot(...)`.
 */
export class LootTableComponent extends Component {
  constructor({ table = [] } = {}) {
    super();
    this.table = table;
    this._ctx = null;
  }

  onAttach(ctx) {
    this._ctx = ctx;
    this.listen(EVENTS.ENEMY_KILLED, ({ entity }) => {
      if (entity !== this.entity) return;
      this._dropLoot();
    });
  }

  _dropLoot() {
    const ctx = this._ctx;
    if (!ctx?.currency || !ctx?.spawnLoot) return;
    const t = this.entity.get('TransformComponent');
    if (!t) return;
    const stats = ctx.playerEntity?.get('PlayerStatsComponent');
    const lootMult = stats?.lootMultiplier ?? 1;
    const lootRates = stats?.lootRates ?? null;
    const drops = ctx.currency.generateLoot({ lootTable: this.table }, lootMult, lootRates);
    for (const drop of drops) {
      ctx.spawnLoot(t.position, drop.currency, drop.amount);
    }
  }
}
