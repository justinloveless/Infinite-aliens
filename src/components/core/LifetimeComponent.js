import { Component } from '../../ecs/Component.js';

/** Destroys the owning entity after `duration` seconds. */
export class LifetimeComponent extends Component {
  constructor({ duration = 1 } = {}) {
    super();
    this.remaining = duration;
  }

  update(dt) {
    this.remaining -= dt;
    if (this.remaining <= 0) this.entity.destroy();
  }
}
