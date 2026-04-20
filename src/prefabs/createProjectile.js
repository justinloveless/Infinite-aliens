import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { BoundsComponent } from '../components/core/BoundsComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { ProjectileMotionComponent } from '../components/projectile/ProjectileMotionComponent.js';
import { ProjectileDamageComponent } from '../components/projectile/ProjectileDamageComponent.js';
import { ProjectileVisualComponent } from '../components/projectile/ProjectileVisualComponent.js';
import { HomingComponent } from '../components/projectile/HomingComponent.js';
import { BOSS_ARENA } from '../constants.js';

const TYPE_SPEEDS = {
  laser: 28, manual: 28, missile: 20, plasma: 22, enemy: 14,
};

/**
 * @param {{
 *   position: THREE.Vector3,
 *   direction: THREE.Vector3,
 *   type?: string,
 *   damage?: number,
 *   isCrit?: boolean,
 *   isPlayer?: boolean,
 *   target?: import('../ecs/Entity.js').Entity | null,
 *   visualOverride?: any,
 *   pierces?: number,
 *   heatRatio?: number,
 *   onKillHealAmount?: number,
 *   onKill?: (enemy, ctx) => void,
 * }} opts
 */
export function createProjectile(opts) {
  const {
    position, direction, type = 'laser',
    damage = 1, isCrit = false, isPlayer = true,
    target = null, visualOverride = null,
    pierces = 0, heatRatio = 0,
    onKillHealAmount = null, onKill = null,
  } = opts;

  const layer = isPlayer ? 'playerProjectile' : 'enemyProjectile';
  const mask = isPlayer ? ['enemy', 'asteroid'] : ['player'];

  const entity = new Entity([layer]);
  entity.add(new TransformComponent({ position }));
  entity.add(new ProjectileVisualComponent({ type, heatRatio, visualOverride }));
  entity.add(new ProjectileMotionComponent({
    direction,
    speed: TYPE_SPEEDS[type] ?? 22,
  }));
  entity.add(new ColliderComponent({ radius: 0.2, layer, mask }));
  entity.add(new ProjectileDamageComponent({
    damage, isCrit, isPlayerProjectile: isPlayer, pierces,
    onKillHealAmount, onKill,
  }));
  // Use arena bounds (with a small margin) so projectiles fired during the
  // boss arena don't despawn the frame after leaving the combat corridor.
  const xMax = Math.max(35, BOSS_ARENA.X_MAX + 20);
  const zFar = Math.max(90, -BOSS_ARENA.Z_MIN + 20);
  entity.add(new BoundsComponent({ xMax, yMax: 20, zMin: -zFar, zMax: zFar }));

  if (type === 'missile' && target) {
    entity.add(new HomingComponent({ target, turnRate: 4 }));
  }
  return entity;
}
