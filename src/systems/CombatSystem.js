import * as THREE from 'three';
import { PLAYER } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

export class CombatSystem {
  constructor(projectilePool, collisionSystem) {
    this._pool = projectilePool;
    this._collision = collisionSystem;
    this._attackTimer = 0;
    this._extraWeaponTimers = {}; // weaponType -> timer
    this._clickCooldown = 0;
    this._contactCooldowns = new Map(); // enemyId -> timer
    this._enemies = [];
    this._lootDrops = [];
    this._stellarNovaTimer = 0;

    // Handle AoE damage emitted by upgrade triggers
    eventBus.on('trigger:emit_damage', ({ position, amount, radius }) => {
      this._handleAoeDamage(position, amount, radius);
    });

    eventBus.on(EVENTS.ROUND_STARTED, () => {
      this._stellarNovaTimer = 0;
    });
  }

  _handleAoeDamage(position, amount, radius) {
    if (!position) return;
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      if (enemy.group.position.distanceTo(position) <= radius) {
        const died = enemy.takeDamage(Math.ceil(amount));
        if (died) eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
      }
    }
  }

  // Slower fire-rate multipliers for secondary weapons (higher = slower)
  static EXTRA_WEAPON_RATE = { laser: 1.5, missile: 2.5, plasma: 3.0 };

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
    const fireRate = 1 / computed.attackSpeed;

    // ---- Advance all timers ----
    this._attackTimer += delta;
    for (const weaponType of (computed.extraWeapons || [])) {
      if (this._extraWeaponTimers[weaponType] === undefined) {
        this._extraWeaponTimers[weaponType] = 0;
      }
      this._extraWeaponTimers[weaponType] += delta;
    }

    // ---- Find nearest enemy once ----
    const target = this._findNearestEnemy(playerPos);

    // ---- Stellar Nova (periodic AoE + one-shot visuals) ----
    if (computed.stellarNovaLevel > 0 && computed.stellarNovaInterval > 0) {
      this._stellarNovaTimer += delta;
      if (this._stellarNovaTimer >= computed.stellarNovaInterval) {
        this._stellarNovaTimer = 0;
        this._handleAoeDamage(
          playerPos,
          computed.stellarNovaDamage,
          computed.stellarNovaRadius
        );
        eventBus.emit(EVENTS.STELLAR_NOVA, { radius: computed.stellarNovaRadius });
      }
    }

    // ---- Primary auto-attack ----
    if (this._attackTimer >= fireRate) {
      this._attackTimer = 0;
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

    // ---- Extra weapons (laser_type / missile_type / plasma_type nodes) ----
    if (target && computed.extraWeapons && computed.extraWeapons.length > 0) {
      for (const weaponType of computed.extraWeapons) {
        const rateMultiplier = CombatSystem.EXTRA_WEAPON_RATE[weaponType] ?? 2.0;
        const extraFireRate = fireRate * rateMultiplier;
        if (this._extraWeaponTimers[weaponType] >= extraFireRate) {
          this._extraWeaponTimers[weaponType] = 0;
          const { damage, isCrit } = this._calcDamage(computed);
          const spawnPos = ship.getTurretWorldPosition(weaponType);
          const dir = this._getDirection(spawnPos, target.group.position);
          this._pool.spawn(
            spawnPos,
            dir,
            damage,
            isCrit,
            weaponType,
            true,
            weaponType === 'missile' ? target : null
          );
          if (audioManager) {
            audioManager.play(weaponType === 'missile' ? 'missile' : weaponType === 'plasma' ? 'plasma' : 'laser');
          }
        }
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

      // Apply armor then per-enemy damage received multiplier (from upgrades)
      const effectiveDmg = Math.max(1, Math.ceil(
        (damage - (computed.armor || 0)) * (enemy.damageReceivedMult ?? 1)
      ));

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
