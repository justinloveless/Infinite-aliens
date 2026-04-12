import { ROUND } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

const VACUUM_ATTRACTION = 88;
const VACUUM_MAX_SEC = 2.0;
import { EnemyFactory } from '../entities/EnemyFactory.js';
import { LootDrop } from '../entities/LootDrop.js';
import { Explosion } from '../entities/Explosion.js';

export class RoundSystem {
  constructor(currencySystem) {
    this._currency = currencySystem;
    this._factory = new EnemyFactory();
    this._enemies = [];
    this._lootDrops = [];
    this._explosions = [];
    this._spawnTimer = 0;
    this._spawnedThisRound = 0;
    this._transitionTimer = 0;
    this._scene = null;
    this._state = null;
    this._onRoundComplete = null;
    this._onRoundStart = null;
    this._vacuumTimer = 0;
    this._unsubEnemyKilled = null;
  }

  init(state, scene, onRoundComplete, onRoundStart) {
    if (this._unsubEnemyKilled) {
      this._unsubEnemyKilled();
      this._unsubEnemyKilled = null;
    }
    this._state = state;
    this._scene = scene;
    this._onRoundComplete = onRoundComplete;
    this._onRoundStart = onRoundStart;

    const onKilled = ({ enemy }) => this._onEnemyKilled(enemy);
    this._unsubEnemyKilled = eventBus.on(EVENTS.ENEMY_KILLED, onKilled);
  }

  /** Remove combat entities from the scene without awarding loot (e.g. debug reset). */
  purgeCombatWorld() {
    this._clearEnemies();
    this._clearLoot();
    for (const exp of this._explosions) {
      exp.destroy();
    }
    this._explosions.length = 0;
    this._spawnTimer = 0;
    this._spawnedThisRound = 0;
    this._vacuumTimer = 0;
    this._transitionTimer = 0;
  }

  startRound(round) {
    const state = this._state;
    state.round.current = round;
    state.round.phase = 'combat';
    state.round.enemiesDefeated = 0;
    state.round.enemiesRequired = this._calcRequired(round);
    state.roundLoot = {};
    this._spawnedThisRound = 0;
    this._spawnTimer = 0;
    this._vacuumTimer = 0;
    this._clearLoot();
    eventBus.emit(EVENTS.ROUND_STARTED, { round });
    if (this._onRoundStart) this._onRoundStart(round);
  }

  _calcRequired(round) {
    return Math.floor(ROUND.BASE_ENEMIES * Math.pow(ROUND.ENEMY_SCALING, round - 1));
  }

  _calcMaxConcurrent(round, computed) {
    const base = Math.min(5 + Math.floor(round / 4), ROUND.MAX_CONCURRENT_ENEMIES);
    const mult = computed?.roundModifiers?.maxConcurrent ?? 1.0;
    return Math.round(base * mult);
  }

  _calcSpawnInterval(round, computed) {
    const base = Math.max(ROUND.SPAWN_INTERVAL_MIN, ROUND.SPAWN_INTERVAL_BASE - round * 0.05);
    const mult = computed?.roundModifiers?.spawnInterval ?? 1.0;
    return Math.max(ROUND.SPAWN_INTERVAL_MIN, base * mult);
  }

  _isBossRound(round) {
    return round % 5 === 0;
  }

  _onEnemyKilled(enemy) {
    const state = this._state;
    if (state.round.phase !== 'combat') return;

    // Loot — apply global multiplier and per-currency loot rates
    const lootMult = this._state._computed?.lootMultiplier || 1.0;
    const lootRates = this._state._computed?.lootRates || null;
    const drops = this._currency.generateLoot(enemy, lootMult, lootRates);
    for (const drop of drops) {
      const loot = new LootDrop(
        enemy.group.position.clone(),
        drop.currency,
        drop.amount,
        this._scene
      );
      this._lootDrops.push(loot);
    }

    // Explosion
    const color = enemy.type === 'boss' ? 0xaa00ff : 0xff6600;
    const scale = enemy.type === 'boss' ? 2.5 : (enemy.type === 'tank' ? 1.5 : 1.0);
    const exp = new Explosion(enemy.group.position.clone(), color, scale, this._scene);
    this._explosions.push(exp);

    enemy.remove(this._scene);
    const idx = this._enemies.indexOf(enemy);
    if (idx !== -1) this._enemies.splice(idx, 1);

    state.round.enemiesDefeated++;
    state.round.totalEnemiesDefeated++;

    if (state.round.enemiesDefeated >= state.round.enemiesRequired) {
      this._beginVacuum();
    }
  }

  _beginVacuum() {
    const state = this._state;
    state.round.phase = 'vacuum';
    this._vacuumTimer = 0;
    this._clearEnemies();
  }

  _beginTransition() {
    const state = this._state;
    state.round.phase = 'transition';
    this._transitionTimer = 0;
    eventBus.emit(EVENTS.ROUND_COMPLETE, {
      round: state.round.current,
      loot: { ...state.roundLoot },
    });
    if (this._onRoundComplete) this._onRoundComplete(state.round.current, state.roundLoot);
  }

  _clearEnemies() {
    for (const e of this._enemies) {
      e.remove(this._scene);
    }
    this._enemies.length = 0;
  }

  _clearLoot() {
    for (const l of this._lootDrops) {
      if (l.active) l.collect();
    }
    this._lootDrops.length = 0;
  }

  update(delta, computed) {
    const state = this._state;
    if (!state) return;

    // Update explosions
    for (let i = this._explosions.length - 1; i >= 0; i--) {
      this._explosions[i].update(delta);
      if (!this._explosions[i].alive) this._explosions.splice(i, 1);
    }

    const playerPos =
      this._scene.groups.player.children[0]?.position || { x: 0, z: 0 };

    const isVacuum = state.round.phase === 'vacuum';

    for (const loot of this._lootDrops) {
      loot.update(delta, playerPos, isVacuum ? VACUUM_ATTRACTION : undefined);
    }

    if (isVacuum) {
      this._vacuumTimer += delta;
      const collectR = Math.max(computed?.magnetRange ?? 4, 3.5);
      for (const loot of this._lootDrops) {
        if (!loot.active) continue;
        if (loot.position.distanceTo(playerPos) < collectR) {
          eventBus.emit(EVENTS.LOOT_COLLECTED, {
            currencyType: loot.currencyType,
            amount: loot.amount,
          });
          loot.collect();
        }
      }
    }

    for (let i = this._lootDrops.length - 1; i >= 0; i--) {
      if (!this._lootDrops[i].active) this._lootDrops.splice(i, 1);
    }

    if (isVacuum) {
      const timedOut = this._vacuumTimer >= VACUUM_MAX_SEC;
      if (this._lootDrops.length === 0 || timedOut) {
        if (timedOut && this._lootDrops.length > 0) {
          for (const loot of this._lootDrops) {
            if (!loot.active) continue;
            eventBus.emit(EVENTS.LOOT_COLLECTED, {
              currencyType: loot.currencyType,
              amount: loot.amount,
            });
            loot.collect();
          }
          this._lootDrops.length = 0;
        }
        this._vacuumTimer = 0;
        this._beginTransition();
      }
      return;
    }

    if (state.round.phase !== 'combat') return;

    // Update enemies
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const e = this._enemies[i];
      if (!e.active) {
        this._enemies.splice(i, 1);
        continue;
      }
      e.update(delta, playerPos);
    }

    // Spawn logic
    const required = state.round.enemiesRequired;
    const maxConcurrent = this._calcMaxConcurrent(state.round.current, computed);
    const spawnInterval = this._calcSpawnInterval(state.round.current, computed);
    const isBoss = this._isBossRound(state.round.current);

    if (this._spawnedThisRound < required && this._enemies.length < maxConcurrent) {
      this._spawnTimer += delta;
      if (this._spawnTimer >= spawnInterval) {
        this._spawnTimer = 0;

        let newEnemies;
        const remaining = required - this._spawnedThisRound;
        // Boss must be the last spawn; swarm packs can skip spawned === required-1 otherwise.
        if (isBoss && remaining === 1) {
          newEnemies = this._factory.spawnBoss(state.round.current, this._scene, computed);
        } else if (isBoss && remaining > 1) {
          newEnemies = this._factory.spawnRandomCapped(
            state.round.current,
            this._scene,
            remaining - 1,
            computed
          );
        } else {
          newEnemies = this._factory.spawnRandom(state.round.current, this._scene, computed);
        }
        this._enemies.push(...newEnemies);
        this._spawnedThisRound += newEnemies.length;
        newEnemies.forEach(e => eventBus.emit(EVENTS.ENEMY_SPAWNED, { enemy: e }));
      }
    }

    // Passive currency
    this._currency.updatePassive(delta, computed);
  }

  get enemies() { return this._enemies; }
  get lootDrops() { return this._lootDrops; }
}
