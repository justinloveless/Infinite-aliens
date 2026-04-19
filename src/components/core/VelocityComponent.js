import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

/** Integrates velocity into the TransformComponent position each frame. */
export class VelocityComponent extends Component {
  constructor({ velocity, speedScale = 1 } = {}) {
    super();
    this.velocity = velocity ? velocity.clone() : new THREE.Vector3();
    this.speedScale = speedScale;
  }

  update(dt) {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;
    t.position.addScaledVector(this.velocity, dt * this.speedScale);
  }
}
