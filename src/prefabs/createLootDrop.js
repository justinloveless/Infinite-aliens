import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { LootDropComponent } from '../components/world/LootDropComponent.js';

export function createLootDrop(position, currencyType, amount) {
  const entity = new Entity(['loot']);
  const pos = position.clone ? position.clone() : new THREE.Vector3().copy(position);
  pos.y += 0.5;
  entity.add(new TransformComponent({ position: pos }));
  entity.add(new ColliderComponent({ radius: 0.5, layer: 'loot', mask: ['player'] }));
  entity.add(new LootDropComponent({ currencyType, amount }));
  return entity;
}
