import * as THREE from 'three';
import { AimingItemMesh } from './AimingItemMesh.js';

const TURRET = {
  laser:   { color: 0x00f5ff, emissive: 0x006688, lightColor: 0x00f5ff },
  missile: { color: 0xff8800, emissive: 0x884400, lightColor: 0xff8800 },
  plasma:  { color: 0xff00ff, emissive: 0x880088, lightColor: 0xff00ff },
  beam:    { color: 0xff1133, emissive: 0x880011, lightColor: 0xff1133 },
};

function turretGroup(kind) {
  const cfg = TURRET[kind] || TURRET.laser;
  const group = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({
    color: cfg.color, emissive: cfg.emissive, emissiveIntensity: 1.2,
    metalness: 0.3, roughness: 0.4,
  });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 6), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.1;
  group.add(barrel);
  const pod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.6, roughness: 0.4 }),
  );
  pod.rotation.x = Math.PI / 2;
  pod.position.z = 0.18;
  group.add(pod);
  group.add(new THREE.PointLight(cfg.lightColor, 0.9, 2.5));
  return group;
}

function buildTurretBodyAndMuzzle(pivot, kind) {
  pivot.add(turretGroup(kind));
  const m = new THREE.Object3D();
  m.name = 'muzzle';
  m.position.set(0, 0, -0.32);
  pivot.add(m);
  return [m];
}

export class LaserTurretItemMesh extends AimingItemMesh {
  turretModKey() { return 'laser'; }
  _build() {
    this.muzzles = buildTurretBodyAndMuzzle(this.pivot, 'laser');
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.7) * 0.12;
  }
}
export class MissileTurretItemMesh extends AimingItemMesh {
  turretModKey() { return 'missile'; }
  _build() {
    this.muzzles = buildTurretBodyAndMuzzle(this.pivot, 'missile');
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.7) * 0.12;
  }
}
export class PlasmaTurretItemMesh extends AimingItemMesh {
  turretModKey() { return 'plasma'; }
  _build() {
    this.muzzles = buildTurretBodyAndMuzzle(this.pivot, 'plasma');
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.7) * 0.12;
  }
}
export class BeamTurretItemMesh extends AimingItemMesh {
  turretModKey() { return 'beam'; }
  _build() {
    this.muzzles = buildTurretBodyAndMuzzle(this.pivot, 'beam');
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.7) * 0.12;
  }
}
