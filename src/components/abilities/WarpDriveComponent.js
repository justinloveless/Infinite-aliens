import { AbilityComponent } from './AbilityComponent.js';

/** Teleports the owner forward along -Z by `distance` units. */
export class WarpDriveComponent extends AbilityComponent {
  constructor({ cooldown = 20, distance = 20, energyCost = 20 } = {}) {
    super({ id: 'warp_drive', icon: '⌖', cooldown, energyCost });
    this.distance = distance;
  }

  activate() {
    const t = this.entity.get('TransformComponent');
    if (t) t.position.z -= this.distance;
  }
}
