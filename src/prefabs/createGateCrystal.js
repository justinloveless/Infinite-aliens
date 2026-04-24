import * as THREE from 'three';
import { Entity } from '../ecs/Entity.js';
import { TransformComponent } from '../components/core/TransformComponent.js';
import { HealthComponent } from '../components/health/HealthComponent.js';
import { ColliderComponent } from '../components/core/ColliderComponent.js';
import { GateCrystalComponent } from '../components/arena/GateCrystalComponent.js';
import { BOSS_ARENA } from '../constants.js';

/**
 * Gate crystal entity: tagged `enemy` so beams, turrets, railgun hitscan, AoE,
 * and mining lasers treat it like other combat targets. Also tagged
 * `gate_crystal` so kill handlers (e.g. SpawnDirector) defer lifecycle to
 * GateCrystalComponent (GATE_CRYSTAL_DESTROYED, VFX).
 *
 * Collider layer is `enemy` so player projectiles (mask ['enemy','asteroid'])
 * hit it naturally.
 *
 * @param {{
 *   gateId: string|number,
 *   gatePosition: THREE.Vector3,
 *   orbitAngle: number,
 *   orbitRadius?: number,
 *   tier?: number,
 * }} opts
 */
export function createGateCrystal(opts) {
  const {
    gateId,
    gatePosition,
    orbitAngle,
    orbitRadius = BOSS_ARENA.GATE_CRYSTAL_ORBIT_RADIUS,
    tier = 1,
  } = opts;

  const entity = new Entity(['enemy', 'gate_crystal', 'destructible']);

  // Keep crystals on the player's Y plane so projectiles (which fly at y=0)
  // reliably intersect them. Visual mesh lifts itself slightly for a clean
  // silhouette; the collider transform stays flat.
  const initialPos = new THREE.Vector3(
    gatePosition.x + Math.cos(orbitAngle) * orbitRadius,
    0,
    gatePosition.z + Math.sin(orbitAngle) * orbitRadius,
  );
  entity.add(new TransformComponent({ position: initialPos }));

  const hp = Math.max(
    1,
    Math.round(BOSS_ARENA.GATE_CRYSTAL_HP_BASE * Math.pow(BOSS_ARENA.GATE_CRYSTAL_HP_TIER_MULT, Math.max(0, tier - 1))),
  );
  entity.add(new HealthComponent({ hp, maxHp: hp, armor: 0, flashOnHit: false }));

  entity.add(new ColliderComponent({
    radius: BOSS_ARENA.GATE_CRYSTAL_COLLIDER_RADIUS,
    layer: 'enemy',
    mask: ['playerProjectile'],
  }));

  entity.add(new GateCrystalComponent({
    gateId,
    gatePosition,
    orbitAngle,
    orbitRadius,
    orbitSpeed: BOSS_ARENA.GATE_CRYSTAL_ORBIT_SPEED,
    y: 0,
  }));

  return entity;
}
