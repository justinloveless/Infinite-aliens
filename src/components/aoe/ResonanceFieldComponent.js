import { Component } from '../../ecs/Component.js';

/**
 * Marker component exposing the player's resonance-field level. Read by
 * weapon components when computing damage so stacks boost per-kill damage.
 */
export class ResonanceFieldComponent extends Component {
  constructor({ level = 1 } = {}) {
    super();
    this.level = level;
  }
}
