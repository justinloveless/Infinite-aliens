import * as THREE from 'three';
import { ItemMesh } from './ItemMesh.js';

function c(hex) {
  return typeof hex === 'string' ? parseInt(hex.replace('#', '0x'), 16) : (hex ?? 0xffd700);
}

class OrbitingCoreMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const cl = c(this.item?.color);
    this._core = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: cl, emissive: c, emissiveIntensity: 0.4, metalness: 0.2, roughness: 0.4 }),
    );
    this.pivot.add(this._core);
    this._r = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.02, 6, 24),
      new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0.45 }),
    );
    this._r.rotation.x = Math.PI / 2;
    this.pivot.add(this._r);
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this._r.rotation.z = this._t;
    this.pivot.rotation.y = this._t * 0.4;
  }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class StellarGenItemMesh extends OrbitingCoreMesh {}
export class ReactorItemMesh extends OrbitingCoreMesh {
  _build() {
    super._build();
    this._core?.scale.setScalar(1.1);
  }
}
export class SolarCellsItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffcc00, emissiveIntensity: 0.2, side: THREE.DoubleSide }),
      );
      p.position.set((i % 2) * 0.12 - 0.06, 0, (i > 1 ? 0.12 : -0.12) - 0.06);
      p.rotation.x = -0.2;
      this.pivot.add(p);
    }
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.y = this._t * 0.3; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}
export class BioLabItemMesh extends OrbitingCoreMesh {
  _build() {
    this.item = { ...this.item, color: this.item?.color || '#39ff14' };
    super._build();
  }
}
export class PlasmaFarmItemMesh extends OrbitingCoreMesh {
  _build() {
    this.item = { ...this.item, color: this.item?.color || '#00f5ff' };
    super._build();
  }
}
export class ParticleColliderItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    for (let i = 0; i < 2; i++) {
      this.pivot.add(new THREE.Mesh(
        new THREE.TorusGeometry(0.18 + i * 0.12, 0.02, 6, 32),
        new THREE.MeshStandardMaterial({ color: 0x9b30ff, emissive: 0x6b1088, emissiveIntensity: 0.3 }),
      ));
    }
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.children.forEach((ch, i) => { ch.rotation.x = this._t * (0.3 + i * 0.1); ch.rotation.y = this._t; });
  }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}
export class StellarBurstItemMesh extends OrbitingCoreMesh {
  _build() {
    this.item = { ...this.item, color: this.item?.color || '#ffaa00' };
    super._build();
  }
}
export class NovaCoreItemMesh extends OrbitingCoreMesh {
  _build() {
    this.item = { ...this.item, color: this.item?.color || '#ffd700' };
    super._build();
  }
}

