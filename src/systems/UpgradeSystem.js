import { PLAYER } from '../constants.js';

function applyStellarNovaFromTree(computed, unlocked) {
  for (const node of unlocked) {
    if (node.templateId !== 'stellar_burst') continue;
    const lv = node.currentLevel;
    if (lv <= 0) return;
    const P = PLAYER;
    computed.stellarNovaLevel = lv;
    computed.stellarNovaInterval = Math.max(
      P.STELLAR_NOVA_MIN_INTERVAL,
      P.STELLAR_NOVA_BASE_INTERVAL - (lv - 1) * P.STELLAR_NOVA_INTERVAL_PER_LEVEL
    );
    computed.stellarNovaDamage =
      P.STELLAR_NOVA_BASE_DAMAGE + (lv - 1) * P.STELLAR_NOVA_DAMAGE_PER_LEVEL;
    computed.stellarNovaRadius =
      P.STELLAR_NOVA_BASE_RADIUS + (lv - 1) * P.STELLAR_NOVA_RADIUS_PER_LEVEL;
    return;
  }
}
import { eventBus, EVENTS } from '../core/EventBus.js';

const ENEMY_TYPES = ['all', 'scout', 'tank', 'swarm', 'sniper', 'boss'];

/** Odd count so multi-shot spread keeps a center projectile aimed at the target (see CombatSystem). */
function clampProjectileCountOdd(n) {
  let x = Math.max(1, Math.floor(n));
  if (x % 2 === 0) x += 1;
  return x;
}

function makeEnemyModifiers() {
  const mods = {};
  for (const type of ENEMY_TYPES) {
    mods[type] = { hpMult: 1, damageMult: 1, speedMult: 1, damageReceivedMult: 1 };
  }
  return mods;
}

// Rebuild computedStats from base stats + tech tree
export class UpgradeSystem {
  constructor() {
    this._triggerUnsubscribers = [];
    this._triggerCooldowns = new Map(); // "nodeId:idx" -> remaining seconds
    this._state = null;
    this._computed = null;
  }

  compute(state, techTreeState) {
    this._state = state;
    const base = state.player;

    const computed = {
      // Player combat stats
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
      extraWeapons: [],
      hasDrone: base.hasDrone,
      hasVampire: base.hasVampire,
      hasDamageReflect: base.hasDamageReflect,
      hasOvercharge: base.hasOvercharge,
      isHoming: base.projectileType === 'missile',
      passiveRates: {},

      // New grammar outputs
      activeBoosts: [],  // [{ stat, multiplier, remaining }]
      enemyModifiers: makeEnemyModifiers(),
      roundModifiers: { spawnInterval: 1.0, maxConcurrent: 1.0 },
      lootRates: { scrapMetal: 1, plasmaCrystals: 1, bioEssence: 1, darkMatter: 1, stellarDust: 1 },

      // Visual grammar outputs
      visualModifiers: [],
      attachments: [],
      projectileVisuals: new Map(), // type -> ProjectileVisual spec

      stellarNovaLevel: 0,
      stellarNovaInterval: 0,
      stellarNovaDamage: 0,
      stellarNovaRadius: 0,
    };

    if (!techTreeState) {
      computed.projectileCount = clampProjectileCountOdd(computed.projectileCount);
      return computed;
    }

    const nodes = techTreeState.getVisibleNodes();
    const unlocked = nodes.filter(n => n.isUnlocked);

    // --- Pass 1: base effects (skip conditional effects) ---
    for (const node of unlocked) {
      for (const effect of node.effects) {
        if (effect.condition) continue;
        this._applyEffect(computed, effect, node.currentLevel);
      }
      // Collect visual declarations
      if (node.visual?.modifiers?.length) computed.visualModifiers.push(...node.visual.modifiers);
      if (node.visual?.attachments?.length) computed.attachments.push(...node.visual.attachments);
      if (node.visual?.projectile) {
        const pv = node.visual.projectile;
        computed.projectileVisuals.set(pv.type || 'all', pv);
      }
    }

    // --- Pass 2: synergy resolution ---
    const unlockedTemplateIds = new Set(unlocked.map(n => n.templateId || n.id));
    state._unlockedTemplates = unlockedTemplateIds;

    for (const node of unlocked) {
      if (!node.synergies?.length) continue;
      for (const synergy of node.synergies) {
        if (synergy.requires?.every(tid => unlockedTemplateIds.has(tid))) {
          for (const effect of (synergy.effects || [])) {
            this._applyEffect(computed, effect, 1);
          }
        }
      }
    }

    // --- Pass 3: conditional effects (evaluated against post-pass-1 computed) ---
    for (const node of unlocked) {
      for (const effect of node.effects) {
        if (!effect.condition) continue;
        if (this._evalCondition(effect.condition, computed, state, unlockedTemplateIds)) {
          this._applyEffect(computed, effect, node.currentLevel);
        }
      }
    }

    // --- Post-clamp ---
    computed.critChance = Math.min(0.95, computed.critChance);
    computed.projectileCount = clampProjectileCountOdd(computed.projectileCount);
    computed.maxShieldHp = Math.max(0, Math.floor(computed.maxShieldHp));
    computed.armor = Math.max(0, Math.floor(computed.armor));
    computed.magnetRange = Math.max(1, computed.magnetRange);
    computed.lootMultiplier = Math.max(1, computed.lootMultiplier);
    computed.isHoming = computed.projectileType === 'missile';

    // Clamp enemy modifier multipliers
    for (const type of ENEMY_TYPES) {
      const m = computed.enemyModifiers[type];
      for (const k of Object.keys(m)) {
        m[k] = Math.max(0.1, Math.min(10, m[k]));
      }
    }

    applyStellarNovaFromTree(computed, unlocked);

    // --- Register triggers ---
    this._unregisterTriggers();
    this._registerTriggers(unlocked, computed);
    this._computed = computed;

    return computed;
  }

  _applyEffect(computed, effect, level) {
    const target = effect.target || 'player';
    const { type, stat, value } = effect;
    const scaledValue = this._calcScaledValue(effect, level);

    if (target === 'player') {
      switch (type) {
        case 'multiply':
          if (computed[stat] !== undefined) computed[stat] *= scaledValue;
          break;
        case 'add':
          if (computed[stat] !== undefined) computed[stat] += scaledValue;
          break;
        case 'add_flat':
          if (computed[stat] !== undefined) computed[stat] += value;
          break;
        case 'set':
          computed[stat] = value;
          break;
        case 'add_weapon':
          if (!computed.extraWeapons.includes(value)) computed.extraWeapons.push(value);
          break;
        case 'special':
          computed[stat] = value;
          break;
        case 'min':
          if (computed[stat] !== undefined) computed[stat] = Math.max(computed[stat], value);
          break;
        case 'max':
          if (computed[stat] !== undefined) computed[stat] = Math.min(computed[stat], value);
          break;
        case 'toggle':
          if (computed[stat] !== undefined) computed[stat] = !computed[stat];
          break;
        case 'append':
          if (Array.isArray(computed[stat]) && !computed[stat].includes(value)) {
            computed[stat].push(value);
          }
          break;
      }
      return;
    }

    if (target === 'enemy') {
      // stat format: 'typeKey.fieldKey' e.g. 'all.hpMult', 'scout.damageReceivedMult'
      const dot = stat.indexOf('.');
      if (dot < 0) return;
      const typeKey = stat.slice(0, dot);
      const fieldKey = stat.slice(dot + 1);

      const applyToType = (tk) => {
        const m = computed.enemyModifiers[tk];
        if (!m || m[fieldKey] === undefined) return;
        if (type === 'multiply') m[fieldKey] *= scaledValue;
        else if (type === 'add') m[fieldKey] += scaledValue;
        else if (type === 'add_flat') m[fieldKey] += value;
        else if (type === 'set') m[fieldKey] = value;
      };

      if (typeKey === 'all') {
        for (const tk of ENEMY_TYPES) applyToType(tk);
      } else {
        applyToType(typeKey);
      }
      return;
    }

    if (target === 'currency') {
      // stat format: 'loot.currencyName' or 'passive.currencyName'
      const dot = stat.indexOf('.');
      if (dot < 0) return;
      const mode = stat.slice(0, dot);
      const currKey = stat.slice(dot + 1);

      if (mode === 'loot' && computed.lootRates[currKey] !== undefined) {
        if (type === 'multiply') computed.lootRates[currKey] *= scaledValue;
        else if (type === 'add') computed.lootRates[currKey] += scaledValue;
        else if (type === 'set') computed.lootRates[currKey] = value;
      } else if (mode === 'passive') {
        if (!computed.passiveRates[currKey]) computed.passiveRates[currKey] = 0;
        if (type === 'add') computed.passiveRates[currKey] += scaledValue;
        else if (type === 'multiply') computed.passiveRates[currKey] *= scaledValue;
        else if (type === 'set') computed.passiveRates[currKey] = value;
      }
      return;
    }

    if (target === 'round') {
      // stat: 'spawnInterval' or 'maxConcurrent'
      if (computed.roundModifiers[stat] !== undefined) {
        if (type === 'multiply') computed.roundModifiers[stat] *= scaledValue;
        else if (type === 'add') computed.roundModifiers[stat] += scaledValue;
        else if (type === 'set') computed.roundModifiers[stat] = value;
      }
    }
  }

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

  _evalCondition(condition, computed, state, unlockedTemplateIds) {
    if (!condition) return true;
    switch (condition.type) {
      case 'stat_gte': return (computed[condition.stat] ?? 0) >= condition.threshold;
      case 'stat_lte': return (computed[condition.stat] ?? 0) <= condition.threshold;
      case 'round_gte': return state.round.current >= condition.threshold;
      case 'round_lte': return state.round.current <= condition.threshold;
      case 'phase_is': return state.round.phase === condition.value;
      case 'node_owned': return unlockedTemplateIds.has(condition.nodeId);
      case 'level_gte': return true; // node-level condition, evaluated at registration time
      default: return true;
    }
  }

  _unregisterTriggers() {
    for (const unsub of this._triggerUnsubscribers) unsub();
    this._triggerUnsubscribers = [];
  }

  _registerTriggers(unlockedNodes, computed) {
    for (const node of unlockedNodes) {
      if (!node.triggers?.length) continue;
      const level = node.currentLevel;

      for (let i = 0; i < node.triggers.length; i++) {
        const trigger = node.triggers[i];
        const cooldownKey = `${node.id}:${i}`;
        const eventKey = trigger.event; // event strings match EVENTS values directly

        const handler = (eventData) => {
          // Cooldown check
          if (trigger.cooldown > 0) {
            const rem = this._triggerCooldowns.get(cooldownKey) || 0;
            if (rem > 0) return;
            this._triggerCooldowns.set(cooldownKey, trigger.cooldown);
          }
          // Chance check
          if (trigger.chance !== undefined && Math.random() > trigger.chance) return;
          // Condition check
          if (trigger.condition) {
            // Special: isCrit comes from eventData
            if (trigger.condition.type === 'stat_gte' && trigger.condition.stat === 'isCrit') {
              if (!eventData?.isCrit) return;
            } else {
              const uids = this._state?._unlockedTemplates || new Set();
              if (!this._evalCondition(trigger.condition, computed, this._state, uids)) return;
            }
          }
          this._executeTriggerAction(trigger.action, level, computed, eventData);
        };

        const unsub = eventBus.on(eventKey, handler);
        this._triggerUnsubscribers.push(unsub);
      }
    }
  }

  _executeTriggerAction(action, level, computed, eventData) {
    if (!action || !this._state) return;
    const value = (typeof action.value === 'object' && action.value !== null)
      ? action.value.base + action.value.perLevel * (level - 1)
      : (action.value || 0);

    switch (action.type) {
      case 'heal_player': {
        const heal = Math.max(1, Math.ceil(value));
        const p = this._state.player;
        p.hp = Math.min(computed.maxHp, p.hp + heal);
        eventBus.emit(EVENTS.PLAYER_HEALED, { amount: heal });
        break;
      }
      case 'boost_stat': {
        computed.activeBoosts.push({
          stat: action.stat,
          multiplier: value,
          remaining: action.duration || 3.0,
        });
        break;
      }
      case 'emit_damage': {
        const pos = eventData?.enemy?.group?.position;
        if (pos) {
          eventBus.emit('trigger:emit_damage', {
            position: pos.clone(),
            amount: Math.ceil(value),
            radius: action.radius || 3,
          });
        }
        break;
      }
      case 'add_currency': {
        const currency = action.currency || 'scrapMetal';
        eventBus.emit(EVENTS.LOOT_COLLECTED, { currencyType: currency, amount: Math.ceil(value) });
        break;
      }
    }
  }

  // Tick down trigger cooldowns and drain expired activeBoosts — call each frame
  tickTriggers(delta) {
    for (const [key, rem] of this._triggerCooldowns) {
      if (rem > 0) this._triggerCooldowns.set(key, rem - delta);
    }
    if (this._computed?.activeBoosts) {
      const boosts = this._computed.activeBoosts;
      for (let i = boosts.length - 1; i >= 0; i--) {
        boosts[i].remaining -= delta;
        if (boosts[i].remaining <= 0) boosts.splice(i, 1);
      }
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
