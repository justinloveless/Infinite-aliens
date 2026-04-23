import * as THREE from 'three';
import { ItemMesh } from './ItemMesh.js';
import { EVENTS } from '../../core/EventBus.js';

function col(hex) {
  return typeof hex === 'string' ? parseInt(hex.replace('#', '0x'), 16) : (hex ?? 0xffcc00);
}

export class MagnetCoilItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const c = col(this.item?.color);
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.03, 8, 32),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.4 }),
    );
    tor.rotation.x = Math.PI / 2;
    this.pivot.add(tor);
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.y = this._t * 1.1; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class ThrusterItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const c = 0xffd700;
    this._core = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: c, emissive: 0xffaa00, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.5 }),
    );
    this._core.rotation.x = Math.PI;
    this.pivot.add(this._core);
  }
  update(dt, ctx) {
    const v = (ctx && ctx.playerSpeed) != null ? ctx.playerSpeed : 0;
    const t = 1.2 + 0.3 * (v / 12);
    if (this._core?.material) this._core.material.emissiveIntensity = 0.3 + 0.5 * Math.min(1, t / 2);
  }
}

export class NanobotsItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this._healPulse = 0;
    const c = 0x39ff14;
    for (let i = 0; i < 5; i++) {
      const s = 0.04 + (i % 2) * 0.02;
      const p = new THREE.Mesh(
        new THREE.OctahedronGeometry(s, 0),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 }),
      );
      p.position.set(0, (i - 2) * 0.1, 0);
      this.pivot.add(p);
    }
    this._listen(EVENTS.PLAYER_HEALED, () => { this._healPulse = 0.5; });
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = this._t;
  }
  update(dt) {
    this._healPulse = Math.max(0, this._healPulse - dt);
    const s = 1 + this._healPulse;
    this.pivot.scale.setScalar(s);
    this._idleUpdate(dt, {});
  }
}

export class RepulserItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const c = 0xff9900;
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 6, 40),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 }),
    );
    t.rotation.x = Math.PI / 2;
    this.pivot.add(t);
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.x = this._t * 0.4; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class ScannerItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this._ping = 0;
    const c = 0x00ffcc;
    this._dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.2, side: THREE.DoubleSide }),
    );
    this.pivot.add(this._dish);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.4 }),
    );
    post.position.set(0, 0, 0.05);
    this.pivot.add(post);
    this._listen(EVENTS.ENEMY_KILLED, () => { this._ping = 0.4; });
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this._dish.rotation.y = this._t * 1.4;
  }
  update(dt) {
    this._ping = Math.max(0, this._ping - dt);
    this._dish.position.z = 0.02 * Math.min(1, this._ping / 0.4);
    this._idleUpdate(dt, {});
  }
}

export class SalvagingBeamItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this.pivot.add(new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.15, 8),
      new THREE.MeshStandardMaterial({ color: 0x88ff44, emissive: 0x44aa22, emissiveIntensity: 0.2 }),
    ));
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.z = this._t * 0.6; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class MiningLaserItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this.pivot.add(new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.25, 6),
      new THREE.MeshStandardMaterial({ color: 0xffee00, emissive: 0xffcc00, emissiveIntensity: 0.3 }),
    ));
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.x = this._t * 0.5; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class GravityWellItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const c = 0x6600ff;
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.1 + i * 0.04, 0.01, 32, 4),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15, transparent: true, opacity: 0.4 }),
      );
      r.rotation.set(i * 0.4, i * 0.3, 0);
      this.pivot.add(r);
    }
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.rotation.y = this._t * 0.2; }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class DroneItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const c = 0x0088ff;
    this._body = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.2 }),
    );
    this.pivot.add(this._body);
  }
  _idleUpdate(dt) { this._t = (this._t || 0) + dt; this.pivot.position.set(Math.sin(this._t) * 0.15, Math.cos(this._t * 0.7) * 0.1, 0); }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}
