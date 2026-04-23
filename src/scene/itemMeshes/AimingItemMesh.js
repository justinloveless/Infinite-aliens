import { ItemMesh } from './ItemMesh.js';

const TURN = 12;

/**
 * Turret / gimbal that eases toward `ctx.aimTarget` when `ctx.shouldAim` is set.
 */
export class AimingItemMesh extends ItemMesh {
  _combatUpdate(dt, ctx) {
    if (ctx?.shouldAim && ctx.aimTarget) {
      this.aimPivotAtWorldTarget(ctx.aimTarget, TURN, dt);
    } else {
      this.aimPivotAtWorldTarget(null, TURN * 0.4, dt);
    }
  }

  update(dt, ctx) {
    if ((ctx?.phase || this.phase) === 'hangar') {
      this._idleUpdate(dt, ctx);
    } else {
      this._combatUpdate(dt, ctx);
    }
  }

  _idleUpdate(dt) {
    this._t = (this._t || 0) + dt;
    this.pivot.rotation.y = Math.sin(this._t * 0.5) * 0.04;
  }
}
