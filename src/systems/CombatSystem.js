import * as THREE from 'three';
import { PLAYER } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

export class CombatSystem {
  constructor(projectilePool, collisionSystem) {
    this._pool = projectilePool;
    this._collision = collisionSystem;
    this._attackTimer = 0;
    this._clickCooldown = 0;
    this._contactCooldowns = new Map(); // enemyId -> timer
    this._enemies = [];
    this._lootDrops = [];
  }

  setEnemies(enemies) { this._enemies = enemies; }
  setLootDrops(drops) { this._lootDrops = drops; }

  _findNearestEnemy(playerPos) {
    let nearest = null;
    let minDist = Infinity;
    for (const e of this._enemies) {
      if (!e.active) continue;
      const d = e.group.position.distanceTo(playerPos);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  _calcDamage(computed) {
    const isCrit = Math.random() < computed.critChance;
    const dmg = computed.damage * (isCrit ? computed.critMultiplier : 1);
    return { damage: Math.ceil(dmg), isCrit };
  }

  _getDirection(from, to) {
    return new THREE.Vector3().subVectors(to, from).normalize();
  }

  update(delta, state, computed, ship, audioManager) {
    if (!state || state.round.phase !== 'combat') return;

    const playerPos = ship.group.position;

    // ---- Auto-attack ----
    this._attackTimer += delta;
    const fireRate = 1 / computed.attackSpeed;
    if (this._attackTimer >= fireRate) {
      this._attackTimer = 0;
      const target = this._findNearestEnemy(playerPos);
      if (target) {
        for (let i = 0; i < computed.projectileCount; i++) {
          const { damage, isCrit } = this._calcDamage(computed);

          // Spread for multi-shot
          const baseDir = this._getDirection(playerPos, target.group.position);
          if (computed.projectileCount > 1) {
            const spread = (i / (computed.projectileCount - 1) - 0.5) * 0.4;
            baseDir.x += spread;
            baseDir.normalize();
          }

          this._pool.spawn(
            playerPos.clone().add(new THREE.Vector3(0, 0, -0.5)),
            baseDir,
            damage,
            isCrit,
            computed.projectileType,
            true,
            computed.isHoming ? target : null
          );
        }
        if (audioManager) {
          const w = computed.projectileType;
          audioManager.play(w === 'missile' ? 'missile' : w === 'plasma' ? 'plasma' : 'laser');
        }
        eventBus.emit(EVENTS.PROJECTILE_FIRED);
      }
    }

    // ---- Click cooldown ----
    if (this._clickCooldown > 0) {
      this._clickCooldown -= delta;
    }

    // ---- Collision: player projectiles vs enemies ----
    const hits = this._collision.checkProjectilesVsEnemies(
      this._pool.active, this._enemies
    );
    for (const { projectile, enemy } of hits) {
      const { damage, isCrit } = { damage: projectile.damage, isCrit: projectile.isCrit };

      // Apply armor
      const effectiveDmg = Math.max(1, damage - (computed.armor || 0));

      const died = enemy.takeDamage(effectiveDmg);
      projectile.deactivate();

      eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage: effectiveDmg, isCrit });

      if (died) {
        // Vampiric heal
        if (computed.hasVampire) {
          const healAmt = Math.ceil(effectiveDmg * 0.02);
          eventBus.emit(EVENTS.PLAYER_HEALED, { amount: healAmt });
        }
        eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
        if (audioManager) {
          audioManager.play(enemy.type === 'boss' ? 'bossExplosion' : 'explosion');
        }
      } else {
        if (audioManager) {
          audioManager.play(isCrit ? 'crit' : 'hit');
        }
      }
    }

    // ---- Contact damage: enemies reaching player ----
    const contacts = this._collision.checkEnemyContact(
      this._enemies, playerPos, PLAYER.COLLISION_RADIUS
    );
    for (const enemy of contacts) {
      const cooldown = this._contactCooldowns.get(enemy.id) || 0;
      if (cooldown <= 0) {
        let dmg = enemy.contactDamage;
        // Damage reflect
        if (computed.hasDamageReflect) {
          enemy.takeDamage(Math.ceil(dmg * 0.2));
          if (!enemy.active) eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
        }
        dmg = Math.max(1, dmg - computed.armor);
        eventBus.emit(EVENTS.PLAYER_DAMAGED, { amount: dmg, source: 'contact' });
        this._contactCooldowns.set(enemy.id, 1.0);
        if (audioManager) audioManager.play('playerDamage');
      } else {
        this._contactCooldowns.set(enemy.id, cooldown - delta);
      }
    }

    // ---- Loot collection ----
    const collected = this._collision.checkLootVsPlayer(
      this._lootDrops, playerPos, computed.magnetRange
    );
    for (const loot of collected) {
      loot.collect();
      eventBus.emit(EVENTS.LOOT_COLLECTED, {
        currencyType: loot.currencyType,
        amount: loot.amount,
      });
      if (audioManager) {
        audioManager.play(loot.currencyType === 'darkMatter' ? 'rarePickup' : 'pickup');
      }
    }
  }

  // Called on mouse click
  handleClick(mouseX, mouseY, state, computed, ship, camera) {
    if (!state || state.round.phase !== 'combat') return;
    if (this._clickCooldown > 0) return;

    const target = this._findNearestEnemy(ship.group.position);
    if (!target) return;

    this._clickCooldown = PLAYER.CLICK_COOLDOWN;
    const { damage, isCrit } = this._calcDamage(computed);
    const dir = this._getDirection(ship.group.position, target.group.position);

    this._pool.spawn(
      ship.group.position.clone().add(new THREE.Vector3(0, 0, -0.5)),
      dir, damage, isCrit, computed.projectileType, true, null
    );
    eventBus.emit(EVENTS.PROJECTILE_FIRED);
  }
}
