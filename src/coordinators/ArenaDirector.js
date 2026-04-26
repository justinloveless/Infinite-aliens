import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { BOSS_ARENA, PLAYER } from '../constants.js';
import { getPreset } from '../scene/EnvironmentPresets.js';
import { createEnemy } from '../prefabs/createEnemy.js';
import { createExplosion } from '../prefabs/createExplosion.js';
import { createAlienWarpGate } from '../prefabs/createAlienWarpGate.js';
import { createPlayerWarpGate } from '../prefabs/createPlayerWarpGate.js';
import { weightedPick } from '../components/enemy/EnemyDefs.js';
import { getSpawnableEnemyTypes } from './counterSpawn.js';
import { COUNTER_ENEMY_DEFS } from '../data/counterEnemies.js';

/**
 * Fixed positions for the 3 alien warp gates inside the arena. Spread across
 * the 600×600 arena so the flight controller has real distance to cover.
 */
const GATE_POSITIONS = [
  { x: -120, z: -140 },
  { x:  150, z: -100 },
  { x:   10, z: -220 },
];

const BOSS_SPAWN = { x: 0, z: -25 };

/**
 * Owns the boss_arena phase from entry to completion.
 *
 * Flow (boss is optional):
 *   arena_transition → fighting → building_gate → complete
 *
 * Crystals on each alien gate can be destroyed by the player from the start
 * of `fighting`. Destroying all crystals on a gate closes it; closing every
 * gate advances to `building_gate`. The boss (if still alive) continuously
 * spawns minions throughout; killing the boss flips `bossDefeated` but does
 * not gate progress. When the friendly gate finishes building, the player
 * can leave immediately or stay to finish the boss for extra loot.
 */
export class ArenaDirector {
  constructor({ world, state, scene, camera, spawnDirector, audio = null, synthGrid = null, starfield = null }) {
    this.world = world;
    this.state = state;
    this.scene = scene;
    this.camera = camera;
    this.spawnDirector = spawnDirector;
    this.audio = audio;
    this.synthGrid = synthGrid;
    this.starfield = starfield;

    this._bossEntity = null;
    this._gateEntities = [];
    this._playerGateEntity = null;
    this._completionTimer = 0;
    this._completing = false;
    this._leaveT = 0;
    this._onComplete = null;
    this._bossSpawnTimer = 0;
    this._bossLiveSpawns = new Set();

    this._gateClosedUnsub = null;
    this._killUnsub = null;

    // Transition state
    this._transitionT = 0;
    this._transitioning = false;
    this._transitionGalaxyIndex = 0;
    this._transitionOverlay = null;
    this._bossSpawned = false;
    this._bossTargetScale = 1;
    /** One scan/replication sequence per arena visit (during player gate build, not on boss kill). */
    this._scanEmittedThisArena = false;
  }

  _getBossTypeForGalaxy(galaxyIndex) {
    const c = this.state?.campaign;
    if (galaxyIndex === 0) return 'boss';
    if (galaxyIndex === 9 || c?.returnJourney?.active) return 'ship_clone_boss';
    const scan = c?.scannedItems?.[galaxyIndex - 1];
    if (!scan?.counterType) return 'boss';
    return COUNTER_ENEMY_DEFS[scan.counterType]?.mothershipType ?? 'boss';
  }

  _getMinionTypeForBoss(galaxyIndex) {
    const c = this.state?.campaign;
    if (galaxyIndex === 0) return 'scout';
    if (galaxyIndex === 9 || c?.returnJourney?.active) return 'ship_clone';
    return c?.scannedItems?.[galaxyIndex - 1]?.counterType ?? 'scout';
  }

  /**
   * Kick off the cinematic warp into the arena. Player keeps yaw/throttle
   * control the whole time so they feel in command. Boss + gates are spawned
   * mid-transition with a brief grow-in. At the end, phase flips to
   * 'boss_arena' and enter() finishes wiring the arena.
   */
  beginTransition(galaxyIndex, onComplete) {
    this._transitioning = true;
    this._transitionT = 0;
    this._bossSpawned = false;
    this._transitionGalaxyIndex = galaxyIndex;
    this._onComplete = onComplete;
    this._completing = false;
    this._completionTimer = 0;
    this._bossSpawnTimer = 0;
    this._bossLiveSpawns.clear();
    this._scanEmittedThisArena = false;

    this.state.round.phase = 'arena_transition';
    this.state.bossArena = {
      active: true,
      subPhase: 'transitioning',
      bossDefeated: false,
      gatesTotal: BOSS_ARENA.GATE_COUNT,
      gatesClosed: 0,
      buildProgress: 0,
    };

    this.spawnDirector.purgeCombatWorld();
    for (const e of this.world.query('projectile_enemy')) e.destroy();
    for (const e of this.world.query('asteroid')) e.destroy();

    const playerT = this.world.ctx.playerEntity?.get('TransformComponent');
    if (playerT) {
      playerT.rotation.x = 0;
      playerT.rotation.z = 0;
      if (!Number.isFinite(playerT.rotation.y)) playerT.rotation.y = 0;
      this.camera.setArenaMode(true, playerT);
      this.camera.setArenaOffset({ back: 8, up: 4, lead: 5, lerp: 6 });
      this.camera.snapToArenaPose();
    }

    const preset = getPreset(galaxyIndex);
    this.scene.applyEnvironment({ ...preset, ...preset.arenaVariant }, false);

    this.camera.shake?.(0.5, 0.45);

    this._transitionOverlay = document.getElementById('arena-transition');
    if (this._transitionOverlay) {
      this._transitionOverlay.classList.remove('hidden');
      requestAnimationFrame(() => this._transitionOverlay?.classList.add('visible'));
    }

    this._bindEventHandlers();

    eventBus.emit(EVENTS.ARENA_TRANSITION_STARTED, { galaxyIndex });
  }

  _bindEventHandlers() {
    if (this._gateClosedUnsub) this._gateClosedUnsub();
    this._gateClosedUnsub = eventBus.on(EVENTS.ARENA_GATE_CLOSED, () => this._onGateClosed());
  }

  getTransitionProgress() {
    if (!this._transitioning) return 0;
    return Math.min(1, this._transitionT / BOSS_ARENA.TRANSITION_DURATION);
  }

  getTransitionStarfieldSpeed() {
    const p = this.getTransitionProgress();
    const bump = Math.sin(Math.min(1, p / 0.75) * Math.PI);
    return 260 * bump;
  }

  getTransitionGridSpeed() {
    const p = this.getTransitionProgress();
    const bump = Math.sin(Math.min(1, p / 0.75) * Math.PI);
    return 80 * bump;
  }

  _spawnArenaEntities() {
    if (this._bossSpawned) return;
    this._bossSpawned = true;

    const tier = this.state.round.current;
    const stats = this.world.ctx.playerEntity?.get('PlayerStatsComponent');
    const bossType = this._getBossTypeForGalaxy(this._transitionGalaxyIndex);
    this._bossEntity = createEnemy(
      bossType,
      tier,
      stats,
      BOSS_SPAWN,
      { baseSpeedOverride: PLAYER.BASE_SPEED }
    );
    const health = this._bossEntity.get('HealthComponent');
    if (health) { health.hp *= 2; health.maxHp *= 2; }
    const _bossNames = ['BossBehaviorComponent', 'BossRusherBehaviorComponent', 'BossOrbiterBehaviorComponent', 'BossSniperBehaviorComponent', 'BossAggressorBehaviorComponent'];
    const behavior = _bossNames.reduce((found, n) => found ?? this._bossEntity.components.get(n), null);
    if (behavior) behavior.speed = (behavior.speed || 1.2) * BOSS_ARENA.BOSS_MOVE_SPEED_MULT;
    this._bossEntity.addTag('arena_boss');

    const vis = this._bossEntity.get('EnemyVisualsComponent');

    if (bossType === 'ship_clone_boss') {
      const playerVisuals = this.world.ctx.playerEntity?.get('ShipVisualsComponent');
      const shipClone = playerVisuals?.cloneShipMesh?.();
      if (shipClone && vis?.spinGroup) {
        while (vis.spinGroup.children.length) vis.spinGroup.remove(vis.spinGroup.children[0]);
        shipClone.scale.setScalar(5);
        shipClone.rotation.y = Math.PI;
        vis.spinGroup.add(shipClone);
      }
    }

    if (vis?.group) {
      this._bossTargetScale = vis.group.scale.x || 1;
      vis.group.scale.setScalar(0.001);
    } else {
      this._bossTargetScale = 1;
    }
    this.world.spawn(this._bossEntity);

    this._gateEntities = [];
    for (const pos of GATE_POSITIONS) {
      const gate = createAlienWarpGate(pos);
      this.world.spawn(gate);
      this._gateEntities.push(gate);
    }

    this._playerGateEntity = createPlayerWarpGate({ x: 0, z: 60 });
    this.world.spawn(this._playerGateEntity);

    if (this._killUnsub) this._killUnsub();
    this._killUnsub = eventBus.on(EVENTS.ENEMY_KILLED, ({ entity }) => {
      const phase = this.state.round.phase;
      if (phase !== 'boss_arena' && phase !== 'arena_transition') return;
      if (entity === this._bossEntity || entity?.hasTag?.('arena_boss')) {
        this._onBossDefeated();
      }
      const t = entity?.get?.('TransformComponent');
      if (t && !entity?.hasTag?.('gate_crystal')) {
        const isBoss = entity.hasTag?.('arena_boss');
        this.world.spawn(createExplosion(t.position, {
          color: isBoss ? 0xaa00ff : 0xff6600,
          scale: isBoss ? 3.0 : 1.0,
        }));
      }
    });
  }

  _finishTransition() {
    this._transitioning = false;
    this.state.round.phase = 'boss_arena';
    this.state.bossArena.subPhase = 'fighting';

    if (this._transitionOverlay) {
      this._transitionOverlay.classList.remove('visible');
      const el = this._transitionOverlay;
      setTimeout(() => el?.classList.add('hidden'), 350);
    }

    this.camera.setArenaOffset({ back: 14, up: 6, lead: 6, lerp: 5 });

    // Expand the grid + starfield to cover the full arena bounds now that
    // the warp streak animation is finished. Doing this during the transition
    // would kill the streak (arena-mode starfield is static).
    this.synthGrid?.setArenaMode?.(true);
    this.starfield?.setArenaMode?.(true);

    eventBus.emit(EVENTS.ARENA_PHASE_CHANGED, { subPhase: 'fighting' });
    eventBus.emit(EVENTS.ARENA_TRANSITION_ENDED, { galaxyIndex: this._transitionGalaxyIndex });
  }

  _onBossDefeated() {
    if (this.state.bossArena.bossDefeated) return;
    this.state.bossArena.bossDefeated = true;
    this.state.round.bossesDefeated = (this.state.round.bossesDefeated || 0) + 1;
  }

  /** Campaign scan / galaxy-9 replication — fired when player gate starts building (boss optional). */
  _emitCampaignScanIfNeeded() {
    if (this._scanEmittedThisArena) return;
    this._scanEmittedThisArena = true;
    const galaxyIndex = this._transitionGalaxyIndex;
    if (galaxyIndex < 9) {
      eventBus.emit(EVENTS.BOSS_SCAN_READY, { galaxyIndex });
    } else {
      eventBus.emit(EVENTS.BOSS_GALAXY9_COMPLETE, { galaxyIndex });
    }
  }

  _onGateClosed() {
    const arena = this.state.bossArena;
    if (!arena?.active) return;
    arena.gatesClosed = Math.min(arena.gatesTotal, (arena.gatesClosed || 0) + 1);
    if (arena.gatesClosed >= arena.gatesTotal && arena.subPhase === 'fighting') {
      this._advanceSubPhase('building_gate');
    }
  }

  _advanceSubPhase(subPhase) {
    this.state.bossArena.subPhase = subPhase;
    eventBus.emit(EVENTS.ARENA_PHASE_CHANGED, { subPhase });
    if (subPhase === 'building_gate') this._emitCampaignScanIfNeeded();
  }

  get isTransitioning() {
    return this._transitioning;
  }

  /** Live references used by main.js to drive off-screen indicators. */
  getIndicatorTargets() {
    const targets = [];
    if (this._bossEntity && !this._bossEntity._destroyed && this._bossEntity.active) {
      const t = this._bossEntity.get('TransformComponent');
      if (t) targets.push({ id: 'arena-boss', kind: 'boss', worldPos: t.position });
    }
    for (const g of this._gateEntities) {
      if (!g || g._destroyed || !g.active) continue;
      const gc = g.get('AlienWarpGateComponent');
      if (!gc || !gc.isActive) continue;
      const gt = g.get('TransformComponent');
      if (gt) targets.push({ id: `arena-gate-${g.id}`, kind: 'alien_gate', worldPos: gt.position });
    }
    if (this._playerGateEntity && !this._playerGateEntity._destroyed && this._playerGateEntity.active) {
      const t = this._playerGateEntity.get('TransformComponent');
      if (t) targets.push({ id: 'arena-player-gate', kind: 'player_gate', worldPos: t.position });
    }
    return targets;
  }

  update(dt) {
    if (this._transitioning) {
      this._updateTransition(dt);
      return;
    }

    if (this._bossEntity && !this._bossEntity._destroyed) {
      const vis = this._bossEntity.get('EnemyVisualsComponent');
      if (vis?.group && vis.group.scale.x < this._bossTargetScale) {
        const step = this._bossTargetScale * dt / BOSS_ARENA.BOSS_GROW_IN_TIME;
        vis.group.scale.setScalar(Math.min(this._bossTargetScale, vis.group.scale.x + step));
      }
    }

    const arena = this.state.bossArena;
    if (!arena?.active) return;

    // Continuous boss-driven spawns (runs through every live subPhase).
    this._tickBossSpawns(dt);

    if (this._completing) {
      this._leaveT += dt;
      this._completionTimer -= dt;
      if (this._completionTimer <= 0) {
        this._completing = false;
        if (this._onComplete) this._onComplete();
      }
      return;
    }

    if (arena.subPhase === 'building_gate') {
      this._updateBuildProgress(dt);
    } else if (arena.subPhase === 'complete') {
      this._checkFlyThroughGate();
    }
  }

  /**
   * Once the friendly warp gate finishes building, the player leaves the
   * arena by flying their ship through it. No keyboard prompt — just
   * physical proximity.
   */
  _checkFlyThroughGate() {
    if (this._completing) return;
    const gate = this._playerGateEntity;
    if (!gate || gate._destroyed || !gate.active) return;
    const player = this.world.ctx.playerEntity;
    if (!player) return;
    const gt = gate.get('TransformComponent');
    const pt = player.get('TransformComponent');
    if (!gt || !pt) return;
    const dx = pt.position.x - gt.position.x;
    const dz = pt.position.z - gt.position.z;
    const distSq = dx * dx + dz * dz;
    const r = BOSS_ARENA.GATE_FLY_THROUGH_RADIUS;
    if (distSq <= r * r) {
      this._beginLeave();
    }
  }

  _beginLeave() {
    this._completing = true;
    this._leaveT = 0;
    this._completionTimer = BOSS_ARENA.LEAVE_DURATION;

    const title = document.querySelector('#arena-transition-banner .arena-banner-title');
    const sub   = document.querySelector('#arena-transition-banner .arena-banner-sub');
    if (title) title.textContent = 'WARPING OUT';
    if (sub)   sub.textContent   = 'Jump drive engaged. Hold steady.';

    if (this._transitionOverlay) {
      this._transitionOverlay.classList.remove('hidden');
      requestAnimationFrame(() => this._transitionOverlay?.classList.add('visible'));
    }

    this.camera.shake?.(0.4, 0.35);
    eventBus.emit(EVENTS.ARENA_LEAVE_REQUESTED, {});
  }

  get isLeaving() { return this._completing; }

  getLeavingStarfieldSpeed() {
    const p = Math.min(1, this._leaveT / BOSS_ARENA.LEAVE_DURATION);
    return 260 * p * p;
  }

  getLeavingGridSpeed() {
    const p = Math.min(1, this._leaveT / BOSS_ARENA.LEAVE_DURATION);
    return 80 * p * p;
  }

  /** 0..1 warp intensity for FOV during the entry transition (sin bump). */
  getTransitionFovBonus() {
    const p = this.getTransitionProgress();
    return Math.sin(Math.min(1, p / 0.75) * Math.PI);
  }

  /** 0..1 warp intensity for FOV during the leave animation (quadratic ramp). */
  getLeavingFovBonus() {
    const p = Math.min(1, this._leaveT / BOSS_ARENA.LEAVE_DURATION);
    return p * p;
  }

  _updateTransition(dt) {
    this._transitionT += dt;
    const T = this._transitionT;

    const prog = Math.min(1, T / BOSS_ARENA.CAMERA_SETTLE_AT);
    const back = THREE.MathUtils.lerp(8, 14, prog);
    const up = THREE.MathUtils.lerp(4, 6, prog);
    this.camera.setArenaOffset({ back, up });

    if (!this._bossSpawned && T >= BOSS_ARENA.BOSS_SPAWN_AT) {
      this._spawnArenaEntities();
      this.camera.shake?.(0.4, 0.35);
    }

    if (this._bossSpawned && this._bossEntity && !this._bossEntity._destroyed) {
      const vis = this._bossEntity.get('EnemyVisualsComponent');
      if (vis?.group) {
        const step = this._bossTargetScale * dt / BOSS_ARENA.BOSS_GROW_IN_TIME;
        vis.group.scale.setScalar(Math.min(this._bossTargetScale, vis.group.scale.x + step));
      }
    }

    if (T >= BOSS_ARENA.TRANSITION_DURATION) this._finishTransition();
  }

  _tickBossSpawns(dt) {
    const boss = this._bossEntity;
    if (!boss || boss._destroyed || !boss.active) return;
    if (this.state.bossArena.bossDefeated) return;

    for (const ent of this._bossLiveSpawns) {
      if (!ent || ent._destroyed || !ent.active) this._bossLiveSpawns.delete(ent);
    }
    if (this._bossLiveSpawns.size >= BOSS_ARENA.BOSS_MAX_LIVE_SPAWNS) return;

    this._bossSpawnTimer += dt;
    if (this._bossSpawnTimer < BOSS_ARENA.BOSS_SPAWN_INTERVAL) return;
    this._bossSpawnTimer = 0;

    const tier = this.state.round?.current || 1;
    const minionType = this._getMinionTypeForBoss(this._transitionGalaxyIndex);
    const types = getSpawnableEnemyTypes(tier, this.state).filter(
      t => t !== 'boss' && !String(t).endsWith('_boss')
    );
    if (minionType && !types.includes(minionType)) types.push(minionType);
    if (!types.length) return;
    const def = weightedPick(types);
    const count = def.spawnCount || 1;
    const stats = this.world.ctx.playerEntity?.get('PlayerStatsComponent');
    const bossT = boss.get('TransformComponent');
    if (!bossT) return;
    for (let i = 0; i < count; i++) {
      const jitterAngle = Math.random() * Math.PI * 2;
      const jitterR = 3 + Math.random() * 3;
      const offset = {
        x: bossT.position.x + Math.cos(jitterAngle) * jitterR,
        z: bossT.position.z + Math.sin(jitterAngle) * jitterR,
      };
      const ent = createEnemy(
        def.type,
        tier,
        stats,
        offset,
        { baseSpeedOverride: PLAYER.BASE_SPEED }
      );
      this.world.spawn(ent);
      this._bossLiveSpawns.add(ent);
      eventBus.emit(EVENTS.ENEMY_SPAWNED, { entity: ent });
    }
  }

  _updateBuildProgress(dt) {
    const arena = this.state.bossArena;
    arena.buildProgress = Math.min(1, (arena.buildProgress || 0) + dt / BOSS_ARENA.GATE_BUILD_TIME);

    const pgComp = this._playerGateEntity?.get('PlayerWarpGateComponent');
    if (pgComp) pgComp.setProgress(arena.buildProgress);

    if (arena.buildProgress >= 1) {
      this._onBuildComplete();
    }
  }

  _onBuildComplete() {
    this._advanceSubPhase('complete');
    const bossAlive = this._isBossAlive();
    eventBus.emit(EVENTS.ARENA_COMPLETE, { bossAlive });
    // No auto-leave. Player must fly through the gate to depart; handled by
    // _checkFlyThroughGate on subsequent ticks.
  }

  /**
   * Debug: jump arena state to the same point as a finished player gate build
   * — alien objectives shut, gate built, proximity fly-through enabled. Does
   * not warp out; normal leave sequence runs when the player enters the gate.
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  debugSkipToFlyThroughReady() {
    const arena = this.state.bossArena;
    if (!arena?.active) return { ok: false, reason: 'No boss arena active.' };
    if (this._transitioning) return { ok: false, reason: 'Still in arena warp transition.' };
    if (this._completing) return { ok: false, reason: 'Already warping out.' };
    if (this.state.round.phase !== 'boss_arena') return { ok: false, reason: 'Not in boss arena phase (wait until transition ends).' };
    if (arena.subPhase === 'complete') return { ok: false, reason: 'Already at fly-through stage.' };

    for (const g of this._gateEntities) {
      g?.get('AlienWarpGateComponent')?.debugForceClose?.();
    }
    arena.gatesClosed = arena.gatesTotal;
    arena.buildProgress = 1;
    const pgComp = this._playerGateEntity?.get('PlayerWarpGateComponent');
    if (pgComp) pgComp.setProgress(1);
    this._emitCampaignScanIfNeeded();
    this._advanceSubPhase('complete');
    eventBus.emit(EVENTS.ARENA_COMPLETE, { bossAlive: this._isBossAlive() });
    return { ok: true };
  }

  _isBossAlive() {
    const b = this._bossEntity;
    return !!(b && !b._destroyed && b.active && !this.state.bossArena.bossDefeated);
  }

  exit() {
    if (this._killUnsub) { this._killUnsub(); this._killUnsub = null; }
    if (this._gateClosedUnsub) { this._gateClosedUnsub(); this._gateClosedUnsub = null; }

    for (const e of [...this._gateEntities]) {
      if (!e._destroyed) e.destroy();
    }
    if (this._playerGateEntity && !this._playerGateEntity._destroyed) {
      this._playerGateEntity.destroy();
    }
    if (this._bossEntity && !this._bossEntity._destroyed) {
      this._bossEntity.destroy();
    }
    for (const ent of this._bossLiveSpawns) {
      if (ent && !ent._destroyed) ent.destroy();
    }
    this._bossLiveSpawns.clear();

    this._gateEntities = [];
    this._playerGateEntity = null;
    this._bossEntity = null;
    this._transitioning = false;
    this._bossSpawned = false;
    this._completing = false;
    this._leaveT = 0;

    if (this._transitionOverlay) {
      this._transitionOverlay.classList.remove('visible');
      const el = this._transitionOverlay;
      setTimeout(() => el?.classList.add('hidden'), 350);
      // Restore entry text for next visit
      const title = el.querySelector('.arena-banner-title');
      const sub   = el.querySelector('.arena-banner-sub');
      if (title) title.textContent = 'ENTERING ENEMY HUB';
      if (sub)   sub.textContent   = 'Hold course. Warp engaged.';
    }

    this.synthGrid?.setArenaMode?.(false);
    this.starfield?.setArenaMode?.(false);

    this.camera.setArenaMode(false);
  }
}
