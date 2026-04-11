export class TechNode {
  constructor(data) {
    this.id = data.id;
    this.tier = data.tier;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;    // 'weapon' | 'defense' | 'utility' | 'passive' | 'special'
    this.effects = data.effects;      // Array of { type, stat, value }
    this.maxLevel = data.maxLevel;
    this.currentLevel = data.currentLevel || 0;
    this.baseCost = data.baseCost;    // { currencyType: amount }
    this.prerequisites = data.prerequisites;  // [nodeId]
    this.position = data.position;    // { x, y }
    this.icon = data.icon;
  }

  get isMaxed() {
    return this.currentLevel >= this.maxLevel;
  }

  get isUnlocked() {
    return this.currentLevel > 0;
  }

  // Cost for next level: baseCost * (1.4 ^ currentLevel)
  getCostForNextLevel() {
    const mult = Math.pow(1.4, this.currentLevel);
    return Object.fromEntries(
      Object.entries(this.baseCost).map(([k, v]) =>
        [k, Math.ceil(v * mult)]
      )
    );
  }

  // Total effect at given level
  getEffectAtLevel(level) {
    return this.effects.map(e => ({
      ...e,
      effectiveValue: e.type === 'multiply'
        ? Math.pow(e.value, level)
        : e.value * level,
    }));
  }

  // Description of effect at next level
  getNextLevelDescription() {
    return this.effects.map(e => {
      const nextLvl = this.currentLevel + 1;
      if (e.type === 'multiply') {
        const pct = ((Math.pow(e.value, nextLvl) - 1) * 100).toFixed(0);
        return `+${pct}% ${e.statLabel || e.stat}`;
      } else if (e.type === 'add') {
        return `+${(e.value * nextLvl).toFixed(1)} ${e.statLabel || e.stat}`;
      } else if (e.type === 'set') {
        return `Enables ${e.statLabel || e.stat}`;
      } else if (e.type === 'special') {
        return e.specialDesc || e.stat;
      }
      return '';
    }).join(', ');
  }
}
