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
  }
}

/**
 * Rusher: holds distance and strafes, then makes short violent dash attacks,
 * then retreats to reset. Good for fast/aggressive bosses.
 */
export class BossRusherBehaviorComponent extends EnemyBehaviorComponent {
  constructor(opts) { super(opts); this._phase = 0; this._phaseTimer = 0; }
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._timer += dt;
    this._phaseTimer += dt;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    const phaseDur = [3.0, 0.7, 2.0];
    if (this._phaseTimer >= phaseDur[this._phase]) {
      this._phase = (this._phase + 1) % 3;
      this._phaseTimer = 0;
    }
    if (this._phase === 0) {
      // Orbit at ~16 units, strafe perpendicularly
      const perpX = -(dz / (d || 1));
      const perpZ = (dx / (d || 1));
      t.position.x += perpX * spd * dt;
      t.position.z += perpZ * spd * dt;
      if (d < 14 && d > 0.1) {
        t.position.x -= (dx / d) * spd * 0.6 * dt;
        t.position.z -= (dz / d) * spd * 0.6 * dt;
      } else if (d > 22 && d > 0.1) {
        t.position.x += (dx / d) * spd * dt;
        t.position.z += (dz / d) * spd * dt;
      }
    } else if (this._phase === 1) {
      // Dash at 4× speed
      if (d > 0.1) {
        t.position.x += (dx / d) * spd * 4 * dt;
        t.position.z += (dz / d) * spd * 4 * dt;
      }
    } else {
      // Retreat fast after a close-range dash; if still far, keep advancing
      if (d < 20 && d > 0.1) {
        t.position.x -= (dx / d) * spd * 1.8 * dt;
        t.position.z -= (dz / d) * spd * 1.8 * dt;
      } else if (d > 0.1) {
        t.position.x += (dx / d) * spd * dt;
        t.position.z += (dz / d) * spd * dt;
      }
    }
  }
}

/**
 * Orbiter: maintains a preferred orbit radius around the player.
 * Flips orbit direction every ~8 seconds. Good for ring/disc-shaped bosses.
 */
export class BossOrbiterBehaviorComponent extends EnemyBehaviorComponent {
  constructor(opts) { super(opts); this._orbitDir = 1; this._orbitTimer = 0; }
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._orbitTimer += dt;
    if (this._orbitTimer > 8) { this._orbitDir *= -1; this._orbitTimer = 0; }
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    const orbitRadius = 15;
    const radialErr = d - orbitRadius;
    const radialSpd = Math.sign(radialErr) * Math.min(Math.abs(radialErr) * 0.8, spd);
    const perpX = -(dz / d);
    const perpZ = (dx / d);
    t.position.x += (dx / d) * radialSpd * dt + perpX * spd * 0.65 * this._orbitDir * dt;
    t.position.z += (dz / d) * radialSpd * dt + perpZ * spd * 0.65 * this._orbitDir * dt;
  }
}

/**
 * Sniper: keeps long range (~20 units) and strafes laterally to avoid
 * player fire while maintaining firing angle. Good for ranged specialists.
 */
export class BossSniperBehaviorComponent extends EnemyBehaviorComponent {
  constructor(opts) { super(opts); this._strafeDir = 1; this._strafeTimer = 0; }
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._strafeTimer += dt;
    if (this._strafeTimer > 4.5) { this._strafeDir *= -1; this._strafeTimer = 0; }
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    const targetDist = 20;
    // Maintain range
    if (d < targetDist - 3) {
      t.position.x -= (dx / d) * spd * 0.7 * dt;
      t.position.z -= (dz / d) * spd * 0.7 * dt;
    } else if (d > targetDist + 6) {
      t.position.x += (dx / d) * spd * dt;
      t.position.z += (dz / d) * spd * dt;
    }
    // Strafe
    const perpX = -(dz / d);
    const perpZ = (dx / d);
    t.position.x += perpX * spd * 0.75 * this._strafeDir * dt;
    t.position.z += perpZ * spd * 0.75 * this._strafeDir * dt;
  }
}

/**
 * Aggressor: slow but relentless — never retreats, just grinds forward with
 * a gentle sine-wave weave. Good for heavy armored bosses.
 */
export class BossAggressorBehaviorComponent extends EnemyBehaviorComponent {
  update(dt, ctx) {
    const t = this.entity.get('TransformComponent');
    const p = this._playerPos(ctx); if (!t || !p) return;
    this._timer += dt;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) return;
    const spd = this.speed * this.speedScale * this._slow(this.entity);
    // Advance
    t.position.x += (dx / d) * spd * 0.7 * dt;
    t.position.z += (dz / d) * spd * 0.7 * dt;
    // Sine weave
    const perpX = -(dz / d);
    const perpZ = (dx / d);
    t.position.x += perpX * Math.sin(this._timer * 0.9) * spd * 0.35 * dt;
    t.position.z += perpZ * Math.sin(this._timer * 0.9) * spd * 0.35 * dt;
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
  boss_rusher: BossRusherBehaviorComponent,
  boss_orbiter: BossOrbiterBehaviorComponent,
  boss_sniper: BossSniperBehaviorComponent,
  boss_aggressor: BossAggressorBehaviorComponent,
};
