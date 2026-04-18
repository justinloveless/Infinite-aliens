import { RUN, PLAYER, ASTEROID } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { createEnemy } from '../prefabs/createEnemy.js';
import { createLootDrop } from '../prefabs/createLootDrop.js';
import { createExplosion } from '../prefabs/createExplosion.js';
import { createAsteroid } from '../prefabs/createAsteroid.js';
import { ENEMY_DEFS, getAvailableTypes, weightedPick } from '../components/enemy/EnemyDefs.js';

/**
 * Orchestrates round progression: tier from distance traveled, enemy spawn
 * cadence, boss milestones, explosion + loot-drop generation on kill.
 * All per-entity logic lives in components — this coordinator only decides
 * *what* and *when* to spawn.
 */
export class SpawnDirector {
  constructor({ world, state, currency }) {
    this.world = world;
    this.state = state;
    this.currency = currency;
    this._spawnTimer = 0;
    this._asteroidTimer = 0;
    this._bossSpawnPending = false;
    this._unsub = null;
  }

  init() {
    if (this._unsub) this._unsub();
    this._unsub = eventBus.on(EVENTS.ENEMY_KILLED, ({ entity }) => this._onEnemyKilled(entity));
  }

  /** Begin/resume combat. */
  startRound() {
    const state = this.state;
    this._syncTierFromDistance();
    state.round.phase = 'combat';
    state.round.manualFocusEnemyId = null;
    state.roundLoot = {};
    this._spawnTimer = 0;
    this._clearLoot();
    eventBus.emit(EVENTS.ROUND_STARTED, { round: state.round.current });
  }

  /** Debug: spawn a pack of `typeName` at current tier. */
  debugSpawn(typeName) {
    const state = this.state;
    if (!state || state.round.phase !== 'combat') return null;
    const def = ENEMY_DEFS[typeName];
    if (!def) return null;
    const count = def.spawnCount || 1;
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const stats = this.world.ctx.playerEntity?.get('PlayerStatsComponent');
      const ent = createEnemy(typeName, state.round.current, stats,
        count > 1 ? { x: (i - 1) * 2.5 } : null);
      this.world.spawn(ent);
      eventBus.emit(EVENTS.ENEMY_SPAWNED, { entity: ent });
      spawned.push(ent);
    }
    return spawned;
  }

  purgeCombatWorld() {
    if (this.state?.round) this.state.round.manualFocusEnemyId = null;
    for (const e of this.world.query('enemy')) e.destroy();
    this._clearLoot();
    for (const e of this.world.query('effect')) e.destroy();
    this._spawnTimer = 0;
    this._bossSpawnPending = false;
  }

  _clearLoot() {
    for (const e of this.world.query('loot')) e.destroy();
  }

  _syncTierFromDistance() {
    const d = this.state.round.distanceTraveled || 0;
    this.state.round.current = Math.max(1, 1 + Math.floor(d / RUN.DISTANCE_PER_TIER));
  }

  _syncBossSpawnPending() {
    const state = this.state;
    const hasBoss = this._hasLiveBoss();
    state.round.bossIsActive = hasBoss;
    const nextAt = (state.round.bossesDefeated + 1) * RUN.BOSS_DISTANCE_INTERVAL;
    if (state.round.distanceTraveled >= nextAt && !hasBoss) {
      this._bossSpawnPending = true;
    }
  }

  _hasLiveBoss() {
    for (const e of this.world.query('enemy')) {
      if (e.active && e.enemyType === 'boss') return true;
    }
    return false;
  }

  _onEnemyKilled(enemy) {
    const state = this.state;
    if (state.round.phase !== 'combat') return;
    if (!enemy) return;

    const color = enemy.enemyType === 'boss' ? 0xaa00ff : 0xff6600;
    const scale = enemy.enemyType === 'boss' ? 2.5 : (enemy.enemyType === 'tank' ? 1.5 : 1.0);
    const t = enemy.get('TransformComponent');
    if (t) this.world.spawn(createExplosion(t.position, { color, scale }));

    state.round.enemiesDefeated++;
    state.round.killsThisRun++;
    if (enemy.enemyType === 'boss') state.round.bossesDefeated++;

    enemy.destroy();
  }

  /** Used by LootTableComponent via ctx.spawnLoot. */
  spawnLootAt(position, currency, totalAmount) {
    let remaining = totalAmount;
    const denoms = [
      { value: 1000, spread: 2.5 },
      { value: 100,  spread: 2.0 },
      { value: 10,   spread: 1.5 },
      { value: 1,    spread: 1.5 },
    ];
    for (const { value, spread } of denoms) {
      const count = Math.floor(remaining / value);
      remaining %= value;
      for (let i = 0; i < count; i++) {
        const pos = position.clone();
        pos.x += (Math.random() - 0.5) * spread;
        pos.z += (Math.random() - 0.5) * spread;
        this.world.spawn(createLootDrop(pos, currency, value));
      }
    }
  }

  update(dt) {
    const state = this.state;
    if (!state || state.round.phase !== 'combat') return;

    const playerEnt = this.world.ctx.playerEntity;
    const stats = playerEnt?.get('PlayerStatsComponent');
    const speed = stats?.speed ?? PLAYER.BASE_SPEED;
    state.round.distanceTraveled += speed * dt;
    this._syncTierFromDistance();
    this._syncBossSpawnPending();
    state.round.speedScale = speed / PLAYER.BASE_SPEED;

    const tier = state.round.current;
    const roundMods = stats?.roundModifiers || { spawnInterval: 1, maxConcurrent: 1 };
    const maxConcurrent = Math.round(
      Math.min(5 + Math.floor(tier / 4), RUN.MAX_CONCURRENT_ENEMIES) * roundMods.maxConcurrent
    );
    const baseInterval = Math.max(
      RUN.SPAWN_INTERVAL_MIN,
      RUN.SPAWN_INTERVAL_BASE - tier * RUN.SPAWN_INTERVAL_PER_TIER
    );
    const spawnInterval = Math.max(RUN.SPAWN_INTERVAL_MIN, baseInterval * roundMods.spawnInterval);

    const aliveEnemies = this.world.getFrameEnemies().length;
    const hasBoss = this._hasLiveBoss();
    state.round.bossIsActive = hasBoss;

    this._spawnTimer += dt;
    if (this._spawnTimer >= spawnInterval) {
      const room = aliveEnemies < maxConcurrent;
      if (this._bossSpawnPending && !hasBoss && room) {
        this._spawnBoss(tier, stats);
        this._bossSpawnPending = false;
        this._spawnTimer = 0;
      } else if (!this._bossSpawnPending && room) {
        this._spawnRandom(tier, stats);
        this._spawnTimer = 0;
      }
    }

    if (stats) this.currency?.updatePassiveFromStats?.(dt, stats);

    this._asteroidTimer += dt;
    if (this._asteroidTimer >= ASTEROID.SPAWN_INTERVAL) {
      this._asteroidTimer = 0;
      this.world.spawn(createAsteroid('large'));
    }
  }

  _spawnBoss(tier, stats) {
    const ent = createEnemy('boss', tier, stats);
    this.world.spawn(ent);
    eventBus.emit(EVENTS.ENEMY_SPAWNED, { entity: ent });
  }

  _spawnRandom(tier, stats) {
    const types = getAvailableTypes(tier);
    const def = weightedPick(types);
    const count = def.spawnCount || 1;
    for (let i = 0; i < count; i++) {
      const ent = createEnemy(def.type, tier, stats,
        count > 1 ? { x: (i - 1) * 2.5 } : null);
      this.world.spawn(ent);
      eventBus.emit(EVENTS.ENEMY_SPAWNED, { entity: ent });
    }
  }
}
