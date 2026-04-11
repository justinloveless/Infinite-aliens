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

  // Generate loot from an enemy kill
  generateLoot(enemy, lootMultiplier = 1.0) {
    const drops = [];
    for (const entry of enemy.lootTable) {
      const base = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      const amount = Math.ceil(base * lootMultiplier);
      if (amount > 0) {
        drops.push({ currency: entry.currency, amount });
      }
    }
    return drops;
  }

  // Update passive generation (Stellar Dust etc.)
  updatePassive(delta, computed) {
    if (computed.stellarDustRate > 0) {
      this.add('stellarDust', computed.stellarDustRate * delta);
    }
    // Additional passive rates from special nodes
    if (computed.passiveRates) {
      for (const [type, rate] of Object.entries(computed.passiveRates)) {
        if (rate > 0) this.add(type, rate * delta);
      }
    }
  }

  get(type) {
    return Math.floor(this._state.currencies[type] || 0);
  }
}
