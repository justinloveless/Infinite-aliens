import { Component } from '../../ecs/Component.js';
import { PLAYER } from '../../constants.js';

/**
 * Holds mutable player combat stats and multipliers derived from the upgrade
 * system. Other components read from here rather than a global `computed` blob.
 *
 * UpgradeApplier rebuilds this component's values on every recompute.
 */
export class PlayerStatsComponent extends Component {
  constructor(init = {}) {
    super();
    this.damage = init.damage ?? PLAYER.BASE_DAMAGE;
    this.attackSpeed = init.attackSpeed ?? PLAYER.BASE_ATTACK_SPEED;
    this.projectileCount = init.projectileCount ?? PLAYER.BASE_PROJECTILE_COUNT;
    this.projectileSpeed = init.projectileSpeed ?? PLAYER.BASE_PROJECTILE_SPEED;
    this.critChance = init.critChance ?? PLAYER.BASE_CRIT_CHANCE;
    this.critMultiplier = init.critMultiplier ?? PLAYER.BASE_CRIT_MULT;
    this.speed = init.speed ?? PLAYER.BASE_SPEED;
    this.magnetRange = init.magnetRange ?? PLAYER.BASE_MAGNET_RANGE;
    this.visionRange = init.visionRange ?? PLAYER.BASE_VISION_RANGE;
    this.targetingRange = init.targetingRange ?? PLAYER.BASE_TARGETING_RANGE;
    this.lootMultiplier = init.lootMultiplier ?? PLAYER.BASE_LOOT_MULT;
    this.stellarDustRate = init.stellarDustRate ?? 0;
    this.projectileType = init.projectileType ?? 'laser';
    this.isHoming = init.isHoming ?? false;
    this.projectilePierces = init.projectilePierces ?? 0;
    this.vampireHealRatio = init.vampireHealRatio ?? 0;
    this.damageReflect = init.damageReflect ?? 0;
    this.lootRates = init.lootRates || { scrapMetal: 1, plasmaCrystals: 1, bioEssence: 1, darkMatter: 1, stellarDust: 1 };
    this.passiveRates = init.passiveRates || {};
    this.enemyModifiers = init.enemyModifiers || null;
    this.roundModifiers = init.roundModifiers || { spawnInterval: 1.0, maxConcurrent: 1.0 };
    this.projectileVisuals = init.projectileVisuals || new Map();
    this.visualModifiers = init.visualModifiers || [];
    this.attachments = init.attachments || [];
    this.manualTargetFocusEnabled = init.manualTargetFocusEnabled ?? false;
    /** Transient boosts from trigger actions, e.g. Berserker Protocol. */
    this.activeBoosts = init.activeBoosts || [];
  }

  /** Effective damage factoring boosts + resonance stacks (kills this run). */
  calcDamage({ killsThisRun = 0, resonanceFieldLevel = 0 } = {}) {
    let dmg = this.damage;
    if (resonanceFieldLevel > 0) {
      const stacks = Math.floor(killsThisRun / 10);
      dmg *= 1 + Math.min(0.5, stacks * 0.05 * resonanceFieldLevel);
    }
    for (const boost of this.activeBoosts) {
      if (boost.stat === 'damage') dmg *= boost.multiplier;
    }
    const isCrit = Math.random() < this.critChance;
    return { damage: Math.ceil(dmg * (isCrit ? this.critMultiplier : 1)), isCrit };
  }

  /** Effective fire-rate (seconds between shots) factoring attack-speed boosts. */
  calcFireInterval() {
    let rate = 1 / Math.max(0.01, this.attackSpeed);
    for (const boost of this.activeBoosts) {
      if (boost.stat === 'attackSpeed') rate /= boost.multiplier;
    }
    return rate;
  }

  /** Decay active boosts each frame. */
  update(dt) {
    for (let i = this.activeBoosts.length - 1; i >= 0; i--) {
      this.activeBoosts[i].remaining -= dt;
      if (this.activeBoosts[i].remaining <= 0) this.activeBoosts.splice(i, 1);
    }
  }
}
