export class TechNode {
  constructor(data) {
    this.id = data.id;
    this.templateId = data.templateId || null;
    this.tier = data.tier;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;    // 'weapon' | 'defense' | 'utility' | 'passive' | 'special'
    this.effects = data.effects;      // Array of Effect objects
    this.maxLevel = data.maxLevel;
    this.currentLevel = data.currentLevel || 0;
    this.baseCost = data.baseCost;    // { currencyType: amount }
    this.prerequisites = data.prerequisites;  // [nodeId]
    this.position = data.position;    // { x, y }
    this.icon = data.icon;

    // Grammar extensions (all optional)
    this.triggers = data.triggers || [];
    this.synergies = data.synergies || [];
    this.presentation = data.presentation || null;
    this.costModifiers = data.costModifiers || [];
    this.visual = data.visual || null;
  }

  get isMaxed() {
    return this.currentLevel >= this.maxLevel;
  }

  get isUnlocked() {
    return this.currentLevel > 0;
  }

  // Cost for next level: baseCost * (1.4 ^ currentLevel), with optional dynamic modifiers
  getCostForNextLevel(state = null) {
    const mult = Math.pow(1.4, this.currentLevel);
    let cost = Object.fromEntries(
      Object.entries(this.baseCost).map(([k, v]) =>
        [k, Math.ceil(v * mult)]
      )
    );

    if (!this.costModifiers?.length || !state) return cost;

    for (const mod of this.costModifiers) {
      if (mod.type === 'round_scale' && state?.round) {
        const factor = 1 + (mod.factor || 0.02) * (state.round.current - 1);
        cost = Object.fromEntries(
          Object.entries(cost).map(([k, v]) => [k, Math.ceil(v * factor)])
        );
      }
      if (mod.type === 'synergy_discount' && state?._unlockedTemplates) {
        const active = mod.requires?.every(tid => state._unlockedTemplates.has(tid));
        if (active) {
          cost = Object.fromEntries(
            Object.entries(cost).map(([k, v]) => [k, Math.ceil(v * (1 - (mod.discount || 0)))])
          );
        }
      }
    }
    return cost;
  }

  // Compute the effective scaled value for an effect at a given level
  _calcScaledValue(effect, level) {
    const { type, value, scaleMode, diminishingBase } = effect;
    const mode = scaleMode || (type === 'multiply' ? 'exponential' : 'linear');
    switch (mode) {
      case 'exponential': return Math.pow(value, level);
      case 'linear': return value * level;
      case 'fixed': return value;
      case 'diminishing': {
        const base = diminishingBase || 0.15;
        let total = 0;
        for (let i = 1; i <= level; i++) total += value * Math.pow(1 - base, i - 1);
        return total;
      }
      default: return type === 'multiply' ? Math.pow(value, level) : value * level;
    }
  }

  // Total effect at given level
  getEffectAtLevel(level) {
    return this.effects.map(e => ({
      ...e,
      effectiveValue: this._calcScaledValue(e, level),
    }));
  }

  // Description of effect at next level
  getNextLevelDescription() {
    const nextLvl = this.currentLevel + 1;
    const parts = this.effects
      .filter(e => !e.condition) // omit conditional effects from basic description
      .map(e => {
        switch (e.type) {
          case 'multiply': {
            const val = this._calcScaledValue(e, nextLvl);
            const pct = ((val - 1) * 100).toFixed(0);
            return `+${pct}% ${e.statLabel || e.stat}`;
          }
          case 'add': {
            const val = this._calcScaledValue(e, nextLvl);
            return `+${val.toFixed(1)} ${e.statLabel || e.stat}`;
          }
          case 'add_flat':
            return `+${e.value} ${e.statLabel || e.stat}`;
          case 'set':
          case 'special':
            return e.specialDesc || `Enables ${e.statLabel || e.stat}`;
          case 'add_weapon':
            return `${e.statLabel || e.value} weapon`;
          case 'min':
            return `Min ${e.statLabel || e.stat}: ${e.value}`;
          case 'max':
            return `Cap ${e.statLabel || e.stat}: ${e.value}`;
          case 'toggle':
            return `Toggle ${e.statLabel || e.stat}`;
          case 'append':
            return `Add ${e.statLabel || e.value}`;
          default:
            return '';
        }
      })
      .filter(Boolean);
    return parts.join(', ');
  }
}
