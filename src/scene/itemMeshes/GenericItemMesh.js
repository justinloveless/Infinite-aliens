import * as THREE from 'three';
import { ItemMesh } from './ItemMesh.js';

function parseColor(hex) {
  if (typeof hex === 'string') return parseInt(hex.replace('#', '0x'), 16);
  return hex ?? 0x888888;
}

/**
 * Stock mesh when no dedicated class: spin + muzzle for weapons.
 */
export class GenericItemMesh extends ItemMesh {
  _build() {
    const color = parseColor(this.item?.color);
    const slot = this.slot;
    const st = (this.item?.slotType) || (slot?.type) || 'utility';
    const size = (slot?.size ?? 0.3) * 0.9;
    this._time = 0;
    this._ring = null;

    if (st === 'weapon') {
      this.pivot.add(this._cannonBody(color, size));
    } else {
      const geo = (slot?.shape) === 'circle'
        ? new THREE.SphereGeometry(size * 0.55, 12, 10)
        : new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.4,
        metalness: 0.45, roughness: 0.4,
      });
      const m = new THREE.Mesh(geo, mat);
      this.pivot.add(m);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(size * 0.65, 0.02, 6, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = Math.PI / 2;
      this.pivot.add(ring);
      this._ring = ring;
    }
    this.muzzles = [];
    const mz = new THREE.Object3D();
    mz.name = 'muzzle';
    mz.position.set(0, 0, -size * 1.2);
    this.pivot.add(mz);
    this.muzzles.push(mz);
  }

  _cannonBody(color, size) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.7,
      metalness: 0.35, roughness: 0.4,
    });
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.15, size * 0.18, size * 1.4, 8),
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -size * 0.5;
    barrel.material = mat;
    g.add(barrel);
    g.add(new THREE.PointLight(color, 0.4, 2));
    return g;
  }

  _idleUpdate(dt, ctx) {
    this._time = (this._time || 0) + dt;
    if (this._ring) this._ring.rotation.z = this._time * 0.8;
    this.pivot.rotation.y = Math.sin(this._time * 0.4) * 0.1;
  }

  update(dt, ctx) {
    this._idleUpdate(dt, ctx);
  }
}
