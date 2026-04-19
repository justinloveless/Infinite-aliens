import { Component } from '../../ecs/Component.js';

/** Destroys the entity once its transform leaves an axis-aligned box. */
export class BoundsComponent extends Component {
  constructor({ xMax = 35, yMax = 20, zMin = -90, zMax = 10 } = {}) {
    super();
    this.xMax = xMax;
    this.yMax = yMax;
    this.zMin = zMin;
    this.zMax = zMax;
  }

  update() {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;
    const p = t.position;
    if (p.z < this.zMin || p.z > this.zMax || Math.abs(p.x) > this.xMax || Math.abs(p.y) > this.yMax) {
      this.entity.destroy();
    }
  }
}
