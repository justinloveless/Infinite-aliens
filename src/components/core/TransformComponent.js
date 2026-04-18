import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

/** Position/rotation/scale for an entity in world space. */
export class TransformComponent extends Component {
  constructor({ position, rotation, scale } = {}) {
    super();
    this.position = position ? position.clone() : new THREE.Vector3();
    this.rotation = rotation ? rotation.clone() : new THREE.Euler();
    this.scale = (typeof scale === 'number')
      ? new THREE.Vector3(scale, scale, scale)
      : (scale ? scale.clone() : new THREE.Vector3(1, 1, 1));
  }

  distanceTo(other) {
    const o = other?.position || other;
    const dx = this.position.x - o.x;
    const dy = this.position.y - o.y;
    const dz = this.position.z - o.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /** Squared horizontal (XZ) distance — cheap for sorting. */
  distanceSqXZ(other) {
    const o = other?.position || other;
    const dx = this.position.x - o.x;
    const dz = this.position.z - o.z;
    return dx * dx + dz * dz;
  }
}
