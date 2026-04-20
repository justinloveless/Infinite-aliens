import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { PlayerWarpGateComponent } from '../components/arena/PlayerWarpGateComponent.js';

export function createPlayerWarpGate({ x = 0, z = 12 } = {}) {
  const position = new THREE.Vector3(x, 0, z);
  const entity = new Entity(['player_gate']);
  entity.add(new TransformComponent({ position }));
  entity.add(new PlayerWarpGateComponent({ position }));
  return entity;
}
