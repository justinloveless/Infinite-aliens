import { Component } from '../../ecs/Component.js';
import { isCombatPhase } from '../../core/phaseUtil.js';

/**
 * Tracks nearby asteroids and, once within range, deals continuous damage
 * until destroyed. Count governs how many lasers are active simultaneously.
 */
export class MiningLaserComponent extends Component {
  constructor({ count = 1, dps = 8, range = 10, yieldMultiplier = 1 } = {}) {
    super();
    this.count = count;
    this.dps = dps;
    this.range = range;
    this.yieldMultiplier = yieldMultiplier;
  }

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) return;
    const t = this.entity.get('TransformComponent');
    if (!t) return;
    const asteroids = ctx.world.query('asteroid') || [];
    const gateCrystals = ctx.world.query('gate_crystal') || [];
    if (!asteroids.length && !gateCrystals.length) return;
    const r2 = this.range * this.range;
    const inRange = [];
    for (const a of asteroids) {
      if (!a.active) continue;
      const at = a.get('TransformComponent'); if (!at) continue;
      const d2 = at.position.distanceToSquared(t.position);
      if (d2 <= r2) inRange.push({ entity: a, d2 });
    }
    for (const c of gateCrystals) {
      if (!c.active) continue;
      const ct = c.get('TransformComponent'); if (!ct) continue;
      const d2 = ct.position.distanceToSquared(t.position);
      if (d2 <= r2) inRange.push({ entity: c, d2 });
    }
    inRange.sort((a, b) => a.d2 - b.d2);
    const dmg = this.dps * dt;
    for (let i = 0; i < Math.min(this.count, inRange.length); i++) {
      const h = inRange[i].entity.get('HealthComponent');
      if (h) h.takeDamage(dmg);
    }
  }
}
