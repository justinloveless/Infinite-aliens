import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ExplosionComponent } from '../components/world/ExplosionComponent.js';

export function createExplosion(position, { color = 0xff6600, scale = 1 } = {}) {
  const entity = new Entity(['effect']);
  entity.add(new TransformComponent({ position: position.clone() }));
  entity.add(new ExplosionComponent({ color, scale }));
  return entity;
}
