import * as THREE from 'three';
import { AimingItemMesh } from './AimingItemMesh.js';

function parseColor(hex) {
  if (typeof hex === 'string') return parseInt(hex.replace('#', '0x'), 16);
  return hex ?? 0xffcc66;
}

/** Dual muzzle for nose / wing forward cannons. */
export class MainCannonItemMesh extends AimingItemMesh {
  _build() {
    this.muzzles = [];
    const c = parseColor(this.item?.color);
    const mat = new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 0.85,
      metalness: 0.4, roughness: 0.35,
    });
    const g = new THREE.Group();
    const b1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8), mat,
    );
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.05, 0, -0.2);
    const b2 = b1.clone();
    b2.position.set(0.05, 0, -0.2);
    g.add(b1, b2);
    g.add(new THREE.PointLight(c, 0.5, 2.5));
    this.pivot.add(g);
    const m1 = new THREE.Object3D();
    m1.position.set(-0.05, 0, -0.45);
    const m2 = new THREE.Object3D();
    m2.position.set(0.05, 0, -0.45);
    this.pivot.add(m1, m2);
    this.muzzles.push(m1, m2);
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.6) * 0.08;
  }
}

export class WingCannonItemMesh extends AimingItemMesh {
  _build() {
    this.muzzles = [];
    const c = parseColor(this.item?.color ?? 0xff8800);
    const mat = new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 0.75,
      metalness: 0.45, roughness: 0.38,
    });
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.12, 0.4), mat,
    );
    housing.position.set(0, 0, -0.1);
    this.pivot.add(housing);
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.05, 0.5, 8), mat,
    );
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0, -0.2);
    this.pivot.add(b);
    const m = new THREE.Object3D();
    m.position.set(0, 0, -0.45);
    this.pivot.add(m);
    this.muzzles.push(m);
    this.pivot.add(new THREE.PointLight(c, 0.45, 2.2));
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.x = Math.sin(this._t * 0.5) * 0.05;
  }
}

export class RailgunItemMesh extends AimingItemMesh {
  _build() {
    this.muzzles = [];
    const c = 0xaaddff;
    const mat = new THREE.MeshStandardMaterial({
      color: c, emissive: 0x224466, emissiveIntensity: 0.4,
      metalness: 0.75, roughness: 0.2,
    });
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.6), mat);
    railL.position.set(-0.1, 0, -0.1);
    const railR = railL.clone();
    railR.position.set(0.1, 0, -0.1);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), mat,
    );
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0, -0.1);
    this.pivot.add(railL, railR, core);
    this.pivot.add(new THREE.PointLight(0x88ccff, 0.4, 2));
    const m = new THREE.Object3D();
    m.position.set(0, 0, -0.45);
    this.pivot.add(m);
    this.muzzles.push(m);
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.4) * 0.06;
  }
}
