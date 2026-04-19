import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

/**
 * Moves the projectile along its direction vector. Keeps direction normalized
 * so other components (homing) can lerp it toward targets.
 */
export class ProjectileMotionComponent extends Component {
  constructor({ direction, speed = 25 } = {}) {
    super();
    this.direction = direction ? direction.clone().normalize() : new THREE.Vector3(0, 0, -1);
    this.speed = speed;
  }

  update(dt) {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;
    t.position.addScaledVector(this.direction, this.speed * dt);
  }
}
