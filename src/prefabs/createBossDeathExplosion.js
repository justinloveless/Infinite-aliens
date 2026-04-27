import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { BossDeathExplosionComponent } from '../components/world/BossDeathExplosionComponent.js';

export function createBossDeathExplosion(position) {
  const entity = new Entity(['effect']);
  entity.add(new TransformComponent({ position: position.clone() }));
  entity.add(new BossDeathExplosionComponent());
  return entity;
}
