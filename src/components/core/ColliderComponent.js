import { Component } from '../../ecs/Component.js';

/**
 * Sphere collider. No logic inside — the CollisionCoordinator reads radius and
 * layer, does broadphase, and calls `onHit(otherEntity, ctx)` on the component.
 *
 * `layer` and `mask`:
 *   - layer is a string describing what this entity IS: 'player', 'playerProjectile', 'enemy', 'enemyProjectile', 'loot', 'asteroid'.
 *   - mask is the set of layers it should be tested against.
 */
export class ColliderComponent extends Component {
  constructor({ radius = 0.5, layer = 'default', mask = [] } = {}) {
    super();
    this.radius = radius;
    this.layer = layer;
    this.mask = new Set(mask);
    /** @type {(otherEntity, ctx) => void} */
    this.onHit = null;
    /** Return true from shouldCollide to allow the hit (e.g. piercing skips already-hit). */
    this.shouldCollide = null;
  }
}
