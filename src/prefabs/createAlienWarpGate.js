import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { AlienWarpGateComponent } from '../components/arena/AlienWarpGateComponent.js';

/**
 * Creates an alien warp gate entity at the given arena position.
 * @param {{ x: number, z: number }} pos
 */
export function createAlienWarpGate({ x, z }) {
  const position = new THREE.Vector3(x, 0, z);
  const entity = new Entity(['alien_gate']);
  entity.add(new TransformComponent({ position }));
  entity.add(new AlienWarpGateComponent({ position }));
  return entity;
}
