import { eventBus, EVENTS } from '../core/EventBus.js';

export class CurrencySystem {
  constructor() {
    this._state = null;
  }

  init(state) {
    this._state = state;
    eventBus.on(EVENTS.LOOT_COLLECTED, ({ currencyType, amount }) => {
      this.add(currencyType, amount);
      // Track round loot
      if (!state.roundLoot[currencyType]) state.roundLoot[currencyType] = 0;
      state.roundLoot[currencyType] += amount;
    });
  }

  add(type, amount) {
    if (this._state.currencies[type] === undefined) return;
    this._state.currencies[type] += amount;
    eventBus.emit(EVENTS.CURRENCY_CHANGED, { type, amount, total: this._state.currencies[type] });
  }

  /** Add multiple currency types at once (e.g. sell refunds). Amounts are floored; zero/negative skipped. */
  addCosts(amounts) {
    for (const [type, raw] of Object.entries(amounts)) {
      const n = Math.floor(Number(raw) || 0);
      if (n <= 0) continue;
      this.add(type, n);
    }
  }

  subtract(costs) {
    // Validate first
    for (const [type, amount] of Object.entries(costs)) {
      if ((this._state.currencies[type] || 0) < amount) return false;
    }
    for (const [type, amount] of Object.entries(costs)) {
      this._state.currencies[type] -= amount;
      eventBus.emit(EVENTS.CURRENCY_CHANGED, {
        type,
        amount: -amount,
        total: this._state.currencies[type],
      });
    }
    return true;
  }

  canAfford(costs) {
    for (const [type, amount] of Object.entries(costs)) {
      if ((this._state.currencies[type] || 0) < amount) return false;
    }
    return true;
  }

  // Generate loot from an enemy kill.
  // lootRates: optional per-currency multiplier map from computed.lootRates
  generateLoot(enemy, lootMultiplier = 1.0, lootRates = null) {
    const drops = [];
    for (const entry of enemy.lootTable) {
      const base = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      const currencyRate = lootRates?.[entry.currency] ?? 1.0;
      const amount = Math.ceil(base * lootMultiplier * currencyRate);
      if (amount > 0) {
        drops.push({ currency: entry.currency, amount });
      }
    }
    return drops;
  }

  // Update passive generation (Stellar Dust etc.) from the old `computed` blob.
  updatePassive(delta, computed) {
    if (computed.stellarDustRate > 0) {
      this.add('stellarDust', computed.stellarDustRate * delta);
    }
    if (computed.passiveRates) {
      for (const [type, rate] of Object.entries(computed.passiveRates)) {
        if (rate > 0) this.add(type, rate * delta);
      }
    }
  }

  /** Passive generation driven from PlayerStatsComponent (ECS). */
  updatePassiveFromStats(delta, stats, powerSiphonCount = 0) {
    if (!stats) return;
    const siphonN = powerSiphonCount ?? 0;
    const stellarMult = siphonN > 0 ? Math.pow(0.72, siphonN) : 1;
    if (stats.stellarDustRate > 0) this.add('stellarDust', stats.stellarDustRate * delta * stellarMult);
    if (stats.passiveRates) {
      const bioInvert = (stats.bioLabInvertTimer ?? 0) > 0;
      for (const [type, rate] of Object.entries(stats.passiveRates)) {
        if (rate <= 0) continue;
        if (type === 'bioEssence' && bioInvert) {
          const dmg = Math.max(1, Math.ceil(rate * delta * 0.4));
          eventBus.emit(EVENTS.PLAYER_DAMAGED, { amount: dmg, source: 'viral' });
        } else {
          this.add(type, rate * delta);
        }
      }
    }
  }

  get(type) {
    return Math.floor(this._state.currencies[type] || 0);
  }
}
