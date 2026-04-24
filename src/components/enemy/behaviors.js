import { Component } from '../../ecs/Component.js';

/** Base class: exposes `speed` (scaled by speedScale + slow status each frame) */
class EnemyBehaviorComponent extends Component {
  constructor({ speed = 2, speedScale = 1 } = {}) {
    super();
    this.speed = speed;
    this.speedScale = speedScale;
    this._timer = 0;
  }

  _playerPos(ctx) {
    if (this.entity.hasTag('decoy_immune')) {
      const p = ctx.playerEntity?.get('TransformComponent');
      return p ? p.position : null;
    }
    const p = ctx.playerEntity?.get('TransformComponent');
    return p ? p.position : null;
  }

  _slow(entity) {
    return entity.get('StatusEffectsComponent')?.slowMult ?? 1;
  }
}

export class ChargeBehaviorComponent extends EnemyBehaviorComponent {
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.1) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    t.position.x += (dx / d) * spd * dt;
    const zDelta = (dz / d) * spd * dt;
    t.position.z += zDelta > 0 ? zDelta : spd * 0.3 * dt;
  }
}

export class SteadyBehaviorComponent extends ChargeBehaviorComponent {}

/** High-frequency lateral sine — counters fixed-forward aim. */
export class ZigzagFastBehaviorComponent extends EnemyBehaviorComponent {
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._timer += dt;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.1) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    const lateral = Math.sin(this._timer * 14) * spd * 0.95;
    const perpX = -dz / d;
    const perpZ = dx / d;
    t.position.x += ((dx / d) * spd + perpX * lateral) * dt;
    const zDelta = ((dz / d) * spd + perpZ * lateral) * dt;
    t.position.z += zDelta > 0 ? zDelta : spd * 0.3 * dt;
  }
}

export class ZigzagBehaviorComponent extends EnemyBehaviorComponent {
  constructor(opts) { super(opts); this._dir = 1; }
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._timer += dt;
    if (this._timer > 0.6) { this._timer = 0; this._dir *= -1; }
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.1) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    t.position.x += ((dx / d) * spd + this._dir * spd * 0.8) * dt;
    const zDelta = (dz / d) * spd * dt;
    t.position.z += zDelta > 0 ? zDelta : spd * 0.3 * dt;
  }
}

export class KeepRangeBehaviorComponent extends EnemyBehaviorComponent {
  constructor({ keepDist = 12, ...opts } = {}) { super(opts); this.keepDist = keepDist; }
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    if (d < this.keepDist) {
      t.position.x -= (dx / d) * spd * dt * 0.5;
      const zDelta = -(dz / d) * spd * dt * 0.5;
      t.position.z += zDelta > 0 ? zDelta : spd * 0.3 * dt;
    } else if (d > this.keepDist + 4) {
      t.position.x += (dx / d) * spd * dt;
      const zDelta = (dz / d) * spd * dt;
      t.position.z += zDelta > 0 ? zDelta : spd * 0.3 * dt;
    }
  }
}

/** Matches player `speed` stat each frame (cannot be permanently outrun). */
export class SpeedMatchBehaviorComponent extends EnemyBehaviorComponent {
  update(dt, ctx) {
    const stats = ctx.playerEntity?.get('PlayerStatsComponent');
    const base = stats?.speed ?? this.speed;
    this.speed = base;
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.1) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    t.position.x += (dx / d) * spd * dt;
    const zDelta = (dz / d) * spd * dt;
    t.position.z += zDelta > 0 ? zDelta : spd * 0.3 * dt;
  }
}

export class BossBehaviorComponent extends EnemyBehaviorComponent {
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._timer += dt;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    const phase = Math.floor(this._timer / 4) % 3;
    if (phase === 0 && d > 0.1) {
      t.position.x += (dx / d) * spd * dt;
      t.position.z += (dz / d) * spd * dt;
    } else if (phase === 1) {
      t.position.x += Math.sin(this._timer * 2) * spd * 1.5 * dt;
      if (d > 0.001) t.position.z += (dz / d) * spd * 0.3 * dt;
    } else {
      if (d < 8 && d > 0.001) {
        t.position.x -= (dx / d) * spd * 0.5 * dt;
        t.position.z -= (dz / d) * spd * 0.5 * dt;
      } else if (d > 0.001) {
        t.position.x += (dx / d) * spd * dt;
        t.position.z += (dz / d) * spd * dt;
      }
    }
    const vis = this.entity.get('EnemyVisualsComponent');
    if (vis?.spinGroup) vis.spinGroup.rotation.y += dt * 0.8;
  }
}

export const BEHAVIOR_COMPONENTS = {
  charge: ChargeBehaviorComponent,
  steady: SteadyBehaviorComponent,
  zigzag: ZigzagBehaviorComponent,
  zigzag_fast: ZigzagFastBehaviorComponent,
  keepRange: KeepRangeBehaviorComponent,
  speed_match: SpeedMatchBehaviorComponent,
  boss: BossBehaviorComponent,
};
