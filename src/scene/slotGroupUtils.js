import * as THREE from 'three';

const _euler = new THREE.Euler();
const _order = 'XYZ';

/**
 * Apply `slot.position` and optional `slot.rotation` (euler [x,y,z] radians) to a group.
 * @param {THREE.Object3D} group
 * @param {object} slot
 */
export function applySlotGroupTransform(group, slot) {
  if (!group || !slot) return;
  const p = slot.position;
  if (Array.isArray(p) && p.length >= 3) {
    group.position.set(p[0], p[1], p[2]);
  } else {
    group.position.set(0, 0, 0);
  }
  const r = slot.rotation;
  if (Array.isArray(r) && r.length >= 3) {
    _euler.set(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, _order);
    group.setRotationFromEuler(_euler);
  } else {
    group.rotation.set(0, 0, 0);
  }
}
