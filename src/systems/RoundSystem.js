import { ROUND } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
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
  }

  init(state, scene, onRoundComplete, onRoundStart) {
    this._state = state;
    this._scene = scene;
    this._onRoundComplete = onRoundComplete;
    this._onRoundStart = onRoundStart;

    eventBus.on(EVENTS.ENEMY_KILLED, ({ enemy }) => {
      this._onEnemyKilled(enemy);
    });
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
    this._clearLoot();
    eventBus.emit(EVENTS.ROUND_STARTED, { round });
    if (this._onRoundStart) this._onRoundStart(round);
  }

  _calcRequired(round) {
    return Math.floor(ROUND.BASE_ENEMIES * Math.pow(ROUND.ENEMY_SCALING, round - 1));
  }

  _calcMaxConcurrent(round) {
    return Math.min(5 + Math.floor(round / 4), ROUND.MAX_CONCURRENT_ENEMIES);
  }

  _calcSpawnInterval(round) {
    return Math.max(ROUND.SPAWN_INTERVAL_MIN, ROUND.SPAWN_INTERVAL_BASE - round * 0.05);
  }

  _isBossRound(round) {
    return round % 5 === 0;
  }

  _onEnemyKilled(enemy) {
    const state = this._state;
    if (state.round.phase !== 'combat') return;

    // Loot
    const lootMult = this._state._computed?.lootMultiplier || 1.0;
    const drops = this._currency.generateLoot(enemy, lootMult);
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
      this._beginTransition();
    }
  }

  _beginTransition() {
    const state = this._state;
    state.round.phase = 'transition';
    this._transitionTimer = 0;
    this._clearEnemies();
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

    // Update loot
    for (const loot of this._lootDrops) {
      loot.update(delta);
    }
    // Remove collected
    for (let i = this._lootDrops.length - 1; i >= 0; i--) {
      if (!this._lootDrops[i].active) this._lootDrops.splice(i, 1);
    }

    if (state.round.phase !== 'combat') return;

    // Update enemies
    const playerPos = this._scene.groups.player.children[0]?.position || { x: 0, z: 0 };
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
    const maxConcurrent = this._calcMaxConcurrent(state.round.current);
    const spawnInterval = this._calcSpawnInterval(state.round.current);
    const isBoss = this._isBossRound(state.round.current);

    if (this._spawnedThisRound < required && this._enemies.length < maxConcurrent) {
      this._spawnTimer += delta;
      if (this._spawnTimer >= spawnInterval) {
        this._spawnTimer = 0;

        let newEnemies;
        // Spawn boss on the last enemy of a boss round
        if (isBoss && this._spawnedThisRound === required - 1) {
          newEnemies = this._factory.spawnBoss(state.round.current, this._scene);
        } else {
          newEnemies = this._factory.spawnRandom(state.round.current, this._scene);
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
