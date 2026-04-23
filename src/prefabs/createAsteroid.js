import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { AsteroidComponent, ASTEROID_SIZES } from '../components/world/AsteroidComponent.js';

export function createAsteroid(size = 'large', position = null, velocity = null) {
  const cfg = ASTEROID_SIZES[size];
  const entity = new Entity(['asteroid']);
  entity.add(new TransformComponent());
  entity.add(new HealthComponent({ hp: cfg.hp, maxHp: cfg.hp, flashOnHit: false }));
  entity.add(new ColliderComponent({ radius: cfg.radius, layer: 'asteroid', mask: ['playerProjectile', 'player', 'enemy'] }));
  entity.add(new AsteroidComponent({ size, position, velocity }));
  return entity;
}
