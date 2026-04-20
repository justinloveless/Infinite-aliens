import * as THREE from 'three';
import { ShipComponent } from './ShipComponent.js';
import { addHangarLights } from '../../scene/ShipMeshHelpers.js';
import slotsData from '../../data/shipSlots/allrounder.json';

/**
 * Vanguard — the balanced starter hull.
 * Symmetric cone + wings, neon-cyan cockpit, single rear engine.
 */
export class AllrounderShipComponent extends ShipComponent {
  static id = 'allrounder';
  static displayName = 'Vanguard';
  static description = 'Balanced starter hull. Versatile in every role.';
  static meshVariant = 'allrounder';
  static cost = { credits: 0 };
  static ownedByDefault = true;
  static baseStats = {};

  static get slots() { return slotsData.slots; }
  static get defaultUnlockedSlots() { return slotsData.defaultUnlockedSlots; }
  static get defaultLoadout() { return slotsData.defaultLoadout; }

  static buildHull({ withLights = false } = {}) {
    const group = new THREE.Group();
    if (withLights) addHangarLights(group);

    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 2.2, 6),
      new THREE.MeshStandardMaterial({
        color: 0x7799bb, emissive: 0x1a2e42, emissiveIntensity: 0.6,
        metalness: 0.35, roughness: 0.55,
      }),
    );
    hull.rotation.x = Math.PI / 2;
    group.add(hull);
    group.userData.hull = hull;

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x5577aa, emissive: 0x0f1f33, emissiveIntensity: 0.5,
      metalness: 0.4, roughness: 0.5,
    });
    const wingGeo = new THREE.BoxGeometry(1.8, 0.1, 0.8);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.9, 0, 0.5);
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, wingMat.clone());
    wingR.position.set(0.9, 0, 0.5);
    group.add(wingR);
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8),
      new THREE.MeshStandardMaterial({
        color: 0x445566, emissive: 0x0a1520, emissiveIntensity: 0.4,
        metalness: 0.5, roughness: 0.4,
      }),
    );
    engine.rotation.x = Math.PI / 2;
    engine.position.z = 1.1;
    group.add(engine);
    group.userData.engine = engine;

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 12),
      new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.9 }),
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.z = 1.38;
    group.add(glow);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0x00f5ff, emissive: 0x00c8d8, emissiveIntensity: 1.2,
        metalness: 0.1, roughness: 0.2,
      }),
    );
    cockpit.position.z = -0.6;
    group.add(cockpit);
    group.userData.cockpit = cockpit;

    return group;
  }
}
