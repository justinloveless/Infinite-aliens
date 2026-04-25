import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { EnemyVisualsComponent } from '../components/enemy/EnemyVisualsComponent.js';
import { StatusEffectsComponent } from '../components/enemy/StatusEffectsComponent.js';
import { ContactDamageComponent } from '../components/enemy/ContactDamageComponent.js';
import { RangedAttackerComponent } from '../components/enemy/RangedAttackerComponent.js';
import { BossAttackerComponent } from '../components/enemy/BossAttackerComponent.js';
import { LootTableComponent } from '../components/enemy/LootTableComponent.js';
import { EnemySeparationComponent } from '../components/enemy/EnemySeparationComponent.js';
import { BEHAVIOR_COMPONENTS } from '../components/enemy/behaviors.js';
import { ENEMY_DEFS } from '../components/enemy/EnemyDefs.js';
import {
  ScatterAuraComponent,
  RegenJammerAuraComponent,
  DampenAuraComponent,
  WarpDisruptorAuraComponent,
  EnemyGravityPullComponent,
  CorroderContactComponent,
  CrystalLeechContactComponent,
  OverloaderContactComponent,
  EMPReflectorComponent,
  FlareLauncherComponent,
  ViralContactComponent,
  EclipserAuraComponent,
  AnchorMineDropperComponent,
  DenseCoreEnrageComponent,
} from '../components/enemy/CounterEnemyModules.js';
import { WreckAnimatorComponent } from '../components/enemy/WreckAnimatorComponent.js';

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
  const baseArmor = def.baseArmor ?? 0;
  const finalArmor = baseArmor > 0
    ? Math.max(0, Math.floor(baseArmor * (1 + (tier - 1) * 0.035)))
    : 0;

  const entity = new Entity(['enemy', `enemy_${def.type}`]);

  const x = (Math.random() - 0.5) * 32 + (spawnOffset?.x ?? 0);
  const z = -55 - Math.random() * 20 + (spawnOffset?.z ?? 0);
  entity.add(new TransformComponent({ position: new THREE.Vector3(x, 0, z) }));

  entity.add(new HealthComponent({
    hp: finalHp, maxHp: finalHp, armor: finalArmor,
    damageReceivedMult: drMult, flashOnHit: true,
  }));
  entity.add(new EnemyVisualsComponent({
    def,
    ghostMode: def.type === 'ghost_ship',
  }));
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

  const isBossShape = (def.behavior?.startsWith('boss')) || String(def.type).endsWith('_boss');
  const meleeSuicide = !isBossShape;
  if (def.attackPattern) {
    // Boss with distinct attack pattern — gets ranged boss attacker + melee contact
    entity.add(new BossAttackerComponent({
      attackSpeed: def.attackSpeed || 0.4,
      damage: finalDmg,
      pattern: def.attackPattern,
    }));
    entity.add(new ContactDamageComponent({ damage: finalDmg, meleeSuicide: false }));
  } else if ((def.attackSpeed || 0) > 0) {
    entity.add(new RangedAttackerComponent({
      attackSpeed: def.attackSpeed,
      damage: finalDmg,
      keepDist: def.keepRangeDist || 12,
      stripShieldsOnPlayerHit: !!def.stripPlayerShield,
    }));
  } else {
    entity.add(new ContactDamageComponent({
      damage: finalDmg,
      meleeSuicide,
      ignorePlayerArmor: def.type === 'titan',
    }));
  }

  entity.add(new LootTableComponent({ table: def.loot }));
  entity.add(new EnemySeparationComponent());
  entity.enemyType = def.type;
  entity.collisionRadius = def.collisionRadius;

  if (def.type === 'ghost_ship') entity.addTag('scanner_hidden');
  if (def.type === 'dense_core') entity.addTag('gravity_immune');
  if (def.type === 'target_analyzer') entity.addTag('decoy_immune');

  switch (def.type) {
    case 'scatter_drone':
      entity.add(new ScatterAuraComponent());
      break;
    case 'repair_jammer':
      entity.add(new RegenJammerAuraComponent());
      break;
    case 'dampener':
      entity.add(new DampenAuraComponent());
      break;
    case 'warp_disruptor':
      entity.add(new WarpDisruptorAuraComponent());
      break;
    case 'gravity_anchor':
      entity.add(new EnemyGravityPullComponent());
      break;
    case 'corroder':
      entity.add(new CorroderContactComponent());
      break;
    case 'crystal_leech':
      entity.add(new CrystalLeechContactComponent());
      break;
    case 'overloader':
      entity.add(new OverloaderContactComponent());
      break;
    case 'emp_reflector':
      entity.add(new EMPReflectorComponent());
      break;
    case 'flare_ship':
      entity.add(new FlareLauncherComponent());
      break;
    case 'viral_agent':
      entity.add(new ViralContactComponent());
      break;
    case 'eclipser':
      entity.add(new EclipserAuraComponent());
      break;
    case 'anchor_mine':
      entity.add(new AnchorMineDropperComponent());
      break;
    case 'dense_core':
      entity.add(new DenseCoreEnrageComponent());
      break;
    case 'wreck_animator':
      entity.add(new WreckAnimatorComponent());
      break;
    default:
      break;
  }

  return entity;
}
