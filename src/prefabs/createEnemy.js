import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { EnemyVisualsComponent } from '../components/enemy/EnemyVisualsComponent.js';
import { StatusEffectsComponent } from '../components/enemy/StatusEffectsComponent.js';
import { ContactDamageComponent } from '../components/enemy/ContactDamageComponent.js';
import { RangedAttackerComponent } from '../components/enemy/RangedAttackerComponent.js';
import { LootTableComponent } from '../components/enemy/LootTableComponent.js';
import { BEHAVIOR_COMPONENTS } from '../components/enemy/behaviors.js';
import { ENEMY_DEFS } from '../components/enemy/EnemyDefs.js';

/**
 * Assemble an enemy entity at the given tier. Applies stat scaling and upgrade
 * modifiers, then composes the per-type behavior component.
 *
 * @param {string} typeName
 * @param {number} tier
 * @param {PlayerStatsComponent|null} playerStats - for enemyModifiers
 * @param {{x?: number, z?: number}} [spawnOffset] - additional offset from random spawn
 */
export function createEnemy(typeName, tier = 1, playerStats = null, spawnOffset = null) {
  const def = ENEMY_DEFS[typeName];
  if (!def) throw new Error(`Unknown enemy type: ${typeName}`);

  const hpScale = Math.pow(1.12, tier - 1);
  const dmgScale = Math.pow(1.05, tier - 1);
  const rawHp = Math.ceil(def.baseHp * hpScale);
  const rawDmg = Math.ceil(def.baseDamage * dmgScale);
  const rawSpd = def.baseSpeed * (1 + tier * 0.004);

  const mods = playerStats?.enemyModifiers || null;
  const allMod = mods?.all || {};
  const typeMod = mods?.[def.type] || {};
  const hpMult = (allMod.hpMult ?? 1) * (typeMod.hpMult ?? 1);
  const dmgMult = (allMod.damageMult ?? 1) * (typeMod.damageMult ?? 1);
  const spdMult = (allMod.speedMult ?? 1) * (typeMod.speedMult ?? 1);
  const drMult = (allMod.damageReceivedMult ?? 1) * (typeMod.damageReceivedMult ?? 1);

  const finalHp = Math.max(1, Math.ceil(rawHp * hpMult));
  const finalDmg = Math.max(1, Math.ceil(rawDmg * dmgMult));
  const finalSpd = rawSpd * spdMult;

  const entity = new Entity(['enemy', `enemy_${def.type}`]);

  const x = (Math.random() - 0.5) * 32 + (spawnOffset?.x ?? 0);
  const z = -55 - Math.random() * 20 + (spawnOffset?.z ?? 0);
  entity.add(new TransformComponent({ position: new THREE.Vector3(x, 0, z) }));

  entity.add(new HealthComponent({
    hp: finalHp, maxHp: finalHp, armor: 0,
    damageReceivedMult: drMult, flashOnHit: true,
  }));
  entity.add(new EnemyVisualsComponent({ def }));
  entity.add(new StatusEffectsComponent());
  entity.add(new ColliderComponent({
    radius: def.collisionRadius, layer: 'enemy',
    mask: [],
  }));

  const BehaviorCls = BEHAVIOR_COMPONENTS[def.behavior] || BEHAVIOR_COMPONENTS.charge;
  entity.add(new BehaviorCls({
    speed: finalSpd,
    keepDist: def.keepRangeDist,
  }));

  const meleeSuicide = def.type !== 'boss';
  if ((def.attackSpeed || 0) > 0) {
    entity.add(new RangedAttackerComponent({
      attackSpeed: def.attackSpeed,
      damage: finalDmg,
      keepDist: def.keepRangeDist || 12,
    }));
  } else {
    entity.add(new ContactDamageComponent({
      damage: finalDmg,
      meleeSuicide,
    }));
  }

  entity.add(new LootTableComponent({ table: def.loot }));
  entity.enemyType = def.type;
  entity.collisionRadius = def.collisionRadius;

  return entity;
}
