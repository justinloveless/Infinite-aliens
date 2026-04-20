import { PLAYER, ENERGY } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { buildHangarUnlockedNodes, getWeaponSlotAssignments } from '../hangar/HangarSystem.js';

import { PlayerStatsComponent } from '../components/player/PlayerStatsComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { ShieldComponent } from '../components/health/ShieldComponent.js';
import { RegenComponent } from '../components/health/RegenComponent.js';
import { EnergyComponent } from '../components/player/EnergyComponent.js';
import { PhoenixDriveComponent } from '../components/player/PhoenixDriveComponent.js';

import { AutoFireWeaponComponent } from '../components/weapons/AutoFireWeaponComponent.js';
import {
  LaserTurretComponent, MissileTurretComponent, PlasmaTurretComponent,
} from '../components/weapons/TurretWeaponComponent.js';
import { BeamLaserComponent } from '../components/weapons/BeamLaserComponent.js';
import { ManualGunComponent } from '../components/weapons/ManualGunComponent.js';
import { RailgunComponent } from '../components/weapons/RailgunComponent.js';
import { MiningLaserComponent } from '../components/weapons/MiningLaserComponent.js';
import { SalvagingBeamComponent } from '../components/weapons/SalvagingBeamComponent.js';

import { StellarNovaComponent } from '../components/aoe/StellarNovaComponent.js';
import { CorrosiveAuraComponent } from '../components/aoe/CorrosiveAuraComponent.js';
import { GravityWellComponent } from '../components/aoe/GravityWellComponent.js';
import { RepulserComponent } from '../components/aoe/RepulserComponent.js';
import { ResonanceFieldComponent } from '../components/aoe/ResonanceFieldComponent.js';

import { SpeedBoostComponent } from '../components/abilities/SpeedBoostComponent.js';
import { EmpAbilityComponent } from '../components/abilities/EmpAbilityComponent.js';
import { WarpDriveComponent } from '../components/abilities/WarpDriveComponent.js';
import { GravityBombComponent } from '../components/abilities/GravityBombComponent.js';
import { DecoyAbilityComponent } from '../components/abilities/DecoyAbilityComponent.js';

const ENEMY_TYPES = ['all', 'scout', 'tank', 'swarm', 'sniper', 'boss'];

function clampOdd(n) {
  let x = Math.max(1, Math.floor(n));
  if (x % 2 === 0) x += 1;
  return x;
}

function makeEnemyModifiers() {
  const mods = {};
  for (const t of ENEMY_TYPES) {
    mods[t] = { hpMult: 1, damageMult: 1, speedMult: 1, damageReceivedMult: 1 };
  }
  return mods;
}

/**
 * Rebuilds the player's components from unlocked tech tree nodes.
 *
 * Replaces the old UpgradeSystem + `computed` blob. Supports the declarative
 * effect grammar (multiply/add/set/add_weapon/special/min/max/append), plus
 * three new operators that manipulate entity composition directly:
 *   - add_component     { component: "Name", params: {...} }
 *   - remove_component  { component: "Name" }
 *   - modify_component  { component: "Name", params: {...} }
 */
export class UpgradeApplier {
  constructor({ world, state, playerEntity }) {
    this.world = world;
    this.state = state;
    this.playerEntity = playerEntity;
    this._triggerUnsubscribers = [];
    this._triggerCooldowns = new Map();
    this._lastStats = null;
  }

  /** Apply current tech-tree unlocks to the player entity. */
  apply(techTreeState) {
    const stats = this._buildStats(techTreeState);
    this._syncPlayerStats(stats);
    this._syncDependentComponents(stats);
    this._unregisterTriggers();
    const unlocked = this._gatherAllUnlocked(techTreeState);
    this._registerTriggers(unlocked, stats);
    this._lastStats = stats;
    return stats;
  }

  /**
   * Build the full unlocked-node list from all three sources:
   *   1. Installed items (state.ship.slots)
   *   2. Research purchases (state.ship.research)
   *   3. Legacy tech tree unlocks
   * Hangar nodes come first so the tech tree ones dedupe against them.
   */
  _gatherAllUnlocked(techTreeState) {
    const hangar = buildHangarUnlockedNodes(this.state);
    const seen = new Set(hangar.map(n => n.id));
    const tree = techTreeState ? techTreeState.getVisibleNodes().filter(n => n.isUnlocked) : [];
    for (const n of tree) {
      if (!seen.has(n.templateId || n.id)) {
        hangar.push(n);
        seen.add(n.templateId || n.id);
      }
    }
    return hangar;
  }

  /** Dry-run: compute stats for an arbitrary candidate ship state (for hangar previews). */
  preview(techTreeState, candidateShipState) {
    const originalShip = this.state.ship;
    this.state.ship = candidateShipState;
    try {
      return this._buildStats(techTreeState);
    } finally {
      this.state.ship = originalShip;
    }
  }

  /** Decrement trigger cooldowns + decay active boosts each frame. */
  tick(dt) {
    for (const [k, rem] of this._triggerCooldowns) {
      if (rem > 0) this._triggerCooldowns.set(k, rem - dt);
    }
  }

  _buildStats(techTreeState) {
    const base = this.state.player;
    const stats = {
      maxHp: base.maxHp ?? PLAYER.BASE_HP,
      damage: base.damage ?? PLAYER.BASE_DAMAGE,
      attackSpeed: base.attackSpeed ?? PLAYER.BASE_ATTACK_SPEED,
      projectileCount: base.projectileCount ?? PLAYER.BASE_PROJECTILE_COUNT,
      projectileSpeed: base.projectileSpeed ?? PLAYER.BASE_PROJECTILE_SPEED,
      critChance: base.critChance ?? PLAYER.BASE_CRIT_CHANCE,
      critMultiplier: base.critMultiplier ?? PLAYER.BASE_CRIT_MULT,
      maxShieldHp: base.maxShieldHp ?? 0,
      shieldRegen: base.shieldRegen ?? 0,
      hpRegen: base.hpRegen ?? 0,
      armor: base.armor ?? 0,
      speed: base.speed ?? PLAYER.BASE_SPEED,
      magnetRange: base.magnetRange ?? PLAYER.BASE_MAGNET_RANGE,
      visionRange: base.visionRange ?? PLAYER.BASE_VISION_RANGE,
      targetingRange: base.targetingRange ?? PLAYER.BASE_TARGETING_RANGE,
      lootMultiplier: base.lootMultiplier ?? PLAYER.BASE_LOOT_MULT,
      stellarDustRate: base.stellarDustRate ?? 0,
      projectileType: base.projectileType ?? 'laser',
      extraWeapons: [],
      hasAutoFire: !!base.hasAutoFire,
      hasVampire: !!base.hasVampire,
      hasDamageReflect: !!base.hasDamageReflect,
      hasOvercharge: !!base.hasOvercharge,
      isHoming: (base.projectileType ?? 'laser') === 'missile',
      passiveRates: {},
      activeBoosts: [],
      enemyModifiers: makeEnemyModifiers(),
      roundModifiers: { spawnInterval: 1, maxConcurrent: 1 },
      lootRates: { credits: 1, scrapMetal: 1, plasmaCrystals: 1, bioEssence: 1, darkMatter: 1, stellarDust: 1 },
      visualModifiers: [],
      attachments: [],
      projectileVisuals: new Map(),

      stellarNovaLevel: 0, stellarNovaInterval: 0, stellarNovaDamage: 0, stellarNovaRadius: 0,
      projectilePierces: 0,
      resonanceFieldLevel: 0,
      corrosiveAuraDps: 0,
      momentumEngineActive: false,
      gravityWellActive: false,
      interestRate: 0,
      manualTargetFocusEnabled: false,
      manualGunHeatPerShotMult: 1,
      manualGunOverheatDurationMult: 1,
      vampireHealRatio: 0,
      damageReflect: 0,

      maxEnergy: ENERGY.BASE_MAX,
      energyRegen: ENERGY.BASE_REGEN,
      energyDrain: 0,

      repulserActive: false, repulserInterval: 6, repulserRadius: 8, repulserDamage: 0,
      scannerActive: false,

      phoenixDriveActive: false, phoenixDriveCooldown: 300, phoenixDriveCorona: 0,

      railgunActive: false, railgunChargeTime: 2.5, railgunDamage: 0, railgunEnergyCost: 40,
      manualGunSwapped: false,

      salvagingBeamActive: false, salvagingBeamCount: 1, salvagingBeamHealRatio: 0.05,
      miningLaserActive: false, miningLaserCount: 1, miningYield: 1,

      laserFocusActive: false, laserSplitCount: 0,
      multiTargetActive: false, targetAcquisitionSpeed: 1, smartTargetingActive: false,

      speedBoosterUnlocked: false, speedBoostMult: 1.8, speedBoostDuration: 3, speedBoostCooldown: 20,
      empUnlocked: false, empDuration: 3, empDamage: 0, empCooldown: 25,
      warpDriveUnlocked: false, warpDistance: 10, warpDriveCooldown: 15,
      gravityBombUnlocked: false, gravityBombRadius: 8, gravityBombDamage: 0, gravityBombDuration: 5, gravityBombCooldown: 30,
      decoyUnlocked: false, decoyDuration: 5, decoyCount: 1, decoyEnergyCost: 20,

      __pendingComponentOps: [], // new grammar ops captured here
    };

    const unlocked = this._gatherAllUnlocked(techTreeState);

    if (!unlocked.length) {
      stats.projectileCount = clampOdd(stats.projectileCount);
      return stats;
    }

    for (const node of unlocked) {
      for (const effect of node.effects) {
        if (effect.condition) continue;
        this._applyEffect(stats, effect, node.currentLevel);
      }
      if (node.visual?.modifiers?.length) stats.visualModifiers.push(...node.visual.modifiers);
      if (node.visual?.attachments?.length) stats.attachments.push(...node.visual.attachments);
      if (node.visual?.projectile) {
        const pv = node.visual.projectile;
        stats.projectileVisuals.set(pv.type || 'all', pv);
      }
    }

    const unlockedIds = new Set(unlocked.map(n => n.templateId || n.id));
    this.state._unlockedTemplates = unlockedIds;

    for (const node of unlocked) {
      if (!node.synergies?.length) continue;
      for (const syn of node.synergies) {
        if (syn.requires?.every(tid => unlockedIds.has(tid))) {
          for (const e of (syn.effects || [])) this._applyEffect(stats, e, 1);
        }
      }
    }

    for (const node of unlocked) {
      for (const e of node.effects) {
        if (!e.condition) continue;
        if (this._evalCondition(e.condition, stats, unlockedIds)) {
          this._applyEffect(stats, e, node.currentLevel);
        }
      }
    }

    // Mastery bonuses: +1% per mastery level per affected stat
    for (const node of unlocked) {
      if (!(node.masteryLevel > 0)) continue;
      const bonus = node.masteryLevel * 0.01;
      const seen = new Set();
      for (const effect of node.effects) {
        if (effect.condition) continue;
        const target = effect.target || 'player';
        if (target !== 'player') continue;
        const { type, stat } = effect;
        if (seen.has(stat) || stats[stat] === undefined) continue;
        if (type === 'multiply') {
          stats[stat] *= (1 + bonus);
          seen.add(stat);
        } else if (type === 'add' || type === 'add_flat') {
          stats[stat] += effect.value * bonus;
          seen.add(stat);
        }
      }
    }

    // Stellar Nova scaling
    const nova = unlocked.find(n => n.templateId === 'stellar_burst');
    if (nova && nova.currentLevel > 0) {
      const lv = nova.currentLevel;
      const P = PLAYER;
      stats.stellarNovaLevel = lv;
      stats.stellarNovaInterval = Math.max(
        P.STELLAR_NOVA_MIN_INTERVAL,
        P.STELLAR_NOVA_BASE_INTERVAL - (lv - 1) * P.STELLAR_NOVA_INTERVAL_PER_LEVEL
      );
      stats.stellarNovaDamage = P.STELLAR_NOVA_BASE_DAMAGE + (lv - 1) * P.STELLAR_NOVA_DAMAGE_PER_LEVEL;
      stats.stellarNovaRadius = P.STELLAR_NOVA_BASE_RADIUS + (lv - 1) * P.STELLAR_NOVA_RADIUS_PER_LEVEL;
    }

    // Clamps
    stats.critChance = Math.min(0.95, stats.critChance);
    stats.projectileCount = clampOdd(stats.projectileCount);
    stats.maxShieldHp = Math.max(0, Math.floor(stats.maxShieldHp));
    stats.armor = Math.max(0, Math.floor(stats.armor));
    stats.magnetRange = Math.max(1, stats.magnetRange);
    stats.visionRange = Math.max(20, stats.visionRange);
    stats.targetingRange = Math.max(10, stats.targetingRange);
    stats.lootMultiplier = Math.max(1, stats.lootMultiplier);
    stats.isHoming = stats.projectileType === 'missile';
    stats.manualGunHeatPerShotMult = Math.max(0.12, Math.min(1, stats.manualGunHeatPerShotMult));
    stats.manualGunOverheatDurationMult = Math.max(0.18, Math.min(1, stats.manualGunOverheatDurationMult));
    stats.maxEnergy = Math.max(10, stats.maxEnergy);
    stats.energyRegen = Math.max(0, stats.energyRegen);
    stats.energyDrain = Math.max(0, stats.energyDrain);
    if (stats.hasVampire && stats.vampireHealRatio <= 0) stats.vampireHealRatio = 0.02;

    for (const type of ENEMY_TYPES) {
      const m = stats.enemyModifiers[type];
      for (const k of Object.keys(m)) m[k] = Math.max(0.1, Math.min(10, m[k]));
    }

    if (stats.momentumEngineActive) {
      stats.stellarDustRate *= stats.speed / PLAYER.BASE_SPEED;
    }

    stats.weaponSlotByFireType = getWeaponSlotAssignments(this.state);

    return stats;
  }

  _applyEffect(stats, effect, level) {
    const target = effect.target || 'player';
    const { type, stat, value } = effect;

    // New grammar: direct component manipulation
    if (type === 'add_component' || type === 'remove_component' || type === 'modify_component') {
      stats.__pendingComponentOps.push({ op: type, component: effect.component, params: effect.params || {}, level });
      return;
    }

    const scaled = this._calcScaled(effect, level);

    if (target === 'player') {
      switch (type) {
        case 'multiply': if (stats[stat] !== undefined) stats[stat] *= scaled; break;
        case 'add':      if (stats[stat] !== undefined) stats[stat] += scaled; break;
        case 'add_flat': if (stats[stat] !== undefined) stats[stat] += value; break;
        case 'set':      stats[stat] = value; break;
        case 'add_weapon':
          if (!stats.extraWeapons.includes(value)) stats.extraWeapons.push(value);
          break;
        case 'special': stats[stat] = value; break;
        case 'min':
          if (stats[stat] !== undefined) stats[stat] = Math.max(stats[stat], value);
          break;
        case 'max':
          if (stats[stat] !== undefined) stats[stat] = Math.min(stats[stat], value);
          break;
        case 'toggle':
          if (stats[stat] !== undefined) stats[stat] = !stats[stat];
          break;
        case 'append':
          if (Array.isArray(stats[stat]) && !stats[stat].includes(value)) stats[stat].push(value);
          break;
      }
      return;
    }

    if (target === 'enemy') {
      const dot = stat.indexOf('.');
      if (dot < 0) return;
      const typeKey = stat.slice(0, dot);
      const fieldKey = stat.slice(dot + 1);
      const applyToType = (tk) => {
        const m = stats.enemyModifiers[tk];
        if (!m || m[fieldKey] === undefined) return;
        if (type === 'multiply') m[fieldKey] *= scaled;
        else if (type === 'add') m[fieldKey] += scaled;
        else if (type === 'add_flat') m[fieldKey] += value;
        else if (type === 'set') m[fieldKey] = value;
      };
      if (typeKey === 'all') for (const tk of ENEMY_TYPES) applyToType(tk);
      else applyToType(typeKey);
      return;
    }

    if (target === 'currency') {
      const dot = stat.indexOf('.');
      if (dot < 0) return;
      const mode = stat.slice(0, dot);
      const k = stat.slice(dot + 1);
      if (mode === 'loot' && stats.lootRates[k] !== undefined) {
        if (type === 'multiply') stats.lootRates[k] *= scaled;
        else if (type === 'add') stats.lootRates[k] += scaled;
        else if (type === 'set') stats.lootRates[k] = value;
      } else if (mode === 'passive') {
        if (!stats.passiveRates[k]) stats.passiveRates[k] = 0;
        if (type === 'add') stats.passiveRates[k] += scaled;
        else if (type === 'multiply') stats.passiveRates[k] *= scaled;
        else if (type === 'set') stats.passiveRates[k] = value;
      }
      return;
    }

    if (target === 'round') {
      if (stats.roundModifiers[stat] !== undefined) {
        if (type === 'multiply') stats.roundModifiers[stat] *= scaled;
        else if (type === 'add') stats.roundModifiers[stat] += scaled;
        else if (type === 'set') stats.roundModifiers[stat] = value;
      }
    }
  }

  _calcScaled(effect, level) {
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

  _evalCondition(condition, stats, unlockedIds) {
    if (!condition) return true;
    switch (condition.type) {
      case 'stat_gte': return (stats[condition.stat] ?? 0) >= condition.threshold;
      case 'stat_lte': return (stats[condition.stat] ?? 0) <= condition.threshold;
      case 'round_gte': return this.state.round.current >= condition.threshold;
      case 'round_lte': return this.state.round.current <= condition.threshold;
      case 'phase_is': return this.state.round.phase === condition.value;
      case 'node_owned': return unlockedIds.has(condition.nodeId);
      default: return true;
    }
  }

  // ---------- sync helpers ----------

  _syncPlayerStats(stats) {
    const p = this.playerEntity;
    const psc = p.get('PlayerStatsComponent');
    if (psc) {
      psc.damage = stats.damage;
      psc.attackSpeed = stats.attackSpeed;
      psc.projectileCount = stats.projectileCount;
      psc.projectileSpeed = stats.projectileSpeed;
      psc.critChance = stats.critChance;
      psc.critMultiplier = stats.critMultiplier;
      psc.speed = stats.speed;
      psc.magnetRange = stats.magnetRange;
      psc.visionRange = stats.visionRange;
      psc.targetingRange = stats.targetingRange;
      psc.lootMultiplier = stats.lootMultiplier;
      psc.stellarDustRate = stats.stellarDustRate;
      psc.projectileType = stats.projectileType;
      psc.isHoming = stats.isHoming;
      psc.projectilePierces = stats.projectilePierces;
      psc.vampireHealRatio = stats.vampireHealRatio;
      psc.damageReflect = stats.damageReflect;
      psc.lootRates = stats.lootRates;
      psc.passiveRates = stats.passiveRates;
      psc.enemyModifiers = stats.enemyModifiers;
      psc.roundModifiers = stats.roundModifiers;
      psc.projectileVisuals = stats.projectileVisuals;
      psc.visualModifiers = stats.visualModifiers;
      psc.attachments = stats.attachments;
      psc.manualTargetFocusEnabled = stats.manualTargetFocusEnabled;
      psc.weaponSlotByFireType = stats.weaponSlotByFireType;
    }

    const health = p.get('HealthComponent');
    if (health) health.setMaxHp(stats.maxHp, false);
    if (health) health.armor = stats.armor;
    if (health) health.damageReceivedMult = 1;

    let shield = p.get('ShieldComponent');
    if (shield) {
      shield.setMaxHp(stats.maxShieldHp);
      shield.regen = stats.shieldRegen;
    }

    let regen = p.get('RegenComponent');
    if (regen) regen.rate = stats.hpRegen;

    let energy = p.get('EnergyComponent');
    if (energy) {
      energy.setMax(stats.maxEnergy);
      energy.regen = stats.energyRegen;
      energy.drain = stats.energyDrain;
    }

    const visuals = p.get('ShipVisualsComponent');
    if (visuals) {
      visuals.syncVisualModifiers(stats.visualModifiers);
      visuals.syncAttachments(stats.attachments);
      visuals.resyncWeaponTurretParents();
    }
  }

  _syncDependentComponents(stats) {
    const p = this.playerEntity;

    // Weapons: AutoFire primary
    this._toggleComponent(p, AutoFireWeaponComponent, stats.hasAutoFire);

    // Extra weapons
    const extras = new Set(stats.extraWeapons);
    this._toggleComponent(p, LaserTurretComponent, extras.has('laser'));
    this._toggleComponent(p, MissileTurretComponent, extras.has('missile'));
    this._toggleComponent(p, PlasmaTurretComponent, extras.has('plasma'));
    this._toggleComponent(p, BeamLaserComponent, extras.has('beam'));

    // Manual vs Railgun (mutually exclusive — railgun replaces manual gun)
    this._toggleComponent(p, ManualGunComponent, !stats.manualGunSwapped && !stats.railgunActive,
      () => ({ heatPerShotMult: stats.manualGunHeatPerShotMult, overheatDurationMult: stats.manualGunOverheatDurationMult }),
      (comp) => {
        comp.heatPerShotMult = stats.manualGunHeatPerShotMult;
        comp.overheatDurationMult = stats.manualGunOverheatDurationMult;
      });
    this._toggleComponent(p, RailgunComponent, stats.railgunActive,
      () => ({ chargeTime: stats.railgunChargeTime, damageMultiplier: stats.railgunDamage, energyCost: stats.railgunEnergyCost }),
      (comp) => {
        comp.chargeTime = stats.railgunChargeTime;
        comp.damageMultiplier = stats.railgunDamage;
        comp.energyCost = stats.railgunEnergyCost;
      });

    this._toggleComponent(p, MiningLaserComponent, stats.miningLaserActive,
      () => ({ count: stats.miningLaserCount, yieldMultiplier: stats.miningYield }),
      (comp) => { comp.count = stats.miningLaserCount; comp.yieldMultiplier = stats.miningYield; });

    this._toggleComponent(p, SalvagingBeamComponent, stats.salvagingBeamActive,
      () => ({ count: stats.salvagingBeamCount, healRatio: stats.salvagingBeamHealRatio }),
      (comp) => { comp.count = stats.salvagingBeamCount; comp.healRatio = stats.salvagingBeamHealRatio; });

    // AoE
    this._toggleComponent(p, StellarNovaComponent, stats.stellarNovaLevel > 0,
      () => ({ interval: stats.stellarNovaInterval, radius: stats.stellarNovaRadius, damage: stats.stellarNovaDamage, level: stats.stellarNovaLevel }),
      (comp) => {
        comp.interval = stats.stellarNovaInterval;
        comp.radius = stats.stellarNovaRadius;
        comp.damage = stats.stellarNovaDamage;
        comp.level = stats.stellarNovaLevel;
      });
    this._toggleComponent(p, CorrosiveAuraComponent, stats.corrosiveAuraDps > 0,
      () => ({ dps: stats.corrosiveAuraDps, radius: stats.magnetRange }),
      (comp) => { comp.dps = stats.corrosiveAuraDps; comp.radius = stats.magnetRange; });
    this._toggleComponent(p, GravityWellComponent, stats.gravityWellActive,
      () => ({ radius: stats.magnetRange, slowMult: 0.45 }),
      (comp) => { comp.radius = stats.magnetRange; });
    this._toggleComponent(p, RepulserComponent, stats.repulserActive,
      () => ({ interval: stats.repulserInterval, radius: stats.repulserRadius, damage: stats.repulserDamage }),
      (comp) => { comp.interval = stats.repulserInterval; comp.radius = stats.repulserRadius; comp.damage = stats.repulserDamage; });
    this._toggleComponent(p, ResonanceFieldComponent, stats.resonanceFieldLevel > 0,
      () => ({ level: stats.resonanceFieldLevel }),
      (comp) => { comp.level = stats.resonanceFieldLevel; });

    // Phoenix Drive
    this._toggleComponent(p, PhoenixDriveComponent, stats.phoenixDriveActive,
      () => ({ cooldown: stats.phoenixDriveCooldown, corona: stats.phoenixDriveCorona }),
      (comp) => { comp.cooldown = stats.phoenixDriveCooldown; comp.corona = stats.phoenixDriveCorona; });

    // Abilities
    this._toggleComponent(p, SpeedBoostComponent, stats.speedBoosterUnlocked,
      () => ({ cooldown: stats.speedBoostCooldown, duration: stats.speedBoostDuration, multiplier: stats.speedBoostMult }),
      (comp) => {
        comp.cooldown = stats.speedBoostCooldown;
        comp.duration = stats.speedBoostDuration;
        comp.multiplier = stats.speedBoostMult;
      });
    this._toggleComponent(p, EmpAbilityComponent, stats.empUnlocked,
      () => ({ cooldown: stats.empCooldown, duration: stats.empDuration, damage: stats.empDamage }),
      (comp) => { comp.cooldown = stats.empCooldown; comp.duration = stats.empDuration; comp.damage = stats.empDamage; });
    this._toggleComponent(p, WarpDriveComponent, stats.warpDriveUnlocked,
      () => ({ cooldown: stats.warpDriveCooldown, distance: stats.warpDistance }),
      (comp) => { comp.cooldown = stats.warpDriveCooldown; comp.distance = stats.warpDistance; });
    this._toggleComponent(p, GravityBombComponent, stats.gravityBombUnlocked,
      () => ({ cooldown: stats.gravityBombCooldown, radius: stats.gravityBombRadius, damage: stats.gravityBombDamage, duration: stats.gravityBombDuration }),
      (comp) => {
        comp.cooldown = stats.gravityBombCooldown;
        comp.radius = stats.gravityBombRadius;
        comp.damage = stats.gravityBombDamage;
        comp.duration = stats.gravityBombDuration;
      });
    this._toggleComponent(p, DecoyAbilityComponent, stats.decoyUnlocked,
      () => ({ count: stats.decoyCount, duration: stats.decoyDuration, energyCost: stats.decoyEnergyCost }),
      (comp) => { comp.count = stats.decoyCount; comp.duration = stats.decoyDuration; comp.energyCost = stats.decoyEnergyCost; });

    // Process pending component ops (new grammar)
    for (const op of stats.__pendingComponentOps) {
      this._applyComponentOp(op);
    }
  }

  _toggleComponent(entity, Cls, wantedOn, initParams = null, syncer = null) {
    const name = Cls.componentName || Cls.name;
    const existing = entity.get(name);
    if (wantedOn) {
      if (!existing) {
        const params = initParams ? initParams() : undefined;
        entity.add(new Cls(params));
      } else if (syncer) {
        syncer(existing);
      }
    } else if (existing) {
      entity.remove(name);
    }
  }

  _applyComponentOp(_op) {
    // Hook for future upgrades.json entries that declare component ops directly.
    // Once migrated, look up the class by name and call add/remove/modify.
  }

  _unregisterTriggers() {
    for (const u of this._triggerUnsubscribers) u();
    this._triggerUnsubscribers = [];
  }

  _registerTriggers(unlockedNodes, stats) {
    for (const node of unlockedNodes) {
      if (!node.triggers?.length) continue;
      const level = node.currentLevel;
      for (let i = 0; i < node.triggers.length; i++) {
        const trigger = node.triggers[i];
        const key = `${node.id}:${i}`;
        const handler = (data) => {
          // Re-entrance guard. Without this, an action that emits damage on
          // enemy:damaged (for example a chain-damage upgrade with no
          // cooldown) would recurse infinitely: takeDamage -> ENEMY_DAMAGED
          // -> trigger -> takeDamage -> ... until the stack blows.
          if (handler._firing) return;
          if (trigger.cooldown > 0) {
            const rem = this._triggerCooldowns.get(key) || 0;
            if (rem > 0) return;
            this._triggerCooldowns.set(key, trigger.cooldown);
          }
          if (trigger.chance !== undefined) {
            const chance = (typeof trigger.chance === 'object')
              ? Math.min(1, trigger.chance.base + trigger.chance.perLevel * (level - 1))
              : trigger.chance;
            if (Math.random() > chance) return;
          }
          if (trigger.condition) {
            if (trigger.condition.type === 'stat_gte' && trigger.condition.stat === 'isCrit') {
              if (!data?.isCrit) return;
            } else {
              const uids = this.state._unlockedTemplates || new Set();
              if (!this._evalCondition(trigger.condition, stats, uids)) return;
            }
          }
          handler._firing = true;
          try {
            this._executeTriggerAction(trigger.action, level, stats, data);
          } finally {
            handler._firing = false;
          }
        };
        this._triggerUnsubscribers.push(eventBus.on(trigger.event, handler));
      }
    }
  }

  _executeTriggerAction(action, level, stats, data) {
    if (!action) return;
    const value = (typeof action.value === 'object' && action.value !== null)
      ? action.value.base + action.value.perLevel * (level - 1)
      : (action.value || 0);

    switch (action.type) {
      case 'heal_player':
        eventBus.emit(EVENTS.PLAYER_HEALED, { amount: Math.max(1, Math.ceil(value)) });
        break;
      case 'boost_stat': {
        const psc = this.playerEntity.get('PlayerStatsComponent');
        if (psc) psc.activeBoosts.push({ stat: action.stat, multiplier: value, remaining: action.duration || 3 });
        break;
      }
      case 'emit_damage': {
        const pos = data?.entity?.get?.('TransformComponent')?.position
          ?? this.playerEntity.get('TransformComponent')?.position;
        if (!pos) break;
        const radius = action.radius || 3;
        const damage = Math.ceil(value);
        const enemies = this.world.query('enemy');
        for (const e of enemies) {
          if (!e.active) continue;
          const et = e.get('TransformComponent'); if (!et) continue;
          if (et.position.distanceTo(pos) <= radius) {
            e.get('HealthComponent')?.takeDamage(damage);
          }
        }
        break;
      }
      case 'apply_status': {
        const enemy = data?.entity;
        if (!enemy?.active) break;
        const dps = (typeof action.dps === 'object')
          ? action.dps.base + action.dps.perLevel * (level - 1)
          : (action.dps || 0);
        const slowMult = (typeof action.slowMult === 'object')
          ? action.slowMult.base + action.slowMult.perLevel * (level - 1)
          : (action.slowMult ?? 1);
        enemy.get('StatusEffectsComponent')?.apply(action.statusType, { dps, mult: slowMult, duration: action.duration || 3 });
        break;
      }
      case 'add_currency':
        eventBus.emit(EVENTS.LOOT_COLLECTED, { currencyType: action.currency || 'scrapMetal', amount: Math.ceil(value) });
        break;
    }
  }
}
