import { RUN, PLAYER } from '../constants.js';
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
    this._scene = null;
    this._state = null;
    this._onRoundStart = null;
    this._unsubEnemyKilled = null;
    this._bossSpawnPending = false;
  }

  init(state, scene, onRoundStart) {
    if (this._unsubEnemyKilled) {
      this._unsubEnemyKilled();
      this._unsubEnemyKilled = null;
    }
    this._state = state;
    this._scene = scene;
    this._onRoundStart = onRoundStart;

    const onKilled = ({ enemy }) => this._onEnemyKilled(enemy);
    this._unsubEnemyKilled = eventBus.on(EVENTS.ENEMY_KILLED, onKilled);
  }

  /**
   * Debug menu: spawn a pack of `typeName` at current tier. Returns spawned list, or `null` if not in combat.
   */
  debugSpawn(typeName, computed = null) {
    const state = this._state;
    if (!state || state.round.phase !== 'combat') return null;
    const tier = state.round.current;
    const newEnemies = this._factory.spawnByType(typeName, tier, this._scene, computed);
    for (const e of newEnemies) {
      this._enemies.push(e);
      eventBus.emit(EVENTS.ENEMY_SPAWNED, { enemy: e });
    }
    return newEnemies;
  }

  /** Remove combat entities from the scene without awarding loot (e.g. debug reset). */
  purgeCombatWorld() {
    if (this._state?.round) this._state.round.manualFocusEnemyId = null;
    this._clearEnemies();
    this._clearLoot();
    for (const exp of this._explosions) {
      exp.destroy();
    }
    this._explosions.length = 0;
    this._spawnTimer = 0;
    this._bossSpawnPending = false;
  }

  /**
   * Begin or resume combat. Distance and tier continue across sessions until a new game.
   */
  startRound() {
    const state = this._state;
    this._syncTierFromDistance();
    state.round.phase = 'combat';
    state.round.manualFocusEnemyId = null;
    state.roundLoot = {};
    this._spawnTimer = 0;
    this._clearLoot();
    eventBus.emit(EVENTS.ROUND_STARTED, { round: state.round.current });
    if (this._onRoundStart) this._onRoundStart(state.round.current);
  }

  _syncTierFromDistance() {
    const d = this._state.round.distanceTraveled || 0;
    this._state.round.current = Math.max(1, 1 + Math.floor(d / RUN.DISTANCE_PER_TIER));
  }

  _syncBossSpawnPending() {
    const state = this._state;
    const r = state.round;
    const hasBoss = this._enemies.some(e => e.active && e.type === 'boss');
    r.bossIsActive = hasBoss;
    const nextAt = (r.bossesDefeated + 1) * RUN.BOSS_DISTANCE_INTERVAL;
    if (r.distanceTraveled >= nextAt && !hasBoss) {
      this._bossSpawnPending = true;
    }
  }

  _accumulateDistance(delta, computed) {
    const speed = computed?.speed ?? PLAYER.BASE_SPEED;
    this._state.round.distanceTraveled += speed * delta;
    this._syncTierFromDistance();
    this._syncBossSpawnPending();
  }

  _calcMaxConcurrent(tier, computed) {
    const base = Math.min(5 + Math.floor(tier / 4), RUN.MAX_CONCURRENT_ENEMIES);
    const mult = computed?.roundModifiers?.maxConcurrent ?? 1.0;
    return Math.round(base * mult);
  }

  _calcSpawnInterval(tier, computed) {
    const base = Math.max(
      RUN.SPAWN_INTERVAL_MIN,
      RUN.SPAWN_INTERVAL_BASE - tier * RUN.SPAWN_INTERVAL_PER_TIER
    );
    const mult = computed?.roundModifiers?.spawnInterval ?? 1.0;
    return Math.max(RUN.SPAWN_INTERVAL_MIN, base * mult);
  }

  _onEnemyKilled(enemy) {
    const state = this._state;
    if (state.round.phase !== 'combat') return;

    const lootMult = this._state._computed?.lootMultiplier || 1.0;
    const lootRates = this._state._computed?.lootRates || null;
    const drops = this._currency.generateLoot(enemy, lootMult, lootRates);
    for (const drop of drops) {
      const basePos = enemy.group.position.clone();
      let remaining = drop.amount;
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
          const pos = basePos.clone();
          pos.x += (Math.random() - 0.5) * spread;
          pos.z += (Math.random() - 0.5) * spread;
          this._lootDrops.push(new LootDrop(pos, drop.currency, value, this._scene));
        }
      }
    }

    const color = enemy.type === 'boss' ? 0xaa00ff : 0xff6600;
    const scale = enemy.type === 'boss' ? 2.5 : (enemy.type === 'tank' ? 1.5 : 1.0);
    const exp = new Explosion(enemy.group.position.clone(), color, scale, this._scene);
    this._explosions.push(exp);

    enemy.remove(this._scene);
    const idx = this._enemies.indexOf(enemy);
    if (idx !== -1) this._enemies.splice(idx, 1);

    state.round.enemiesDefeated++;
    state.round.killsThisRun++;
    if (enemy.type === 'boss') {
      state.round.bossesDefeated++;
    }
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
    if (!state || state.round.phase !== 'combat') return;

    for (let i = this._explosions.length - 1; i >= 0; i--) {
      this._explosions[i].update(delta);
      if (!this._explosions[i].alive) this._explosions.splice(i, 1);
    }

    const playerPos =
      this._scene.groups.player.children[0]?.position || { x: 0, z: 0 };

    this._accumulateDistance(delta, computed);

    const magnetRange = computed?.magnetRange ?? 4;
    for (const loot of this._lootDrops) {
      loot.update(delta, playerPos, { magnetRange });
    }

    for (let i = this._lootDrops.length - 1; i >= 0; i--) {
      if (!this._lootDrops[i].active) this._lootDrops.splice(i, 1);
    }

    const speedScale = (computed?.speed ?? PLAYER.BASE_SPEED) / PLAYER.BASE_SPEED;
    const visionRange = computed?.visionRange ?? Infinity;
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const e = this._enemies[i];
      if (!e.active) {
        this._enemies.splice(i, 1);
        continue;
      }
      e.update(delta, playerPos, speedScale, visionRange, this._scene.camera);
    }

    const tier = state.round.current;
    const maxConcurrent = this._calcMaxConcurrent(tier, computed);
    const spawnInterval = this._calcSpawnInterval(tier, computed);

    const hasBossAlive = this._enemies.some(e => e.active && e.type === 'boss');
    state.round.bossIsActive = hasBossAlive;

    this._spawnTimer += delta;
    if (this._spawnTimer >= spawnInterval) {
      const room = this._enemies.length < maxConcurrent;
      let newEnemies = null;

      if (this._bossSpawnPending && !hasBossAlive && room) {
        newEnemies = this._factory.spawnBoss(tier, this._scene, computed);
        this._bossSpawnPending = false;
      } else if (!this._bossSpawnPending && room) {
        newEnemies = this._factory.spawnRandom(tier, this._scene, computed);
      }

      if (newEnemies?.length) {
        this._spawnTimer = 0;
        this._enemies.push(...newEnemies);
        newEnemies.forEach(e => eventBus.emit(EVENTS.ENEMY_SPAWNED, { enemy: e }));
      }
    }

    this._currency.updatePassive(delta, computed);
  }

  get enemies() { return this._enemies; }
  get lootDrops() { return this._lootDrops; }
}
