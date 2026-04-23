import * as THREE from 'three';
import { ItemMesh } from './ItemMesh.js';
import { EVENTS } from '../../core/EventBus.js';

function c(hex) {
  return typeof hex === 'string' ? parseInt(hex.replace('#', '0x'), 16) : (hex ?? 0x888888);
}

export class HullPlatingItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const cl = c(this.item?.color);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 0.4),
      new THREE.MeshStandardMaterial({ color: cl, metalness: 0.7, roughness: 0.3 }),
    );
    this.pivot.add(plate);
    this._idleRings(cl);
  }
  _idleRings(cl) {
    this._ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.02, 6, 20),
      new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0.4 }),
    );
    this._ring1.rotation.x = Math.PI / 2;
    this.pivot.add(this._ring1);
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    if (this._ring1) this._ring1.rotation.z = this._t * 0.4;
  }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class CompositeArmorItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    this._t = 0;
    const cl = c(this.item?.color ?? 0x6699cc);
    for (let i = 0; i < 3; i++) {
      const s = 0.35 - i * 0.06;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(s, 0.05, s * 0.8),
        new THREE.MeshStandardMaterial({ color: cl, metalness: 0.75, roughness: 0.25 }),
      );
      box.position.x = (i - 1) * 0.04;
      this.pivot.add(box);
    }
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.3) * 0.05;
  }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class ShieldEmitterItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const cl = c(this.item?.color);
    this._core = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 10),
      new THREE.MeshStandardMaterial({
        color: cl, emissive: cl, emissiveIntensity: 0.8,
        metalness: 0.2, roughness: 0.4,
      }),
    );
    this.pivot.add(this._core);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(0.18 + i * 0.1, 0.015, 6, 24),
        new THREE.MeshBasicMaterial({ color: cl, transparent: true, opacity: 0.35 - i * 0.1 }),
      );
      t.rotation.x = Math.PI / 2;
      t.name = 'ring' + i;
      this.pivot.add(t);
    }
    this._flash = 0;
    this._shake = 0;
    this._listen(EVENTS.SHIELD_DAMAGED, () => { this._flash = 0.4; this._shake = 0.2; });
    this._listen(EVENTS.SHIELD_BROKEN, () => { this._flash = 0.8; this._shake = 0.5; });
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.children.forEach(ch => {
      if (ch.name?.startsWith('ring')) {
        ch.rotation.z = this._t * (1.1 + 0.2 * (ch.name === 'ring0' ? 1 : 0));
      }
    });
  }
  update(dt, ctx) {
    this._shake = Math.max(0, this._shake - dt);
    this._flash = Math.max(0, this._flash - dt);
    const pulse = 1 + this._flash * 0.45 + (this._shake > 0 ? 0.1 : 0);
    this._core.scale.setScalar(pulse);
    if (this._core?.material) {
      this._core.material.emissiveIntensity = 0.8 + this._flash * 2;
    }
    this._idleUpdate(dt, ctx);
  }
}

export class PhoenixDriveItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const g = new THREE.Group();
    const r = 0.15;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.15, 6),
        new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 }),
      );
      m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      m.rotation.set(Math.PI / 2, 0, -a);
      g.add(m);
    }
    this.pivot.add(g);
    g.add(new THREE.PointLight(0xff6600, 0.3, 2));
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.children[0].rotation.z = this._t * 0.5;
  }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}

export class JuggernautItemMesh extends ItemMesh {
  _build() {
    this.muzzles = [];
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x3366ff, metalness: 0.6, roughness: 0.4 }),
    );
    this.pivot.add(b);
  }
  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
  }
  update(dt, ctx) { this._idleUpdate(dt, ctx); }
}
