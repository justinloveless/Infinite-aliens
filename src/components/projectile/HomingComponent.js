import { Component } from '../../ecs/Component.js';

/** Lerps the ProjectileMotionComponent direction toward a tracked target entity. */
export class HomingComponent extends Component {
  constructor({ target = null, turnRate = 4 } = {}) {
    super();
    this.target = target;
    this.turnRate = turnRate;
    this._tmp = null;
  }

  update(dt) {
    if (!this.target || !this.target.active) return;
    const motion = this.entity?.get('ProjectileMotionComponent');
    const selfT = this.entity?.get('TransformComponent');
    const tgtT = this.target.get('TransformComponent');
    if (!motion || !selfT || !tgtT) return;

    if (!this._tmp) this._tmp = motion.direction.clone();
    this._tmp.copy(tgtT.position).sub(selfT.position).normalize();
    motion.direction.lerp(this._tmp, dt * this.turnRate).normalize();
  }
}
