import * as THREE from 'three';
import { ShipComponent } from './ShipComponent.js';
import { addHangarLights } from '../../scene/ShipMeshHelpers.js';
import slotsData from '../../data/shipSlots/fighter.json';

/**
 * Stingray — light-and-fast fighter.
 * Narrow cone with swept delta wings, amber-red palette, crystal canopy,
 * four weapon hardpoints, no heavy armor core slot.
 */
export class FighterShipComponent extends ShipComponent {
  static id = 'fighter';
  static displayName = 'Stingray';
  static description = 'Light, fast, and fragile. Extra weapon hardpoints, no heavy armor sockets.';
  static meshVariant = 'fighter';
  static cost = { credits: 4500 };
  static baseStats = {
    BASE_HP: 65,
    BASE_DAMAGE: 8,
    BASE_ATTACK_SPEED: 1.1,
    BASE_SPEED: 4.5,
  };

  static get slots() { return slotsData.slots; }
  static get defaultUnlockedSlots() { return slotsData.defaultUnlockedSlots; }
  static get defaultLoadout() { return slotsData.defaultLoadout; }

  static buildHull({ withLights = false } = {}) {
    const group = new THREE.Group();
    if (withLights) addHangarLights(group);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x8a2a3a, emissive: 0x44101a, emissiveIntensity: 0.8,
      metalness: 0.45, roughness: 0.4,
    });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.8, 5), hullMat);
    hull.rotation.x = Math.PI / 2;
    group.add(hull);
    group.userData.hull = hull;

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.1, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0xffb040, emissive: 0xff6010, emissiveIntensity: 1.2,
        metalness: 0.2, roughness: 0.35,
      }),
    );
    stripe.position.set(0, 0.18, 0.05);
    group.add(stripe);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x5a1a24, emissive: 0x3a0a10, emissiveIntensity: 0.55,
      metalness: 0.4, roughness: 0.5,
    });
    const wingGeo = new THREE.BoxGeometry(1.7, 0.05, 0.85);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.8, 0, 0.55);
    wingL.rotation.y = 0.35;
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, wingMat.clone());
    wingR.position.set(0.8, 0, 0.55);
    wingR.rotation.y = -0.35;
    group.add(wingR);
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    const wingtipMat = new THREE.MeshStandardMaterial({
      color: 0xff5030, emissive: 0xff2010, emissiveIntensity: 1.1,
      metalness: 0.3, roughness: 0.4,
    });
    const wingtipGeo = new THREE.BoxGeometry(0.12, 0.14, 0.35);
    const tipL = new THREE.Mesh(wingtipGeo, wingtipMat);
    tipL.position.set(-1.5, 0.05, 0.85);
    group.add(tipL);
    const tipR = new THREE.Mesh(wingtipGeo, wingtipMat.clone());
    tipR.position.set(1.5, 0.05, 0.85);
    group.add(tipR);

    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.5, 8),
      new THREE.MeshStandardMaterial({
        color: 0x32131b, emissive: 0x200810, emissiveIntensity: 0.6,
        metalness: 0.55, roughness: 0.4,
      }),
    );
    engine.rotation.x = Math.PI / 2;
    engine.position.set(0, 0, 1.35);
    group.add(engine);
    group.userData.engine = engine;

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 12),
      new THREE.MeshBasicMaterial({ color: 0xff4020, transparent: true, opacity: 0.95 }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, 0, 1.62);
    group.add(glow);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 6),
      new THREE.MeshStandardMaterial({
        color: 0xff9e2c, emissive: 0xff4010, emissiveIntensity: 1.4,
        metalness: 0.1, roughness: 0.2,
      }),
    );
    cockpit.position.set(0, 0.1, -0.9);
    group.add(cockpit);
    group.userData.cockpit = cockpit;

    return group;
  }
}
