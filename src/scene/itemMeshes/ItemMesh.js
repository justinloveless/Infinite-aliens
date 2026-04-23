import * as THREE from 'three';
import { eventBus } from '../../core/EventBus.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qRest = new THREE.Quaternion();

/**
 * Procedural item mesh: static body on `root`, aimable part on `pivot` (a child
 * of `root`). Add `muzzle` Object3D(s) to `pivot` (or `root`); forward is -Z
 * in local space, matching ship slots.
 */
export class ItemMesh {
  /**
   * @param {object} item
   * @param {object} slot
   * @param {{ phase: 'combat'|'hangar'|string, entity?: import('../../ecs/Entity').Entity, world?: import('../../ecs/World').World, state?: object }} ctx
   */
  constructor(item, slot, ctx = {}) {
    this.item = item;
    this.slot = slot;
    this.phase = ctx.phase || 'combat';
    this.entity = ctx.entity;
    this.world = ctx.world;
    this.state = ctx.state;
    this._disposed = false;

    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    /** @type {THREE.Object3D[]} */
    this.muzzles = [];
    this._muzzleUnsubs = [];
    this._eventUnsubs = [];

    this._build();
    this._afterBuild();
  }

  /** Subclasses implement geometry. */
  _build() {
    this._addDefaultMuzzle();
  }

  _addDefaultMuzzle() {
    const m = new THREE.Object3D();
    m.name = 'muzzle';
    m.position.set(0, 0, -0.25);
    this.pivot.add(m);
    this.muzzles.push(m);
  }

  _afterBuild() {
    this._onAttachEvents?.();
  }

  /** @param {string} event */
  _listen(event, fn) {
    this._eventUnsubs.push(eventBus.on(event, fn));
  }

  muzzleCount() {
    return Math.max(1, this.muzzles.length);
  }

  /**
   * @param {number} [index=0]
   * @param {THREE.Vector3} [out]
   * @returns {THREE.Vector3}
   */
  getMuzzleWorldPosition(index = 0, out = new THREE.Vector3()) {
    if (this.muzzles.length) {
      const m = this.muzzles[Math.max(0, Math.min(this.muzzles.length - 1, index | 0))] || this.muzzles[0];
      return m.getWorldPosition(out);
    }
    out.set(0, 0, -0.25);
    this.pivot.localToWorld(out);
    return out;
  }

  /**
   * Slerp pivot toward aiming local -Z at `worldTarget` (parent local space of pivot).
   * @param {THREE.Vector3 | null} worldTarget
   * @param {number} turnRate
   * @param {number} dt
   * @param {number} [restBlend=1]
   */
  aimPivotAtWorldTarget(worldTarget, turnRate, dt, restBlend = 1) {
    if (!this.pivot?.parent) return;
    this.pivot.getWorldPosition(_v1);
    if (!worldTarget) {
      const t = 1 - Math.exp(-(turnRate * restBlend) * Math.max(0, dt));
      _qRest.set(0, 0, 0, 1);
      this.pivot.quaternion.slerp(_qRest, t);
      return;
    }
    this.pivot.getWorldPosition(_v1);
    const toT = _v2.subVectors(worldTarget, _v1);
    if (toT.lengthSq() < 1e-8) return;
    toT.normalize();
    this.pivot.parent.getWorldQuaternion(_q);
    const invP = _q.clone().invert();
    const dirParent = toT.clone().applyQuaternion(invP);
    const desired = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1), dirParent,
    );
    const t = 1 - Math.exp(-turnRate * Math.max(0, dt));
    this.pivot.quaternion.slerp(desired, t);
  }

  /**
   * @param {import('../../components/weapons/CombatTargeting.js').any} [mod]
   */
  applyTurretMaterialModifier(mod) {
    if (!mod) return;
    this.root.traverse(c => { if (c.isMesh) this._applyModToMesh(c, mod); });
  }

  _applyModToMesh(mesh, mod) {
    const m = mesh.material;
    if (!m) return;
    const { property, op, value } = mod;
    if (property === 'color' && m.color) {
      const hex = typeof value === 'string' ? parseInt(value.replace('#', '0x'), 16) : value;
      if (op === 'set') m.color.setHex(hex);
    } else if (property === 'emissive' && m.emissive) {
      const hex = typeof value === 'string' ? parseInt(value.replace('#', '0x'), 16) : value;
      if (op === 'set') m.emissive.setHex(hex);
    } else if (property === 'emissiveIntensity' && m.emissiveIntensity != null) {
      if (op === 'multiply') m.emissiveIntensity *= value;
      else if (op === 'add') m.emissiveIntensity += value;
      else if (op === 'set') m.emissiveIntensity = value;
    }
  }

  /**
   * @param {number} dt
   * @param {object} [ctx]
   */
  update(dt, ctx) {
    if (this.phase === 'hangar') {
      this._idleUpdate(dt, ctx);
    }
  }

  _idleUpdate() {}

  turretModKey() {
    return null;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const u of this._muzzleUnsubs) u();
    for (const u of this._eventUnsubs) u();
    this._eventUnsubs.length = 0;
    this._muzzleUnsubs.length = 0;
    this._dispose();
    if (this.root?.parent) this.root.parent.remove(this.root);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(mm => mm.dispose?.());
        else o.material.dispose?.();
      }
    });
  }

  _dispose() {}
}
