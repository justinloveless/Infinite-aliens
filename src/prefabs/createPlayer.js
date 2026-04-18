import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { ShieldComponent } from '../components/health/ShieldComponent.js';
import { RegenComponent } from '../components/health/RegenComponent.js';
import { PlayerInputComponent } from '../components/player/PlayerInputComponent.js';
import { PlayerStatsComponent } from '../components/player/PlayerStatsComponent.js';
import { EnergyComponent } from '../components/player/EnergyComponent.js';
import { ShipVisualsComponent } from '../components/player/ShipVisualsComponent.js';
import { PlayerDamageHandlerComponent } from '../components/player/PlayerDamageHandlerComponent.js';
import { PLAYER, ENERGY } from '../constants.js';

export function createPlayer({ settings = null } = {}) {
  const entity = new Entity(['player']);
  entity.add(new TransformComponent({ position: new THREE.Vector3(0, 0, 0) }));
  entity.add(new HealthComponent({ hp: PLAYER.BASE_HP, maxHp: PLAYER.BASE_HP, armor: 0, flashOnHit: false }));
  entity.add(new ShieldComponent({ maxHp: 0, hp: 0, regen: 0 }));
  entity.add(new RegenComponent({ rate: 0 }));
  entity.add(new PlayerStatsComponent({}));
  entity.add(new EnergyComponent({ max: ENERGY.BASE_MAX, regen: ENERGY.BASE_REGEN }));
  entity.add(new ColliderComponent({ radius: PLAYER.COLLISION_RADIUS, layer: 'player', mask: [] }));
  entity.add(new ShipVisualsComponent());
  entity.add(new PlayerInputComponent({ settings }));
  entity.add(new PlayerDamageHandlerComponent());
  return entity;
}
