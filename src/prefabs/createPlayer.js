import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { ShieldComponent } from '../components/health/ShieldComponent.js';
import { RegenComponent } from '../components/health/RegenComponent.js';
import { PlayerInputComponent } from '../components/player/PlayerInputComponent.js';
import { ArenaTrailComponent } from '../components/player/ArenaTrailComponent.js';
import { PlayerCrosshairComponent } from '../components/player/PlayerCrosshairComponent.js';
import { PlayerStatsComponent } from '../components/player/PlayerStatsComponent.js';
import { EnergyComponent } from '../components/player/EnergyComponent.js';
import { ShipVisualsComponent } from '../components/player/ShipVisualsComponent.js';
import { PlayerDamageHandlerComponent } from '../components/player/PlayerDamageHandlerComponent.js';
import { createShipComponent } from '../components/ships/ShipRegistry.js';
import { getActiveShipId } from '../data/ships.js';
import { PLAYER, ENERGY } from '../constants.js';

export function createPlayer({ settings = null, state = null } = {}) {
  const entity = new Entity(['player']);
  entity.add(new TransformComponent({ position: new THREE.Vector3(0, 0, 0) }));
  // Initial HP/speed come from the currently-selected ship profile (via
  // state.player, which UpgradeApplier will promptly re-seed on first apply()).
  const p = state?.player;
  const baseHp = p?.maxHp ?? PLAYER.BASE_HP;
  const baseArmor = p?.armor ?? 0;
  const baseShield = p?.maxShieldHp ?? 0;
  const baseShieldRegen = p?.shieldRegen ?? 0;
  const baseHpRegen = p?.hpRegen ?? 0;
  entity.add(new HealthComponent({ hp: baseHp, maxHp: baseHp, armor: baseArmor, flashOnHit: false }));
  entity.add(new ShieldComponent({ maxHp: baseShield, hp: 0, regen: baseShieldRegen }));
  entity.add(new RegenComponent({ rate: baseHpRegen }));
  entity.add(new PlayerStatsComponent({}));
  entity.add(new EnergyComponent({ max: ENERGY.BASE_MAX, regen: ENERGY.BASE_REGEN }));
  entity.add(new ColliderComponent({ radius: PLAYER.COLLISION_RADIUS, layer: 'player', mask: [] }));
  // The ship component carries this variant's identity, stats, slot layout,
  // and hull-building logic. It must be attached BEFORE ShipVisualsComponent
  // so the visuals component can read the variant off the entity at attach
  // time instead of going back through global state.
  const shipComp = createShipComponent(getActiveShipId(state));
  if (shipComp) entity.add(shipComp);
  entity.add(new ShipVisualsComponent());
  entity.add(new PlayerInputComponent({ settings }));
  entity.add(new ArenaTrailComponent());
  entity.add(new PlayerCrosshairComponent({ settings }));
  entity.add(new PlayerDamageHandlerComponent());
  return entity;
}
