import * as THREE from 'three';
import { PLAYER, MANUAL_GUN } from '../constants.js';
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
    this._currentTarget = null;

    // Manual gun heat system
    this._manualHeat = 0;
    this._isOverheated = false;
    this._overheatCooldownTimer = 0;
    this._manualFireCooldown = 0;
    this._enemyShotDir = new THREE.Vector3();
    this._enemyShotSpawn = new THREE.Vector3();

    // Repulser
    this._repulserTimer = 0;

    // Phoenix Drive revival
    this._phoenixCooldownRemaining = 0;

    // EMP stun tracking
    this._empStunRemaining = 0;

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

  _findNearestEnemy(playerPos, targetingRange = Infinity) {
    let nearest = null;
    let minDist = Infinity;
    for (const e of this._enemies) {
      if (!e.active) continue;
      const d = e.group.position.distanceTo(playerPos);
      if (d < minDist && d <= targetingRange) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  /**
   * Manual focus (from Priority Designator) overrides nearest-in-range until that enemy dies.
   * @param {object[]} enemies
   * @param {THREE.Vector3} playerPos
   * @param {object} computed
   * @param {{ manualFocusEnemyId?: string | null }} [round]
   */
  static resolveCombatTarget(enemies, playerPos, computed, round) {
    const range = computed?.targetingRange ?? Infinity;
    const manualId =
      computed?.manualTargetFocusEnabled && round?.manualFocusEnemyId
        ? round.manualFocusEnemyId
        : null;
    if (manualId) {
      const focused = enemies.find(e => e.active && e.id === manualId);
      if (focused) return focused;
      if (round) round.manualFocusEnemyId = null;
    }
    let nearest = null;
    let minDist = Infinity;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = e.group.position.distanceTo(playerPos);
      if (d < minDist && d <= range) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  _updateTarget(newTarget) {
    if (newTarget === this._currentTarget) return;
    if (this._currentTarget) this._currentTarget.setTargeted(false);
    if (newTarget) newTarget.setTargeted(true);
    this._currentTarget = newTarget;
  }

  _calcDamage(computed, state) {
    let dmg = computed.damage;

    // Resonance Field: +5% damage per 10 kills this run, per level
    if (computed.resonanceFieldLevel > 0 && state?.round) {
      const stacks = Math.floor((state.round.killsThisRun || 0) / 10);
      dmg *= 1 + Math.min(0.5, stacks * 0.05 * computed.resonanceFieldLevel);
    }

    // Active temporary boosts (e.g. Berserker Protocol)
    for (const boost of (computed.activeBoosts || [])) {
      if (boost.stat === 'damage') dmg *= boost.multiplier;
    }

    const isCrit = Math.random() < computed.critChance;
    return { damage: Math.ceil(dmg * (isCrit ? computed.critMultiplier : 1)), isCrit };
  }

  _getDirection(from, to) {
    return new THREE.Vector3().subVectors(to, from).normalize();
  }

  /**
   * Fire the manual cannon straight ahead (-Z). Called from input handlers.
   * Manages heat resource; no-ops when overheated or in non-combat phase.
   */
  fireManualGun(state, computed, ship, audioManager) {
    if (!state || state.round.phase !== 'combat') return;
    if (this._isOverheated || this._manualFireCooldown > 0) return;

    this._manualFireCooldown = MANUAL_GUN.FIRE_COOLDOWN;
    const heatMult = computed?.manualGunHeatPerShotMult ?? 1;
    this._manualHeat += MANUAL_GUN.HEAT_PER_SHOT * heatMult;

    const heatRatio = this._manualHeat / MANUAL_GUN.HEAT_MAX;

    // Play shot sound pitched up based on heat — cool=0.85x, max heat=1.45x
    if (audioManager) {
      const pitchRate = 0.85 + heatRatio * 0.6;
      audioManager.playAtRate('manualShot', pitchRate);
    }

    if (this._manualHeat >= MANUAL_GUN.HEAT_MAX) {
      this._manualHeat = MANUAL_GUN.HEAT_MAX;
      this._isOverheated = true;
      const ohMult = computed?.manualGunOverheatDurationMult ?? 1;
      this._overheatCooldownTimer = MANUAL_GUN.OVERHEAT_DURATION * ohMult;
      if (audioManager) audioManager.play('manualOverheat');
    }

    const pos = ship.group.position.clone();
    pos.z -= 1.0; // muzzle offset
    const dir = new THREE.Vector3(0, 0, -1);
    const dmg = computed?.damage ?? PLAYER.BASE_DAMAGE;
    const pierces = computed?.projectilePierces ?? 0;

    this._pool.spawn(pos, dir, dmg, false, 'manual', true, null, pierces, heatRatio);
    eventBus.emit(EVENTS.MANUAL_FIRED);
  }

  /** Returns current heat state for HUD display. */
  getHeatState() {
    return {
      heat: this._manualHeat,
      max: MANUAL_GUN.HEAT_MAX,
      overheated: this._isOverheated,
    };
  }

  update(delta, state, computed, ship, audioManager) {
    if (!state || state.round.phase !== 'combat') {
      this._updateTarget(null);
      return;
    }

    // ---- Manual gun heat tick (always runs during combat) ----
    this._manualHeat = Math.max(0, this._manualHeat - MANUAL_GUN.HEAT_COOL_RATE * delta);
    this._manualFireCooldown = Math.max(0, this._manualFireCooldown - delta);
    if (this._isOverheated) {
      this._overheatCooldownTimer -= delta;
      if (this._overheatCooldownTimer <= 0) {
        this._isOverheated = false;
        this._manualHeat = 0;
      }
    }

    // ---- Energy tick ----
    const netEnergy = computed.energyRegen - computed.energyDrain;
    state.player.energy = Math.max(0, Math.min(computed.maxEnergy,
      state.player.energy + netEnergy * delta));

    // ---- EMP stun tick ----
    if (this._empStunRemaining > 0) {
      this._empStunRemaining = Math.max(0, this._empStunRemaining - delta);
    }

    const playerPos = ship.group.position;
    // Store player world position for trigger actions (e.g. reactive_plating emit_damage)
    state._playerWorldPos = playerPos;

    // Apply attackSpeed activeBoosts to fire rate
    let fireRate = 1 / computed.attackSpeed;
    for (const boost of (computed.activeBoosts || [])) {
      if (boost.stat === 'attackSpeed') fireRate /= boost.multiplier;
    }

    // (fireRate now declared above with boost application)

    // ---- Advance auto-weapon timers (manual nose cannon is separate) ----
    if (computed.hasAutoFire) {
      this._attackTimer += delta;
      for (const weaponType of (computed.extraWeapons || [])) {
        if (this._extraWeaponTimers[weaponType] === undefined) {
          this._extraWeaponTimers[weaponType] = 0;
        }
        this._extraWeaponTimers[weaponType] += delta;
      }
    }

    const target = CombatSystem.resolveCombatTarget(
      this._enemies,
      playerPos,
      computed,
      state.round
    );
    this._updateTarget(target);

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

    // ---- Repulser tick ----
    if (computed.repulserActive) {
      this._repulserTimer += delta;
      if (this._repulserTimer >= computed.repulserInterval) {
        this._repulserTimer = 0;
        this._fireRepulser(playerPos, computed);
      }
    }

    // ---- Primary auto-attack ----
    if (computed.hasAutoFire && this._attackTimer >= fireRate) {
      this._attackTimer = 0;
      if (target) {
        const pierces = computed.projectilePierces || 0;
        for (let i = 0; i < computed.projectileCount; i++) {
          const { damage, isCrit } = this._calcDamage(computed, state);

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
            computed.isHoming ? target : null,
            pierces
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
    if (computed.hasAutoFire && target && computed.extraWeapons && computed.extraWeapons.length > 0) {
      for (const weaponType of computed.extraWeapons) {
        if (weaponType === 'beam') continue; // handled by BeamLaserSystem
        const rateMultiplier = CombatSystem.EXTRA_WEAPON_RATE[weaponType] ?? 2.0;
        const extraFireRate = fireRate * rateMultiplier;
        if (this._extraWeaponTimers[weaponType] >= extraFireRate) {
          this._extraWeaponTimers[weaponType] = 0;
          const { damage, isCrit } = this._calcDamage(computed, state);
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

    // ---- Enemy ranged attacks (attackSpeed > 0, e.g. sniper) ----
    // Same band as Enemy keepRange AI: hold between _keepRangeDist and _keepRangeDist + 4.
    const KEEP_RANGE_OUTER = 4;
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      const asp = enemy.attackSpeed || 0;
      if (asp <= 0) continue;
      if (!enemy.group.visible) continue;

      const ex = enemy.group.position.x;
      const ey = enemy.group.position.y;
      const ez = enemy.group.position.z;
      const pz = playerPos.z ?? 0;
      const dx = playerPos.x - ex;
      const dz = pz - ez;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const rMin = enemy._keepRangeDist;
      const rMax = enemy._keepRangeDist + KEEP_RANGE_OUTER;
      if (dist < rMin || dist > rMax) continue;

      enemy._attackTimer += delta;
      const interval = 1 / asp;
      if (enemy._attackTimer < interval) continue;
      enemy._attackTimer -= interval;

      this._enemyShotDir.set(dx, 0, dz);
      if (this._enemyShotDir.lengthSq() < 0.0001) continue;
      this._enemyShotDir.normalize();

      this._enemyShotSpawn.set(ex, ey + 0.2, ez);
      this._pool.spawn(
        this._enemyShotSpawn,
        this._enemyShotDir,
        enemy.damage,
        false,
        'enemy',
        false,
        null,
        0
      );
      if (audioManager) audioManager.play('plasma');
    }

    // ---- Collision: player projectiles vs enemies ----
    const hits = this._collision.checkProjectilesVsEnemies(
      this._pool.active, this._enemies
    );
    for (const { projectile, enemy } of hits) {
      const isCrit = projectile.isCrit;

      // Apply armor then per-enemy damage received multiplier (from upgrades)
      const effectiveDmg = Math.max(1, Math.ceil(
        (projectile.damage - (computed.armor || 0)) * (enemy.damageReceivedMult ?? 1)
      ));

      const died = enemy.takeDamage(effectiveDmg);

      // Piercing: mark enemy hit and decrement counter; non-piercing: deactivate
      if (projectile.piercesLeft > 0) {
        projectile._hitEnemies.add(enemy.id);
        projectile.piercesLeft--;
      } else {
        projectile.deactivate();
      }

      eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage: effectiveDmg, isCrit });

      if (died) {
        if (computed.hasVampire) {
          eventBus.emit(EVENTS.PLAYER_HEALED, { amount: Math.ceil(effectiveDmg * 0.02) });
        }
        if (computed.salvagingBeamActive && state.player.energy > 0) {
          const healRatio = computed.salvagingBeamHealRatio ?? 0.05;
          const heal = Math.max(1, Math.ceil(effectiveDmg * healRatio * computed.salvagingBeamCount));
          eventBus.emit(EVENTS.PLAYER_HEALED, { amount: heal });
        }
        eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
        if (audioManager) audioManager.play(enemy.type === 'boss' ? 'bossExplosion' : 'explosion');
      } else {
        if (audioManager) audioManager.play(isCrit ? 'crit' : 'hit');
      }
    }

    // ---- Enemy projectiles vs player ----
    const enemyProjHits = this._collision.checkEnemyProjectilesVsPlayer(
      this._pool.active,
      playerPos,
      PLAYER.COLLISION_RADIUS
    );
    for (const proj of enemyProjHits) {
      const dmg = Math.max(1, Math.ceil(proj.damage - (computed.armor || 0)));
      eventBus.emit(EVENTS.PLAYER_DAMAGED, { amount: dmg, source: 'enemyProjectile' });
      proj.deactivate();
    }

    // ---- Contact damage: enemies reaching player ----
    const contacts = this._collision.checkEnemyContact(
      this._enemies, playerPos, PLAYER.COLLISION_RADIUS
    );
    for (const enemy of contacts) {
      if (!enemy.active) continue;
      // Ranged attackers only hurt via projectiles
      if ((enemy.attackSpeed || 0) > 0) continue;

      // Melee dies on first hit; bosses keep pulsing contact damage.
      const meleeSuicide = enemy.type !== 'boss';

      const cooldown = this._contactCooldowns.get(enemy.id) || 0;
      if (cooldown <= 0) {
        let dmg = enemy.contactDamage;
        if (computed.hasDamageReflect) {
          enemy.takeDamage(Math.ceil(dmg * 0.2));
          if (!enemy.active) {
            eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
            this._contactCooldowns.delete(enemy.id);
            continue;
          }
        }
        dmg = Math.max(1, dmg - computed.armor);
        eventBus.emit(EVENTS.PLAYER_DAMAGED, { amount: dmg, source: 'contact' });
        if (audioManager) audioManager.play('playerDamage');

        if (meleeSuicide) {
          const suicideDmg = enemy.hp;
          const died = enemy.takeDamage(suicideDmg);
          if (died) {
            eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage: suicideDmg, isCrit: false });
            if (computed.hasVampire) {
              eventBus.emit(EVENTS.PLAYER_HEALED, { amount: Math.ceil(suicideDmg * 0.02) });
            }
            eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
            if (audioManager) audioManager.play('explosion');
          }
          this._contactCooldowns.delete(enemy.id);
        } else {
          this._contactCooldowns.set(enemy.id, 1.0);
        }
      } else {
        this._contactCooldowns.set(enemy.id, cooldown - delta);
      }
    }

    // ---- Corrosive Aura: continuous damage to enemies within magnet range ----
    if (computed.corrosiveAuraDps > 0) {
      const auraRadius = computed.magnetRange;
      for (const enemy of this._enemies) {
        if (!enemy.active) continue;
        if (enemy.group.position.distanceTo(playerPos) <= auraRadius) {
          const dmg = Math.max(1, Math.ceil(computed.corrosiveAuraDps * delta));
          const died = enemy.takeDamage(dmg);
          eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage: dmg, isCrit: false });
          if (died) {
            eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
            if (audioManager) audioManager.play('explosion');
          }
        }
      }
    }

    // ---- Gravity Well: slow enemies within magnet range ----
    if (computed.gravityWellActive) {
      const gwRadius = computed.magnetRange;
      for (const enemy of this._enemies) {
        if (!enemy.active) continue;
        if (enemy.group.position.distanceTo(playerPos) <= gwRadius) {
          enemy.applyStatus('slow', { mult: 0.45, duration: 0.25 });
        }
      }
    }

    // ---- EMP: stun active (slow all enemies to near-zero speed) ----
    if (this._empStunRemaining > 0) {
      for (const enemy of this._enemies) {
        if (!enemy.active) continue;
        enemy.applyStatus('slow', { mult: 0.02, duration: 0.1 });
      }
    }

    // ---- Loot collection ----
    const collected = this._collision.checkLootVsPlayer(
      this._lootDrops, playerPos, PLAYER.COLLISION_RADIUS
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

  /** Repulser: push enemies away from playerPos and deal damage. */
  _fireRepulser(playerPos, computed) {
    const radius = computed.repulserRadius;
    const dmg = computed.repulserDamage;
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      const dist = enemy.group.position.distanceTo(playerPos);
      if (dist > radius) continue;

      // Push enemy away
      const dir = enemy.group.position.clone().sub(playerPos);
      if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
      dir.normalize();
      enemy.group.position.addScaledVector(dir, radius * 0.5);

      // Deal damage if configured
      if (dmg > 0) {
        const died = enemy.takeDamage(dmg);
        eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage: dmg, isCrit: false });
        if (died) eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
      }
    }
  }

  /** Trigger EMP stun: freeze all enemies for `duration` seconds. */
  triggerEmp(duration, damage) {
    this._empStunRemaining = duration;
    if (damage > 0) {
      for (const enemy of this._enemies) {
        if (!enemy.active) continue;
        const died = enemy.takeDamage(damage);
        eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage, isCrit: false });
        if (died) eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
      }
    }
  }

}
