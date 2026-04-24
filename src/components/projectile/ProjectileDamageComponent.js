import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/**
 * Wires ColliderComponent.onHit → damage path → destroy/pierce/etc.
 * The projectile prefab attaches this + ColliderComponent + Transform + Mesh.
 */
export class ProjectileDamageComponent extends Component {
  constructor({
    damage = 1,
    isCrit = false,
    isPlayerProjectile = true,
    pierces = 0,
    onKillHealAmount = null,
    onKill = null,
    damageType = 'kinetic',
    stripShieldsOnPlayerHit = false,
  } = {}) {
    super();
    this.damage = damage;
    this.isCrit = isCrit;
    this.isPlayerProjectile = isPlayerProjectile;
    this.piercesLeft = pierces;
    this._hitEntities = new Set();
    this._onKillHeal = onKillHealAmount;
    this._onKill = onKill;
    /** @type {'kinetic'|'laser'|'plasma'|'missile'} */
    this.damageType = damageType;
    this.stripShieldsOnPlayerHit = stripShieldsOnPlayerHit;
  }

  onAttach() {
    const col = this.entity.get('ColliderComponent');
    if (!col) return;

    col.shouldCollide = (other) => !this._hitEntities.has(other.id);

    col.onHit = (other, ctx) => {
      const health = other.get('HealthComponent');
      if (!health || health.dead) return;

      if (this.isPlayerProjectile) {
        let dmg = this.damage;
        const ps = ctx.playerEntity?.get('PlayerStatsComponent');
        if (ps) dmg *= (ps.projectileDampenMult ?? 1);

        if (other.enemyType === 'mirror_drone' && this.damageType === 'laser') {
          const through = Math.max(1, Math.ceil(dmg * 0.2));
          const bounce = Math.max(1, dmg - through);
          health.takeDamage(through, { isCrit: this.isCrit, source: this.entity, damageType: this.damageType });
          const pt = ctx.playerEntity?.get('TransformComponent');
          const ot = other.get('TransformComponent');
          if (pt && ot && bounce > 0) {
            const dir = new THREE.Vector3().subVectors(pt.position, ot.position).setY(0).normalize();
            ctx.world.spawn(createProjectile({
              position: ot.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
              direction: dir,
              type: 'laser',
              damage: bounce,
              isCrit: false,
              isPlayer: false,
              damageType: 'laser',
            }));
          }
          this._hitEntities.add(other.id);
          if (this.piercesLeft > 0) this.piercesLeft--;
          else this.entity.destroy();
          return;
        }

        const dealt = health.takeDamage(dmg, {
          isCrit: this.isCrit, source: this.entity, damageType: this.damageType,
        });
        if (ctx?.audio) {
          if (health.dead) ctx.audio.play('explosion');
          else ctx.audio.play(this.isCrit ? 'crit' : 'hit');
        }
        if (health.dead) {
          if (this._onKillHeal != null && ctx?.playerEntity) {
            const pH = ctx.playerEntity.get('HealthComponent');
            if (pH) {
              const heal = Math.max(1, Math.ceil(dealt * this._onKillHeal));
              pH.heal(heal);
              eventBus.emit(EVENTS.PLAYER_HEALED, { amount: heal });
            }
          }
          if (typeof this._onKill === 'function') this._onKill(other, ctx);
        }
      } else {
        // Enemy projectile hitting player
        if (!other.hasTag('player')) return;
        if (this.stripShieldsOnPlayerHit) {
          const sh = other.get('ShieldComponent');
          if (sh && sh.maxHp > 0) sh.hp = 0;
        }
        const shield = other.get('ShieldComponent');
        const remaining = shield ? shield.absorb(this.damage) : this.damage;
        if (remaining > 0) health.takeDamage(remaining, { source: 'enemyProjectile' });
        else if (ctx?.audio) ctx.audio.play('shieldHit');
      }

      this._hitEntities.add(other.id);
      if (this.piercesLeft > 0) {
        this.piercesLeft--;
      } else {
        this.entity.destroy();
      }
    };
  }
}
