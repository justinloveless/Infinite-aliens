import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Ranged attacker for bosses. Fires from any range (unlike RangedAttackerComponent
 * which is range-banded). Supports four attack patterns:
 *
 *   single — one aimed shot
 *   burst  — three shots in rapid succession (0.12 s apart)
 *   spread — three shots in a 30° fan
 *   spray  — five shots in a 50° fan
 */
export class BossAttackerComponent extends Component {
  constructor({ attackSpeed = 0.4, damage = 5, pattern = 'single', minRange = 3 } = {}) {
    super();
    this.attackSpeed = attackSpeed;
    this.damage = damage;
    this.pattern = pattern;
    this.minRange = minRange;
    this._timer = attackSpeed > 0 ? Math.random() / attackSpeed : 0;
    this._burstQueue = 0;
    this._burstTimer = 0;
  }

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) return;
    const t = this.entity.get('TransformComponent');
    const playerT = ctx.playerEntity?.get('TransformComponent');
    if (!t || !playerT) return;

    const dx = playerT.position.x - t.position.x;
    const dz = playerT.position.z - t.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < this.minRange) return;

    // Drain burst queue first — fire one shot per 0.12 s
    if (this._burstQueue > 0) {
      this._burstTimer += dt;
      if (this._burstTimer >= 0.12) {
        this._burstTimer = 0;
        this._burstQueue--;
        this._fire(t.position, playerT.position, ctx);
      }
      return;
    }

    this._timer += dt;
    const interval = 1 / this.attackSpeed;
    if (this._timer < interval) return;
    this._timer -= interval;

    if (this.pattern === 'burst') {
      this._fire(t.position, playerT.position, ctx);
      this._burstQueue = 2;
      this._burstTimer = 0;
    } else {
      this._fire(t.position, playerT.position, ctx);
    }
  }

  _fire(fromPos, toPos, ctx) {
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) return;
    const base = new THREE.Vector3(dx / len, 0, dz / len);
    const spawn = fromPos.clone();
    spawn.y += 0.5;
    for (const dir of this._directions(base)) {
      ctx.world.spawn(createProjectile({
        position: spawn.clone(), direction: dir,
        type: 'enemy', damage: this.damage,
        isPlayer: false, damageType: 'kinetic',
      }));
    }
    if (ctx.audio) ctx.audio.play('plasma');
  }

  _directions(base) {
    switch (this.pattern) {
      case 'spread': {
        const a = Math.PI / 12; // ±15°
        return [rotY(base, -a), base.clone(), rotY(base, a)];
      }
      case 'spray': {
        const half = Math.PI / 7.2; // ±25°
        return Array.from({ length: 5 }, (_, i) =>
          rotY(base, -half + (i / 4) * half * 2));
      }
      default:
        return [base.clone()];
    }
  }
}

function rotY(dir, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new THREE.Vector3(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c).normalize();
}
