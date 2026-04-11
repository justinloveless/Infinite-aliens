import { PLAYER } from '../constants.js';

// Rebuild computedStats from base stats + tech tree
export class UpgradeSystem {
  compute(state, techTreeState) {
    const base = state.player;
    const computed = {
      // Start with base values
      maxHp: base.maxHp,
      damage: base.damage,
      attackSpeed: base.attackSpeed,
      projectileCount: base.projectileCount,
      projectileSpeed: base.projectileSpeed,
      critChance: base.critChance,
      critMultiplier: base.critMultiplier,
      maxShieldHp: base.maxShieldHp,
      shieldRegen: base.shieldRegen,
      hpRegen: base.hpRegen,
      armor: base.armor,
      speed: base.speed,
      magnetRange: base.magnetRange,
      lootMultiplier: base.lootMultiplier,
      stellarDustRate: base.stellarDustRate,
      projectileType: base.projectileType,
      hasDrone: base.hasDrone,
      hasVampire: base.hasVampire,
      hasDamageReflect: base.hasDamageReflect,
      hasOvercharge: base.hasOvercharge,
      isHoming: base.projectileType === 'missile',
      passiveRates: {},
    };

    if (!techTreeState) return computed;

    const nodes = techTreeState.getVisibleNodes();

    // Apply all unlocked node effects
    for (const node of nodes) {
      if (!node.isUnlocked) continue;
      const level = node.currentLevel;

      for (const effect of node.effects) {
        this._applyEffect(computed, effect, level);
      }
    }

    // Re-clamp values
    computed.critChance = Math.min(0.95, computed.critChance);
    computed.projectileCount = Math.max(1, Math.floor(computed.projectileCount));
    computed.maxShieldHp = Math.max(0, Math.floor(computed.maxShieldHp));
    computed.armor = Math.max(0, Math.floor(computed.armor));
    computed.magnetRange = Math.max(1, computed.magnetRange);
    computed.lootMultiplier = Math.max(1, computed.lootMultiplier);
    computed.isHoming = computed.projectileType === 'missile';

    return computed;
  }

  _applyEffect(computed, effect, level) {
    const { type, stat, value } = effect;

    switch (type) {
      case 'multiply':
        if (computed[stat] !== undefined) {
          computed[stat] *= Math.pow(value, level);
        }
        break;

      case 'add':
        if (computed[stat] !== undefined) {
          computed[stat] += value * level;
        }
        break;

      case 'set':
        computed[stat] = value;
        break;

      case 'special':
        computed[stat] = value;
        break;
    }
  }

  // Apply regen effects to player state each frame
  applyRegen(delta, state, computed) {
    const p = state.player;

    if (computed.hpRegen > 0 && p.hp < computed.maxHp) {
      p.hp = Math.min(computed.maxHp, p.hp + computed.hpRegen * delta);
    }

    if (computed.shieldRegen > 0 && p.shieldHp < computed.maxShieldHp) {
      p.shieldHp = Math.min(computed.maxShieldHp, p.shieldHp + computed.shieldRegen * delta);
    }
  }
}
