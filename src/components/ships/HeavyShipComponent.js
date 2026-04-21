import * as THREE from 'three';
import { ShipComponent } from './ShipComponent.js';
import { addHangarLights } from '../../scene/ShipMeshHelpers.js';
import slotsData from '../../data/shipSlots/heavy.json';

/**
 * Bulwark — heavy hitter.
 * Chunky box fuselage, twin side engines, amber cockpit, two extra armor slots.
 */
export class HeavyShipComponent extends ShipComponent {
  static id = 'heavy';
  static displayName = 'Bulwark';
  static description = 'Armored heavy hitter. Slow, hard-hitting, fortified with extra defense slots.';
  static meshVariant = 'heavy';
  static cost = { credits: 6000 };
  static baseStats = {
    BASE_HP: 180,
    BASE_DAMAGE: 22,
    BASE_ATTACK_SPEED: 0.4,
    BASE_SPEED: 2.1,
    BASE_ARMOR: 3,
  };

  static get slots() { return slotsData.slots; }
  static get defaultUnlockedSlots() { return slotsData.defaultUnlockedSlots; }
  static get defaultLoadout() { return slotsData.defaultLoadout; }

  static buildHull({ withLights = false } = {}) {
    const group = new THREE.Group();
    if (withLights) addHangarLights(group);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x6a6e78, emissive: 0x553022, emissiveIntensity: 0.55,
      metalness: 0.6, roughness: 0.55,
    });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 2.4), hullMat);
    group.add(hull);
    group.userData.hull = hull;

    const dorsal = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.4, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x5a5d66, emissive: 0x3a1a08, emissiveIntensity: 0.5,
        metalness: 0.55, roughness: 0.6,
      }),
    );
    dorsal.position.set(0, 0.42, 0.2);
    group.add(dorsal);

    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.4, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x7a6050, emissive: 0x4a2a10, emissiveIntensity: 0.7,
        metalness: 0.55, roughness: 0.45,
      }),
    );
    nose.position.set(0, 0, -1.45);
    group.add(nose);

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x525560, emissive: 0x2a1408, emissiveIntensity: 0.45,
      metalness: 0.55, roughness: 0.55,
    });
    const wingGeo = new THREE.BoxGeometry(0.7, 0.2, 1.3);
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.95, 0, 0.3);
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, wingMat.clone());
    wingR.position.set(0.95, 0, 0.3);
    group.add(wingR);
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x3a3d45, emissive: 0x1a0d04, emissiveIntensity: 0.45,
      metalness: 0.7, roughness: 0.35,
    });
    const engineGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.65, 10);
    const engineL = new THREE.Mesh(engineGeo, engineMat);
    engineL.rotation.x = Math.PI / 2;
    engineL.position.set(-0.4, 0, 1.3);
    group.add(engineL);
    const engineR = new THREE.Mesh(engineGeo, engineMat.clone());
    engineR.rotation.x = Math.PI / 2;
    engineR.position.set(0.4, 0, 1.3);
    group.add(engineR);
    group.userData.engine = engineL;
    group.userData.engines = [engineL, engineR];
    group.userData.engineColor = 0xffa436;

    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffa436, transparent: true, opacity: 0.9 });
    const glowL = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), glowMat);
    glowL.rotation.x = Math.PI / 2;
    glowL.position.set(-0.4, 0, 1.66);
    group.add(glowL);
    const glowR = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), glowMat.clone());
    glowR.rotation.x = Math.PI / 2;
    glowR.position.set(0.4, 0, 1.66);
    group.add(glowR);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffb24a, emissive: 0xff7800, emissiveIntensity: 1.1,
        metalness: 0.15, roughness: 0.25,
      }),
    );
    cockpit.position.set(0, 0.5, -0.65);
    group.add(cockpit);
    group.userData.cockpit = cockpit;

    return group;
  }
}
