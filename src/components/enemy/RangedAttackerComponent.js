import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Enemies with `attackSpeed > 0` fire plasma-like projectiles at the player
 * when the player is within the keep-range band (same band as the keepRange
 * behavior).
 */
export class RangedAttackerComponent extends Component {
  constructor({ attackSpeed = 0.5, damage = 5, keepDist = 12, outerBand = 4, stripShieldsOnPlayerHit = false } = {}) {
    super();
    this.attackSpeed = attackSpeed;
    this.damage = damage;
    this.keepDist = keepDist;
    this.outerBand = outerBand;
    this.stripShieldsOnPlayerHit = stripShieldsOnPlayerHit;
    this._timer = attackSpeed > 0 ? Math.random() / attackSpeed : 0;
  }

  update(dt, ctx) {
    if (!isCombatPhase(ctx?.state?.round?.phase)) return;
    const t = this.entity.get('TransformComponent');
    const playerT = ctx.playerEntity?.get('TransformComponent');
    if (!t || !playerT) return;

    const dx = playerT.position.x - t.position.x;
    const dz = playerT.position.z - t.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < this.keepDist || dist > this.keepDist + this.outerBand) return;

    this._timer += dt;
    const interval = 1 / this.attackSpeed;
    if (this._timer < interval) return;
    this._timer -= interval;

    const dir = new THREE.Vector3(dx, 0, dz);
    if (dir.lengthSq() < 0.0001) return;
    dir.normalize();
    const spawn = t.position.clone(); spawn.y += 0.2;

    ctx.world.spawn(createProjectile({
      position: spawn, direction: dir, type: 'enemy',
      damage: this.damage, isPlayer: false,
      damageType: 'kinetic',
      stripShieldsOnPlayerHit: this.stripShieldsOnPlayerHit,
    }));
    if (ctx.audio) ctx.audio.play('plasma');
  }
}
