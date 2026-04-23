import * as THREE from 'three';
import { ItemMesh } from './ItemMesh.js';

export class EmpItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2;
      const a = new THREE.Mesh(
        new THREE.TorusGeometry(0.12 + (i * 0.04), 0.02, 6, 20),
        new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xaaaa00, emissiveIntensity: 0.25 + i * 0.1 }),
      );
      a.rotation.set(t, t * 0.5, 0);
      this.pivot.add(a);
    }
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.z = this._t * 0.8; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class WarpDriveItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const c = 0xaa44ff;
    this.pivot.add(new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45 }),
    ));
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.set(this._t, this._t * 0.5, 0); }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class GravityBombItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this.pivot.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8800ff, emissive: 0x550088, emissiveIntensity: 0.3 }),
    ));
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.scale.setScalar(1 + 0.05 * Math.sin(this._t * 2)); }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class DecoyItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this.pivot.add(new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x00aaee, emissiveIntensity: 0.25, wireframe: true }),
    ));
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.y = this._t * 1.2; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class SpeedBoosterItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this.pivot.add(new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xccccff, emissiveIntensity: 0.3 }),
    ));
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.x = this._t * 0.3; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}
