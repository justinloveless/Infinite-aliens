import { SettingsManager } from './core/SettingsManager.js';
import { SettingsUI } from './ui/SettingsUI.js';
import { DebugMenuUI } from './ui/DebugMenuUI.js';
import { SceneManager } from './scene/SceneManager.js';
import { Starfield } from './scene/Starfield.js';
import { SynthGrid } from './scene/SynthGrid.js';
import { CameraController } from './scene/CameraController.js';
import { setupPostProcessing } from './scene/PostProcessing.js';
import { QualityController } from './scene/QualityController.js';
import { LightPool } from './scene/LightPool.js';
import { GameLoop } from './core/GameLoop.js';
import { createInitialState } from './core/GameState.js';
import { SaveManager } from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';
import { VoiceManager } from './audio/VoiceManager.js';
import { eventBus, EVENTS } from './core/EventBus.js';
import { ProjectileRenderer } from './rendering/ProjectileRenderer.js';
import { PerfOverlay } from './ui/PerfOverlay.js';

import { World } from './ecs/World.js';
import { createPlayer } from './prefabs/createPlayer.js';
import { createAsteroid } from './prefabs/createAsteroid.js';

import { CollisionCoordinator } from './coordinators/CollisionCoordinator.js';
import { SpawnDirector } from './coordinators/SpawnDirector.js';
import { UpgradeApplier } from './coordinators/UpgradeApplier.js';

import { CurrencySystem } from './systems/CurrencySystem.js';
import { TechTreeState } from './techtree/TechTreeState.js';

import { UIManager } from './ui/UIManager.js';
import { HUD } from './ui/HUD.js';
import { ArenaHUD } from './ui/ArenaHUD.js';
import { TechTreeUI } from './ui/TechTreeUI.js';
import { RoundTransition } from './ui/RoundTransition.js';
import { DamageNumbers } from './ui/DamageNumbers.js';
import { HangarUI } from './ui/HangarUI.js';
import { StoreUI } from './ui/StoreUI.js';
import { ResearchUI } from './ui/ResearchUI.js';
import { ArenaDirector } from './coordinators/ArenaDirector.js';
import { BLOOM, PLAYER, RUN, SCENE, WARP, CAMPAIGN, BOSS_ARENA } from './constants.js';
import { isCombatPhase } from './core/phaseUtil.js';
import { getPreset } from './scene/EnvironmentPresets.js';
import * as THREE from 'three';

const NOOP_MARK = () => {};

class Game {
  constructor() {
    this.state = null;
    this.computed = null;
    this.playerEntity = null;

    this.loop = new GameLoop();
    this.saveManager = new SaveManager();
    this.settings = new SettingsManager();
    this.audio = new AudioManager();
    this.voice = new VoiceManager({
      eventBus,
      settings: this.settings,
      getContext: () => ({
        playerEntity: this.playerEntity,
        galaxyIndex: this.state?.campaign?.galaxyIndex ?? 0,
      }),
    });

    // Toggles diagnostic perf logging: per-section tick breakdowns on hitches
    // (>50 ms), the hitch line from PerfOverlay, and the one-time GPU info
    // line. Off by default; flip it via the Debug Menu or Shift+F3.
    this._perfLogEnabled = false;
    this._profMarks = null;

    this.scene = new SceneManager();
    this.starfield = new Starfield(this.scene.scene);
    this.synthGrid = new SynthGrid(this.scene.scene);
    this.camera = new CameraController(this.scene.camera);

    const { composer, postPasses } = setupPostProcessing(
      this.scene.renderer, this.scene.scene, this.scene.camera
    );
    this.scene.setComposer(composer);
    this._composer = composer;
    this._postPasses = postPasses;
    this._grainTime = 0;
    this._visualDefaults = this._captureVisualDefaults();

    this.audio.setMusicVolume(this.settings.musicVolume);
    this.audio.setSfxVolume(this.settings.sfxVolume);
    this.audio.setMuted(this.settings.muted);

    this.projectileRenderer = new ProjectileRenderer(this.scene);
    this.lightPool = new LightPool({ scene: this.scene.scene, capacity: 32 });

    this.currency = new CurrencySystem();
    this.world = new World({
      scene: this.scene,
      camera: this.scene.camera,
      audio: this.audio,
      voice: this.voice,
      eventBus,
      currency: this.currency,
      createAsteroid,
      projectileRenderer: this.projectileRenderer,
      lightPool: this.lightPool,
    });

    this.perfOverlay = new PerfOverlay({
      renderer: this.scene.renderer,
      world: this.world,
    });
    this.qualityController = new QualityController({
      renderer: this.scene.renderer,
      composer,
      postPasses,
      getFps: () => this.perfOverlay.getStats().fps,
    });
    this._applySettingsToPerf();
    this.perfOverlay.setLoggingEnabled(this._perfLogEnabled);

    this.ui = new UIManager();
    this.hud = new HUD();
    this.arenaHUD = new ArenaHUD();
    this.transition = new RoundTransition();
    this.damageNumbers = new DamageNumbers();
    this.settingsUI = new SettingsUI(this.settings, this.audio, this.voice);
    this.debugMenu = new DebugMenuUI(this);

    this.techTree = null;
    this.techTreeUI = null;
    this.spawnDirector = null;
    this.upgradeApplier = null;
    this.arenaDirector = null;
    this.collision = new CollisionCoordinator(this.world);
    this._arenaKeys = { left: false, right: false, up: false, down: false };
    this._arenaVel = { x: 0, z: 0 };
    this._arenaBank = 0;
    this._arenaInitSpeed = false;
    this._prevBossMusicActive = false;
    this._paused = false;
    this._techTreeOpen = false;
    this.hangarUI = null;
    this.storeUI = null;
    this.researchUI = null;
    this.upgradeEditor = null;

    this._focusPickRaycaster = new THREE.Raycaster();
    this._focusPickNdc = new THREE.Vector2();

    this._setupEventListeners();
    this._setupClickHandling();
    this._setupManualGunInput();
    this._setupAbilityKeys();
    this._setupArenaInput();
    this._setupSettingsButton();
    this._setupDebugMenuHotkey();
    this._setupPauseControls();
    this._setupPerfOverlayHotkey();
    this._setupSettingsListener();
    if (import.meta.env.DEV) this._setupUpgradeEditor();
  }

  _applySettingsToPerf() {
    if (this.settings.showFps) this.perfOverlay.show();
    else this.perfOverlay.hide();
    this.qualityController.setMode(this.settings.graphicsQuality);
  }

  _setupSettingsListener() {
    this.settings.onChange((key) => {
      if (key === 'showFps') {
        if (this.settings.showFps) this.perfOverlay.show();
        else this.perfOverlay.hide();
      } else if (key === 'graphicsQuality') {
        this.qualityController.setMode(this.settings.graphicsQuality);
      } else if (key === 'reset') {
        this._applySettingsToPerf();
      }
    });
  }

  _setupPerfOverlayHotkey() {
    window.addEventListener('keydown', e => {
      if (e.code !== 'F3' || e.repeat) return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      const next = !this.settings.showFps;
      this.settings.setShowFps(next);
    });
    // Shift+F3: toggle diagnostic perf logging (hitch lines + section breakdowns).
    window.addEventListener('keydown', e => {
      if (e.code !== 'F3' || !e.shiftKey || e.repeat) return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      this.setPerfLogEnabled(!this._perfLogEnabled);
    });
    // Alt+F3: toggle full composer bypass. Runs plain renderer.render().
    window.addEventListener('keydown', e => {
      if (e.code !== 'F3' || !e.altKey || e.repeat) return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      this._bypassComposer = !this._bypassComposer;
      this.scene.setBypassComposer(this._bypassComposer);
      console.log(`[perf] composer bypass ${this._bypassComposer ? 'ON (plain renderer)' : 'OFF (composer)'}`);
    });
  }

  /** Records the time at this label relative to the start of the current tick. */
  _profMark(label) {
    if (!this._profMarks) this._profMarks = [];
    this._profMarks.push([label, performance.now()]);
  }

  /** At end of tick, if total cost was high enough, log a breakdown. */
  _profFlush() {
    const marks = this._profMarks;
    if (!marks || marks.length < 2) { if (marks) marks.length = 0; return; }
    if (!this._perfLogEnabled) { marks.length = 0; return; }
    const total = marks[marks.length - 1][1] - marks[0][1];
    if (total >= 50) {
      const parts = [];
      for (let i = 1; i < marks.length; i++) {
        const d = marks[i][1] - marks[i - 1][1];
        if (d >= 1) parts.push(`${marks[i][0]}=${d.toFixed(1)}`);
      }
      const draws = this.scene.renderer.info.render.calls;
      const tris = this.scene.renderer.info.render.triangles;
      console.warn(`[perf] tick=${total.toFixed(1)}ms ${parts.join(' ')} draw=${draws} tris=${tris}`);
    }
    marks.length = 0;
  }

  /** Toggles all diagnostic perf logging in one place. */
  setPerfLogEnabled(on) {
    const next = !!on;
    if (next === this._perfLogEnabled) return;
    this._perfLogEnabled = next;
    this.perfOverlay.setLoggingEnabled(next);
    if (next) {
      console.log(`[perf] logging ON (hitches >100ms + section breakdowns >50ms)`);
      this._logGpuInfo();
    } else {
      console.log(`[perf] logging OFF`);
    }
  }

  /** Log WebGL renderer/vendor so we can confirm GPU accel. */
  _logGpuInfo() {
    try {
      const gl = this.scene.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const dpr = window.devicePixelRatio;
      const pr = this.scene.renderer.getPixelRatio();
      const size = this.scene.renderer.getSize(new THREE.Vector2());
      console.log(`[perf] GPU: ${vendor} / ${renderer} | dpr=${dpr} pixelRatio=${pr} size=${size.x}x${size.y}`);
    } catch (e) { /* ignore */ }
  }

  _setupEventListeners() {
    eventBus.on(EVENTS.PLAYER_DIED, () => this._handlePlayerDied());

    eventBus.on(EVENTS.ENEMY_DAMAGED, ({ entity, damage, isCrit }) => {
      const t = entity?.get?.('TransformComponent');
      if (!t) return;
      const screen = this.scene.worldToScreen(t.position);
      this.damageNumbers.spawn(screen.x, screen.y, damage, isCrit, false);
    });

    eventBus.on(EVENTS.UPGRADE_PURCHASED, () => { this._rebuildComputed(); this._saveNow(); });
    eventBus.on(EVENTS.UPGRADE_SOLD, () => { this._rebuildComputed(); this._saveNow(); });
    eventBus.on(EVENTS.GALAXY_BOSS_PENDING, ({ galaxyIndex }) => this._enterBossArena(galaxyIndex));
    eventBus.on(EVENTS.ARENA_WARNING, () => this.audio?.play('warning'));
    eventBus.on(EVENTS.ARENA_TRANSITION_STARTED, () => {
      this.audio?.play('warp');
      this._resetArenaFlight();
    });
    eventBus.on(EVENTS.ARENA_COMPLETE, () => this._resetArenaFlight());
    eventBus.on(EVENTS.SHIP_PURCHASED, () => this._saveNow());

    eventBus.on(EVENTS.CURRENCY_CHANGED, () => {
      if (this.techTreeUI) this.techTreeUI.updateCurrencyBar(this.state);
    });

    eventBus.on(EVENTS.SHIP_SELECTED, () => this._rebuildPlayerEntityForShipChange());

    // Flush save when the tab is closed / hidden so hangar tweaks made within
    // the 30 s autosave window aren't lost.
    window.addEventListener('beforeunload', () => this._saveNow());
    window.addEventListener('pagehide', () => this._saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._saveNow();
    });
  }

  /** Immediate save if state + techTree are ready. Safe to call any time. */
  _saveNow() {
    if (!this.state || !this.techTree) return;
    this.saveManager.save(this.state, this.techTree);
  }

  /**
   * Switching ships changes the mesh variant + weapon slot layout, both baked
   * into ShipVisualsComponent at attach time. Easier to rebuild the whole
   * player entity than to hot-swap every dependent component. Only valid
   * between runs (dead/start phase), so we never do this mid-combat.
   */
  _rebuildPlayerEntityForShipChange() {
    if (!this.state || !this.world) return;
    const phase = this.state.round.phase;
    if (phase === 'combat') return;
    if (this.playerEntity) {
      this.playerEntity.destroy();
      this.world._sweep();
    }
    this.playerEntity = createPlayer({ settings: this.settings, state: this.state });
    this.world.setContext({ playerEntity: this.playerEntity });
    this.world.spawn(this.playerEntity);
    if (this.upgradeApplier) this.upgradeApplier.playerEntity = this.playerEntity;
    this._rebuildComputed();
    this.hangarUI?.onShipChanged?.();
  }

  /**
   * Shared teardown when leaving combat for the meta layer (death screen or hangar).
   * Does not touch audio or pause state.
   */
  _finalizeCombatRunForMeta() {
    if (!this.state) return;
    const r = this.state.round;
    this.state.lastRun = {
      distance: r.distanceTraveled,
      tier: r.current,
      enemiesDefeated: r.enemiesDefeated,
      bossesDefeated: r.bossesDefeated,
      loot: { ...this.state.roundLoot },
    };

    if (!this.state.warpGates) this.state.warpGates = { maxTierReached: 0 };
    if (r.current > this.state.warpGates.maxTierReached) {
      this.state.warpGates.maxTierReached = r.current;
    }

    // Update campaign progress: track highest galaxy reached
    if (this.state.campaign) {
      const galaxyReached = Math.floor((r.current - 1) / CAMPAIGN.SECTORS_PER_GALAXY);
      if (galaxyReached > this.state.campaign.galaxyIndex) {
        this.state.campaign.galaxyIndex = Math.min(galaxyReached, CAMPAIGN.GALAXIES - 1);
      }
    }

    r.phase = 'dead';
    r.bossIsActive = false;

    if (this._techTreeOpen) {
      this._techTreeOpen = false;
      this.ui.hide('techTree');
      if (this.techTreeUI) this.techTreeUI.close();
    }

    this.spawnDirector.purgeCombatWorld();
    for (const e of this.world.query('projectile_player')) e.destroy();
    for (const e of this.world.query('projectile_enemy')) e.destroy();
    for (const e of this.world.query('asteroid')) e.destroy();

    this.ui.hide('hud');
  }

  _handlePlayerDied() {
    const health = this.playerEntity?.get('HealthComponent');
    if (health && !health.dead) return;
    if (!this.state) return;

    this.setPaused(false);
    this.audio.stopMusic();
    this.audio.play('death');

    this._finalizeCombatRunForMeta();

    this.ui.showDeath(
      this.state.lastRun,
      () => this._openTechTree(),
      () => this._showWarpGateAndLaunch(),
      () => this._openHangar(),
    );
  }

  /** Pause menu only: must already be paused during combat. */
  _confirmEndRunToHangarFromPauseMenu() {
    if (!this.state || this.state.round.phase !== 'combat' || !this._paused) return;
    const ok = window.confirm(
      'Return to the hangar? This ends the current run. Your currencies, upgrades, and sector stats are saved.',
    );
    if (!ok) return;
    this.setPaused(false);
    this.audio.stopMusic();
    this._finalizeCombatRunForMeta();
    this.saveManager.save(this.state, this.techTree);
    this._openHangar();
  }

  _setupSettingsButton() {
    const btn = document.getElementById('settings-btn');
    if (btn) btn.onclick = () => {
      if (this.settingsUI.isOpen) this.settingsUI.close();
      else this.settingsUI.open();
    };
    window.addEventListener('keydown', e => {
      if (e.code !== 'Escape') return;
      if (this._isTypingTarget(e.target)) return;
      if (this.settingsUI.isOpen) {
        this.settingsUI.close();
        e.preventDefault();
        return;
      }
      if (this.debugMenu.isOpen) {
        this.debugMenu.close();
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (this._paused && this.state) {
        this.setPaused(false);
        e.preventDefault();
        return;
      }
      if (this.state && isCombatPhase(this.state.round.phase)) {
        e.preventDefault();
        this.setPaused(true);
      }
    });
  }

  _isTypingTarget(el) {
    return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
  }

  setPaused(on, options = {}) {
    const want = !!on;
    if (want === this._paused) return;
    if (want && (!this.state || this.state.round.phase === 'dead')) return;
    this._paused = want;
    const ov = document.getElementById('pause-overlay');
    const showOverlay = options.showPauseOverlay !== false;
    if (want && this.state) {
      if (showOverlay) { ov?.classList.remove('hidden'); ov?.setAttribute('aria-hidden', 'false'); }
      else { ov?.classList.add('hidden'); ov?.setAttribute('aria-hidden', 'true'); }
      this.audio.pauseMusic();
      this.voice?.pauseAll();
    } else {
      ov?.classList.add('hidden');
      ov?.setAttribute('aria-hidden', 'true');
      this.audio.resumeMusic();
      this.voice?.resumeAll();
    }
  }

  togglePause(options) {
    if (this._paused) this.setPaused(false);
    else this.setPaused(true, options);
  }

  _setupPauseControls() {
    document.getElementById('pause-resume-btn')?.addEventListener('click', () => this.setPaused(false));
    document.getElementById('pause-return-hangar-btn')?.addEventListener('click', () => {
      this._confirmEndRunToHangarFromPauseMenu();
    });
    document.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('pause-settings-btn')?.addEventListener('click', () => {
      if (this.settingsUI.isOpen) this.settingsUI.close();
      else this.settingsUI.open();
    });
    window.addEventListener('keydown', e => {
      if (e.code !== 'KeyP' || e.repeat) return;
      if (this._isTypingTarget(e.target)) return;
      if ((this.debugMenu.isOpen || this.settingsUI.isOpen) && !this._paused) return;
      e.preventDefault();
      this.togglePause();
    });
  }

  _setupDebugMenuHotkey() {
    window.addEventListener('keydown', e => {
      if (!e.ctrlKey || !e.shiftKey || e.code !== 'KeyD') return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      this.debugMenu.toggle();
    });
  }

  async _setupUpgradeEditor() {
    try {
      const { UpgradeEditor } = await import('./devtools/UpgradeEditor.js');
      this.upgradeEditor = new UpgradeEditor(
        () => this.techTree,
        () => this.techTreeUI,
        () => this._rebuildComputed()
      );
      window.addEventListener('keydown', e => {
        if (!e.ctrlKey || !e.shiftKey || e.code !== 'KeyU') return;
        if (this._isTypingTarget(e.target)) return;
        e.preventDefault();
        this.upgradeEditor.toggle();
      });
    } catch (err) {
      console.error('[UpgradeEditor] Failed to load:', err);
    }
  }

  _debugGrantCurrencies(amounts) {
    if (!this.state || !amounts) return;
    for (const [type, amount] of Object.entries(amounts)) {
      if (this.state.currencies[type] === undefined) continue;
      this.currency.add(type, amount);
    }
  }

  _debugSpawnEnemy(typeName) {
    if (!this.state) return;
    const spawned = this.spawnDirector?.debugSpawn(typeName);
    if (spawned === null) {
      window.alert('Spawn only works during an active run (combat phase). Launch from the hangar first.');
    }
  }

  /**
   * Jump directly into the boss arena for a chosen galaxy, bypassing normal
   * progression. Starts a fresh run at that galaxy's starting tier, then
   * kicks off the arena transition immediately.
   */
  _debugJumpToArena(galaxyIndex) {
    if (!this.state) return;
    const clamped = Math.max(0, Math.min(CAMPAIGN.GALAXIES - 1, galaxyIndex | 0));
    const phase = this.state.round.phase;
    if (phase === 'boss_arena' || phase === 'arena_transition') {
      this.arenaDirector?.exit();
      this.state.bossArena = { active: false, subPhase: 'inactive', bossDefeated: false, gatesTotal: 3, gatesClosed: 0, buildProgress: 0 };
      this.ui.hide('arenaHud');
    }
    this.ui.hide('death');
    this.ui.hide('techTree');
    this.ui.hide('warpGate');
    this.ui.hide('hangar');
    this._startNewRun(clamped);
    this._enterBossArena(clamped);
  }

  _debugResetGame() {
    this.setPaused(false);
    this.transition.hide();
    this.ui.hide('death');
    this.settingsUI.close();
    document.getElementById('start-screen')?.classList.add('hidden');

    if (this.state) {
      this.spawnDirector?.purgeCombatWorld();
      this.world.destroyAll();
      this.playerEntity = null;
    }

    this.saveManager.clearSave();
    this.state = createInitialState();
    this.state.round.phase = 'dead';
    this.techTree = new TechTreeState(this.state.seed);
    this._initWorldForState();
    this._rebuildComputed();
    this.currency.init(this.state);

    if (this.techTreeUI) this.techTreeUI.setTree(this.techTree);
    else this._setupTechTreeUI();

    this._techTreeOpen = false;
    this.ui.hide('hud');
    this.ui.hide('techTree');
    if (this.techTreeUI) this.techTreeUI.close();
    this.audio.stopMusic();
    this.ui.showDeath(null, () => this._openTechTree(), () => this._startNewRun(), () => this._openHangar());
  }

  _setupClickHandling() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', (ev) => {
      if (this._paused) return;
      const phase = this.state?.round?.phase;
      if (phase !== 'combat' && phase !== 'boss_arena' && phase !== 'arena_transition') return;
      if (phase === 'combat' && this._tryPriorityFocusClick(ev)) return;
      const rail = this.playerEntity?.get('RailgunComponent');
      if (rail) rail.beginCharge();
    });

    canvas.addEventListener('mouseup', (ev) => {
      if (ev.button !== 0) return;
      this.playerEntity?.get('RailgunComponent')?.releaseCharge();
    });
  }

  _tryPriorityFocusClick(ev) {
    if (!this.state || this.state.round.phase !== 'combat') return false;
    const stats = this.playerEntity?.get('PlayerStatsComponent');
    if (!stats?.manualTargetFocusEnabled) return false;

    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    this._focusPickNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this._focusPickNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this._focusPickRaycaster.setFromCamera(this._focusPickNdc, this.scene.camera);

    const enemies = Array.from(this.world.query('enemy'));
    const roots = [];
    const map = new Map();
    for (const e of enemies) {
      const vis = e.get('EnemyVisualsComponent');
      if (vis?.group) { roots.push(vis.group); map.set(vis.group, e); }
    }
    if (!roots.length) return false;
    const hits = this._focusPickRaycaster.intersectObjects(roots, true);
    if (!hits.length) return false;

    let o = hits[0].object;
    while (o) {
      const picked = map.get(o);
      if (picked) {
        this.state.round.manualFocusEnemyId = picked.id;
        return true;
      }
      o = o.parent;
    }
    return false;
  }

  _setupManualGunInput() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (this._paused) return;
      if (this._isTypingTarget(e.target)) return;
      const phase = this.state?.round?.phase;
      if (phase !== 'combat' && phase !== 'boss_arena' && phase !== 'arena_transition') return;
      if (phase === 'combat' && this._tryPriorityFocusClick(e)) return;
      const manual = this.playerEntity?.get('ManualGunComponent');
      if (!manual) return;
      e.preventDefault();
      manual.fire();
    });

    window.addEventListener('keydown', e => {
      if (e.code !== 'Space') return;
      if (this._paused) return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      this.playerEntity?.get('ManualGunComponent')?.fire();
    });
    window.addEventListener('keyup', e => {
      if (e.code !== 'Space') return;
      if (this._paused) return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      this.playerEntity?.get('ManualGunComponent')?.stopFiring();
    });

    window.addEventListener('pointerup', e => {
      if (e.button !== 0) return;
      if (this._paused) return;
      if (this._isTypingTarget(e.target)) return;
      e.preventDefault();
      this.playerEntity?.get('ManualGunComponent')?.stopFiring();
    });
  }

  _setupAbilityKeys() {
    const ABILITY_ORDER = [
      'SpeedBoostComponent', 'EmpAbilityComponent', 'WarpDriveComponent',
      'GravityBombComponent', 'DecoyAbilityComponent',
    ];
    window.addEventListener('keydown', e => {
      if (this._paused) return;
      const phase = this.state?.round.phase;
      if (phase !== 'combat' && phase !== 'boss_arena' && phase !== 'arena_transition') return;
      if (this._isTypingTarget(e.target)) return;
      const slot = parseInt(e.key, 10) - 1;
      if (slot < 0 || slot > 3) return;
      const active = ABILITY_ORDER
        .map(name => this.playerEntity?.get(name))
        .filter(Boolean);
      active[slot]?.trigger(this.world.ctx);
    });
  }

  _setupArenaInput() {
    const setKey = (code, val) => {
      if (code === 'ArrowLeft'  || code === 'KeyA') this._arenaKeys.left  = val;
      if (code === 'ArrowRight' || code === 'KeyD') this._arenaKeys.right = val;
      if (code === 'ArrowUp'    || code === 'KeyW') this._arenaKeys.up    = val;
      if (code === 'ArrowDown'  || code === 'KeyS') this._arenaKeys.down  = val;
    };
    window.addEventListener('keydown', e => {
      if (this._paused) return;
      const phase = this.state?.round?.phase;
      if (phase !== 'boss_arena' && phase !== 'arena_transition') return;
      if (this._isTypingTarget(e.target)) return;
      setKey(e.code, true);
    });
    window.addEventListener('keyup', e => {
      setKey(e.code, false);
    });
  }

  /**
   * Inertia-lite arena flight controller.
   *
   * Velocity is a world-space vector kept in `this._arenaVel`, independent of
   * the ship's yaw. W adds thrust along the current nose; S applies retro
   * thrust along the current velocity (brake). Releasing both = coast (no
   * drag). A/D yaw the nose only — velocity lingers, so hard turns produce
   * visible sideways drift. A mild "velocity relaxes toward nose" pull keeps
   * the ship from ever flying permanently backwards.
   *
   * Soft edge-band steering auto-yaws toward origin and bleeds the outward
   * component of velocity when inside EDGE_BAND of a wall.
   */
  _tickArenaInput(dt) {
    if (!this.playerEntity) return;
    const t = this.playerEntity.get('TransformComponent');
    if (!t) return;

    const baseSpd = (this.computed?.speed ?? 3) * BOSS_ARENA.BASE_SPEED_MULT;
    const maxV    = baseSpd * BOSS_ARENA.MAX_SPEED_MULT;

    // Seed an initial forward coast the first frame the arena runs, so the
    // ship doesn't start from a dead stop.
    if (!this._arenaInitSpeed) {
      const fx0 = -Math.sin(t.rotation.y);
      const fz0 = -Math.cos(t.rotation.y);
      const v0 = baseSpd * BOSS_ARENA.INITIAL_SPEED_MULT;
      this._arenaVel.x = fx0 * v0;
      this._arenaVel.z = fz0 * v0;
      this._arenaInitSpeed = true;
    }

    const yawInput = (this._arenaKeys.left ? 1 : 0) - (this._arenaKeys.right ? 1 : 0);
    t.rotation.y += yawInput * BOSS_ARENA.YAW_SPEED * dt;

    // Ship-local -Z is forward; rotation.y yaws around Y.
    const yaw = t.rotation.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);

    // Forward thrust along nose.
    if (this._arenaKeys.up) {
      const a = baseSpd * BOSS_ARENA.THRUST_ACCEL_MULT * dt;
      this._arenaVel.x += fx * a;
      this._arenaVel.z += fz * a;
    }

    // Retro brake along velocity (never flips sign — clamps to zero).
    if (this._arenaKeys.down) {
      const s = Math.hypot(this._arenaVel.x, this._arenaVel.z);
      if (s > 0.001) {
        const dv = Math.min(s, baseSpd * BOSS_ARENA.BRAKE_DECEL_MULT * dt);
        this._arenaVel.x -= (this._arenaVel.x / s) * dv;
        this._arenaVel.z -= (this._arenaVel.z / s) * dv;
      }
    }

    // Mild velocity-aligns-with-nose pull (arcade forgiveness). Preserves
    // speed magnitude; just rotates the vector toward (fx, fz).
    let speed = Math.hypot(this._arenaVel.x, this._arenaVel.z);
    if (speed > 0.001 && BOSS_ARENA.VELOCITY_ALIGN_TAU > 0) {
      const k = 1 - Math.exp(-dt / BOSS_ARENA.VELOCITY_ALIGN_TAU);
      this._arenaVel.x += (fx * speed - this._arenaVel.x) * k;
      this._arenaVel.z += (fz * speed - this._arenaVel.z) * k;
      speed = Math.hypot(this._arenaVel.x, this._arenaVel.z);
    }

    // Edge band: auto-steer yaw toward origin and scrub the outward component
    // of velocity so the ship peels off the wall instead of sticking to it.
    const band = BOSS_ARENA.EDGE_BAND;
    const px = t.position.x, pz = t.position.z;
    const distToEdgeX = Math.min(px - BOSS_ARENA.X_MIN, BOSS_ARENA.X_MAX - px);
    const distToEdgeZ = Math.min(pz - BOSS_ARENA.Z_MIN, BOSS_ARENA.Z_MAX - pz);
    const minEdge = Math.min(distToEdgeX, distToEdgeZ);
    let edgePressure = 1 - minEdge / band;
    if (edgePressure < 0) edgePressure = 0;
    if (edgePressure > 0) {
      const toOrigin = Math.atan2(px, pz);
      let dyaw = toOrigin - yaw;
      while (dyaw >  Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const turnRate = Math.min(edgePressure, 4) * 3.0;
      const maxDelta = turnRate * dt;
      const step = Math.max(-maxDelta, Math.min(maxDelta, dyaw));
      t.rotation.y += step;

      // Bleed the outward radial component of velocity (toward origin = (-px,-pz)/|p|).
      const pmag = Math.hypot(px, pz);
      if (pmag > 0.001) {
        const ox = px / pmag, oz = pz / pmag;           // outward unit vector
        const radial = this._arenaVel.x * ox + this._arenaVel.z * oz; // positive = moving outward
        if (radial > 0) {
          const bleed = Math.min(1, Math.min(edgePressure, 2) * 4 * dt);
          this._arenaVel.x -= ox * radial * bleed;
          this._arenaVel.z -= oz * radial * bleed;
        }
      }
    }

    // Hard cap on velocity magnitude.
    speed = Math.hypot(this._arenaVel.x, this._arenaVel.z);
    if (speed > maxV) {
      const s = maxV / speed;
      this._arenaVel.x *= s;
      this._arenaVel.z *= s;
      speed = maxV;
    }

    // Minimum forward velocity — no full stop. Keeps pressure on the player
    // and preserves the "flying through space" feel. Preserves current heading
    // if one exists; otherwise nudges forward along the nose.
    const minV = baseSpd * BOSS_ARENA.MIN_SPEED_MULT;
    if (speed < minV) {
      if (speed > 0.001) {
        const s = minV / speed;
        this._arenaVel.x *= s;
        this._arenaVel.z *= s;
      } else {
        this._arenaVel.x = fx * minV;
        this._arenaVel.z = fz * minV;
      }
      speed = minV;
    }

    t.position.x += this._arenaVel.x * dt;
    t.position.z += this._arenaVel.z * dt;

    // Visual bank: bank INTO the turn (left turn → left wing dips → right
    // wing up → positive rotation.z in three.js). yawInput=+1 is a left turn,
    // so bank term is +yawInput. Lateral slip reinforces it: slipNorm>0 means
    // sliding to ship-right (= turning left faster than velocity follows), so
    // bank further left (positive).
    // Right vector (ship-local +X in world) = (cos(yaw), 0, -sin(yaw)).
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const slipDot = this._arenaVel.x * rx + this._arenaVel.z * rz; // positive = sliding to ship-right
    const slipNorm = Math.max(-1, Math.min(1, slipDot / Math.max(0.001, maxV)));
    const targetBank = yawInput * 0.55 + slipNorm * 0.35;
    this._arenaBank += (targetBank - this._arenaBank) * Math.min(1, dt * 7);
    t.rotation.z = this._arenaBank;
    t.rotation.x = 0;

    // Sync the ship mesh position/rotation (ShipVisualsComponent also mirrors
    // from TransformComponent in its update, but this keeps the hull in sync
    // the same frame for the camera follow below).
    const vis = this.playerEntity.get('ShipVisualsComponent');
    if (vis?._group) {
      vis._group.position.copy(t.position);
      vis._group.rotation.copy(t.rotation);
    }

    // Feed cinematic camera (roll already comes from ship rotation; these
    // drive speed FOV and chase swing).
    const speedRatio = Math.max(0, Math.min(1, speed / Math.max(0.001, maxV)));
    this.camera?.setSpeedRatio?.(speedRatio);
    this.camera?.setYawInput?.(yawInput);

    // Trail component uses the same ratio to fade in/brighten the line.
    const trail = this.playerEntity.get('ArenaTrailComponent');
    trail?.setSpeedRatio?.(speedRatio);

    // Thrust plume level: hold W for full flare, S cuts to near-zero,
    // neither holds an idle baseline so the engines always read as "on".
    const thrust = this._arenaKeys.up ? 1.0
      : this._arenaKeys.down ? 0.05
      : 0.4;
    this.playerEntity.get('ShipVisualsComponent')?.setThrust?.(thrust);
  }

  /** Reset arena flight state on enter/exit so next run starts clean. */
  _resetArenaFlight() {
    this._arenaVel.x = 0;
    this._arenaVel.z = 0;
    this._arenaBank = 0;
    this._arenaInitSpeed = false;
    this.camera?.setSpeedRatio?.(0);
    this.camera?.setYawInput?.(0);
    this.playerEntity?.get('ArenaTrailComponent')?.reset?.();
    this.playerEntity?.get('ShipVisualsComponent')?.setThrust?.(0.4);
  }

  /** Exposed so enemy AI / lead calculations can read the arena velocity. */
  getArenaVelocity() {
    return this._arenaVel;
  }

  async start() {
    this.ui.showStart(() => {
      this.audio.init();
      this._loadOrNewGame();
    });
    this.loop.onUpdate(delta => this._tick(delta));
    this.loop.start();
  }

  _loadOrNewGame() {
    const saved = this.saveManager.load();
    if (saved) {
      this.state = saved;
      this.techTree = new TechTreeState(this.state.seed);
      this.techTree.loadFromSave(
        saved.techTree?.unlockedNodes || {},
        saved.techTree?.generatedTiers || 0,
        saved.techTree?.masteryLevels || {}
      );
      this._initWorldForState();
      this._rebuildComputed();
      this._setupTechTreeUI();

      const offline = this.saveManager.calculateOfflineEarnings(
        saved.lastActiveTime,
        this.computed.stellarDustRate
      );
      this.state.round.phase = 'dead';

      if (offline && offline.earnings.stellarDust > 0) {
        this.currency.add('stellarDust', offline.earnings.stellarDust);
      }
      this.ui.showDeath(
        this.state.lastRun ?? null,
        () => this._openTechTree(),
        () => this._showWarpGateAndLaunch(),
        () => this._openHangar(),
      );
    } else {
      this._newGame();
    }
    this.state.lastActiveTime = Date.now();
  }

  _newGame() {
    this.state = createInitialState();
    this.state.round.phase = 'dead';
    this.techTree = new TechTreeState(this.state.seed);
    this._initWorldForState();
    this._rebuildComputed();
    this._setupTechTreeUI();
    this.ui.showDeath(null, () => this._openTechTree(), () => this._showWarpGateAndLaunch(), () => this._openHangar());
  }

  _initWorldForState() {
    this.playerEntity = createPlayer({ settings: this.settings, state: this.state });
    this.world.setContext({
      state: this.state,
      playerEntity: this.playerEntity,
      spawnLoot: (pos, currency, amount) => this.spawnDirector?.spawnLootAt(pos, currency, amount),
      camera: this.camera,
    });
    this.world.spawn(this.playerEntity);

    this.spawnDirector = new SpawnDirector({
      world: this.world, state: this.state, currency: this.currency,
    });
    this.spawnDirector.init();

    this.arenaDirector = new ArenaDirector({
      world: this.world, state: this.state, scene: this.scene,
      camera: this.camera, spawnDirector: this.spawnDirector, audio: this.audio,
      synthGrid: this.synthGrid, starfield: this.starfield,
    });

    this.upgradeApplier = new UpgradeApplier({
      world: this.world, state: this.state, playerEntity: this.playerEntity,
    });
  }

  _setupTechTreeUI() {
    this.currency.init(this.state);
    this.techTreeUI = new TechTreeUI(this.techTree, this.currency, this.audio);
    this.ui.bindTechTreeButtons(
      () => this._openTechTree(),
      () => this._closeTechTree()
    );
    this.ui.bindMuteButton(this.audio, this.settings);
    this._setupHangarUI();
  }

  _setupHangarUI() {
    if (this.hangarUI) return; // one-shot: these UIs are stateless wrt runs
    this.hangarUI = new HangarUI({
      state: this.state,
      currency: this.currency,
      upgradeApplier: this.upgradeApplier,
      techTree: this.techTree,
      onLaunch: () => { this._closeHangar(); this._showWarpGateAndLaunch(); },
      onOpenStore: (slotId) => this._openStore(slotId),
      onOpenResearch: () => this._openResearch(),
      onOpenTechTree: () => { this._closeHangar(); this._openTechTree(); },
      onClose: () => this._onHangarClosed(),
    });
    this.storeUI = new StoreUI({
      state: this.state,
      currency: this.currency,
      onClose: () => this._onStoreClosed(),
    });
    this.researchUI = new ResearchUI({
      state: this.state,
      currency: this.currency,
      onClose: () => this._onResearchClosed(),
    });
  }

  _openHangar() {
    this._techTreeOpen = false;
    this.ui.hide('hud');
    this.ui.hide('death');
    this.ui.hide('techTree');
    this.techTreeUI?.close?.();
    this.ui.show('hangar');
    this.hangarUI.open();
    if (this.state.round.phase !== 'combat') this.audio.playMusic('tech-tree');
  }

  _closeHangar() {
    this.hangarUI?.close();
  }

  _onHangarClosed() {
    this.ui.hide('hangar');
    if (this.state.round.phase !== 'combat') {
      this.ui.showDeath(
        this.state.lastRun,
        () => this._openTechTree(),
        () => this._showWarpGateAndLaunch(),
        () => this._openHangar(),
      );
    } else {
      this.ui.show('hud');
    }
  }

  _openStore(slotId = null) {
    this.ui.show('store');
    this.storeUI.open(slotId);
  }

  _onStoreClosed() { this.ui.hide('store'); }

  _openResearch() {
    this.ui.show('research');
    this.researchUI.open();
  }

  _onResearchClosed() { this.ui.hide('research'); }

  _combatMusicKey() {
    return this.state?.round?.bossIsActive ? 'boss' : 'combat';
  }

  _rebuildComputed() {
    if (!this.upgradeApplier) return;
    this.computed = this.upgradeApplier.apply(this.techTree);
    this.state._computed = this.computed;

    const p = this.state.player;
    const health = this.playerEntity.get('HealthComponent');
    const shield = this.playerEntity.get('ShieldComponent');
    const energy = this.playerEntity.get('EnergyComponent');
    if (health) {
      health.hp = Math.min(p.hp ?? health.maxHp, health.maxHp);
      p.hp = health.hp;
      p.maxHp = health.maxHp;
    }
    if (shield) {
      shield.hp = Math.min(p.shieldHp ?? 0, shield.maxHp);
      p.shieldHp = shield.hp;
    }
    if (energy) {
      energy.current = Math.min(p.energy ?? energy.max, energy.max);
      p.energy = energy.current;
    }

    eventBus.emit(EVENTS.STATS_UPDATED, this.computed);
  }

  _openTechTree() {
    this._techTreeOpen = true;
    this.ui.hide('hud');
    this.ui.hide('death');
    this.ui.show('techTree');
    this.techTreeUI.open(this.state, this.computed);
    if (this.state.round.phase !== 'combat') this.audio.playMusic('tech-tree');
  }

  _closeTechTree() {
    this._techTreeOpen = false;
    this.ui.hide('techTree');
    this.techTreeUI.close();
    const phase = this.state.round.phase;
    if (phase === 'combat') {
      this.ui.show('hud');
      this._prevBossMusicActive = !!this.state.round.bossIsActive;
      this.audio.playMusic(this._combatMusicKey());
    } else {
      this.ui.showDeath(
        this.state.lastRun,
        () => this._openTechTree(),
        () => this._showWarpGateAndLaunch(),
        () => this._openHangar(),
      );
    }
  }

  _getUnlockedGalaxies() {
    const c = this.state.campaign;
    if (!c) return [{ galaxyIndex: 0, name: CAMPAIGN.GALAXY_NAMES[0], startTier: 1 }];
    const maxUnlocked = Math.min(c.galaxyIndex, CAMPAIGN.GALAXIES - 1);
    const galaxies = [];
    for (let i = 0; i <= maxUnlocked; i++) {
      galaxies.push({
        galaxyIndex: i,
        name: CAMPAIGN.GALAXY_NAMES[i] || `Galaxy ${i + 1}`,
        startTier: i * CAMPAIGN.SECTORS_PER_GALAXY + 1,
      });
    }
    return galaxies;
  }

  _showWarpGateAndLaunch() {
    const galaxies = this._getUnlockedGalaxies();
    if (galaxies.length <= 1) { this._startNewRun(0); return; }
    this.ui.hide('death');
    this.ui.showGalaxySelect(galaxies, (galaxyIndex) => this._startNewRun(galaxyIndex));
  }

  _startNewRun(galaxyIndex = 0) {
    this._techTreeOpen = false;
    this.ui.hide('techTree');
    this.ui.hide('death');
    this.ui.hide('warpGate');
    if (this.techTreeUI) this.techTreeUI.close();
    this.ui.show('hud');
    this.audio.play('launch');

    const r = this.state.round;
    if (this.computed.interestRate > 0) {
      const interest = Math.floor(this.state.currencies.scrapMetal * this.computed.interestRate);
      if (interest > 0) this.currency.add('scrapMetal', interest);
    }

    const clampedGalaxy = Math.max(0, Math.min(CAMPAIGN.GALAXIES - 1, galaxyIndex));
    const startTier = clampedGalaxy * CAMPAIGN.SECTORS_PER_GALAXY + 1;
    const startDist = clampedGalaxy > 0 ? (startTier - 1) * RUN.DISTANCE_PER_TIER : 0;
    r.distanceTraveled = startDist;
    r.current = startTier;
    r.enemiesDefeated = 0;
    r.bossesDefeated = clampedGalaxy;
    r.bossIsActive = false;
    r.killsThisRun = 0;
    this.state.roundLoot = {};

    // Sync campaign galaxy index to match chosen start point
    if (!this.state.campaign) this.state.campaign = { galaxyIndex: 0, totalSectorsCleared: 0, infiniteMode: false, infiniteSector: 0 };
    this.state.campaign.galaxyIndex = clampedGalaxy;

    // Apply galaxy environment
    this.scene.applyEnvironment(getPreset(clampedGalaxy), true);
    this.synthGrid.setColor(getPreset(clampedGalaxy).gridColor);

    const health = this.playerEntity.get('HealthComponent');
    const shield = this.playerEntity.get('ShieldComponent');
    const energy = this.playerEntity.get('EnergyComponent');
    if (health) { health.hp = health.maxHp; health.dead = false; }
    if (shield) shield.hp = 0;
    if (energy) energy.current = energy.max;

    this.spawnDirector.purgeCombatWorld();
    for (const e of this.world.query('projectile_player')) e.destroy();
    for (const e of this.world.query('projectile_enemy')) e.destroy();
    for (const e of this.world.query('asteroid')) e.destroy();

    this.spawnDirector.startRound();
    this.hud.show();

    this._prevBossMusicActive = !!r.bossIsActive;
    this.audio.playMusic(this._combatMusicKey());
  }

  /**
   * Triggered when the galaxy-end boss threshold is reached. Drives the
   * cinematic warp transition; the arena HUD and gameplay flip on once the
   * transition lands (ARENA_TRANSITION_ENDED).
   */
  _enterBossArena(galaxyIndex) {
    this.audio.stopMusic();
    this.hud.hideArenaWarning?.();

    const finalize = () => this._finalizeBossArena();
    this.arenaDirector.beginTransition(galaxyIndex, finalize);

    // Reveal the arena HUD once the warp resolves, and kick off this
    // galaxy's unique arena track.
    const unsub = eventBus.on(EVENTS.ARENA_TRANSITION_ENDED, () => {
      this.ui.show('arenaHud');
      this.audio.playMusic(this._arenaMusicKey(galaxyIndex));
      unsub();
    });
  }

  _arenaMusicKey(galaxyIndex) {
    const idx = Math.max(0, Math.min(CAMPAIGN.GALAXIES - 1, galaxyIndex ?? 0));
    return `arena-${idx}`;
  }

  /**
   * Called when the player flies through their built warp gate at the end
   * of the arena. Advances the campaign to the next galaxy and drops the
   * ship straight back into corridor combat — no death screen, no hangar.
   */
  _finalizeBossArena() {
    const c = this.state.campaign;
    if (!c) return;
    c.totalSectorsCleared = (c.totalSectorsCleared || 0) + CAMPAIGN.SECTORS_PER_GALAXY;
    c.galaxyIndex = Math.min(c.galaxyIndex + 1, CAMPAIGN.GALAXIES - 1);
    if (c.galaxyIndex >= CAMPAIGN.GALAXIES - 1 && !c.infiniteMode) {
      c.infiniteMode = true;
    }
    if (c.infiniteMode) c.infiniteSector = (c.infiniteSector || 0) + 1;

    eventBus.emit(EVENTS.CAMPAIGN_ADVANCED, { galaxyIndex: c.galaxyIndex, infiniteMode: c.infiniteMode });

    this.state.bossArena = { active: false, subPhase: 'inactive', bossDefeated: false, gatesTotal: 3, gatesClosed: 0, buildProgress: 0 };
    this.arenaHUD.hide();
    this.ui.hide('arenaHud');
    this.arenaDirector?.exit();

    const nextGalaxy = c.galaxyIndex;
    const startTier = nextGalaxy * CAMPAIGN.SECTORS_PER_GALAXY + 1;
    const startDist = nextGalaxy > 0 ? (startTier - 1) * RUN.DISTANCE_PER_TIER : 0;

    const r = this.state.round;
    r.phase = 'combat';
    r.distanceTraveled = startDist;
    r.current = startTier;
    r.bossIsActive = false;

    this.scene.applyEnvironment(getPreset(nextGalaxy), true);
    this.synthGrid.setColor(getPreset(nextGalaxy).gridColor);

    const playerT = this.playerEntity?.get('TransformComponent');
    if (playerT) {
      playerT.position.set(0, 0, 0);
      playerT.rotation.set(0, 0, 0);
    }

    const health = this.playerEntity?.get('HealthComponent');
    if (health) { health.hp = health.maxHp; health.dead = false; }
    const shield = this.playerEntity?.get('ShieldComponent');
    if (shield) shield.hp = shield.maxHp;
    const energy = this.playerEntity?.get('EnergyComponent');
    if (energy) energy.current = energy.max;

    this.state.player.hp = health?.hp ?? this.state.player.hp;
    this.state.player.shieldHp = shield?.hp ?? 0;
    this.state.player.energy = energy?.current ?? this.state.player.energy;

    this.spawnDirector.purgeCombatWorld();
    for (const e of this.world.query('projectile_player')) e.destroy();
    for (const e of this.world.query('projectile_enemy')) e.destroy();
    for (const e of this.world.query('asteroid')) e.destroy();

    this.spawnDirector.startRound();
    this.hud.show();
    this._prevBossMusicActive = false;
    this.audio.playMusic(this._combatMusicKey());
    this.audio.play('launch');
    this._saveNow();
  }

  _captureVisualDefaults() {
    const pp = this._postPasses;
    const sm = this.scene;
    const fog = sm.scene.fog;
    return {
      bloomStrength: BLOOM.STRENGTH,
      bloomRadius: BLOOM.RADIUS,
      bloomThreshold: BLOOM.THRESHOLD,
      chromaticOffset: pp.chromatic.uniforms.offset.value,
      vignetteIntensity: pp.colorGrade.uniforms.vignetteIntensity.value,
      saturation: pp.colorGrade.uniforms.saturation.value,
      scanIntensity: pp.scanlines.uniforms.intensity.value,
      lineFrequency: pp.scanlines.uniforms.lineFrequency.value,
      grainIntensity: pp.grain.uniforms.intensity.value,
      fogNear: fog.near,
      fogFar: fog.far,
      fogColor: SCENE.FOG_COLOR,
      ambientColor: SCENE.AMBIENT_COLOR,
      ambientIntensity: SCENE.AMBIENT_INTENSITY,
      dirColor: SCENE.DIR_COLOR,
      dirIntensity: SCENE.DIR_INTENSITY,
      fillIntensity: sm.fillLight.intensity,
      toneMappingExposure: sm.renderer.toneMappingExposure,
      backgroundColor: sm.scene.background.getHex(),
    };
  }

  resetDebugVisuals() {
    const d = this._visualDefaults;
    const pp = this._postPasses;
    const sm = this.scene;
    pp.bloom.strength = d.bloomStrength;
    pp.bloom.radius = d.bloomRadius;
    pp.bloom.threshold = d.bloomThreshold;
    pp.chromatic.uniforms.offset.value = d.chromaticOffset;
    pp.colorGrade.uniforms.vignetteIntensity.value = d.vignetteIntensity;
    pp.colorGrade.uniforms.saturation.value = d.saturation;
    pp.scanlines.uniforms.intensity.value = d.scanIntensity;
    pp.scanlines.uniforms.lineFrequency.value = d.lineFrequency;
    pp.grain.uniforms.intensity.value = d.grainIntensity;
    sm.scene.fog.near = d.fogNear;
    sm.scene.fog.far = d.fogFar;
    sm.scene.fog.color.setHex(d.fogColor);
    sm.scene.background.setHex(d.backgroundColor);
    sm.ambientLight.color.setHex(d.ambientColor);
    sm.ambientLight.intensity = d.ambientIntensity;
    sm.directionalLight.color.setHex(d.dirColor);
    sm.directionalLight.intensity = d.dirIntensity;
    sm.fillLight.intensity = d.fillIntensity;
    sm.renderer.toneMappingExposure = d.toneMappingExposure;
  }

  _hexFromColor(color) { return `0x${color.getHexString()}`; }

  getVisualSettingsSnapshot() {
    const pp = this._postPasses;
    const sm = this.scene;
    const fog = sm.scene.fog;
    const cg = pp.colorGrade.uniforms;
    const sh = cg.shadowColor.value;
    const hi = cg.highlightColor.value;
    return {
      game: 'Infinite Aliens',
      exportedAt: new Date().toISOString(),
      BLOOM: { STRENGTH: pp.bloom.strength, RADIUS: pp.bloom.radius, THRESHOLD: pp.bloom.threshold },
      SCENE: {
        FOG_NEAR: fog.near, FOG_FAR: fog.far,
        FOG_COLOR: this._hexFromColor(fog.color),
        AMBIENT_COLOR: this._hexFromColor(sm.ambientLight.color),
        AMBIENT_INTENSITY: sm.ambientLight.intensity,
        DIR_COLOR: this._hexFromColor(sm.directionalLight.color),
        DIR_INTENSITY: sm.directionalLight.intensity,
      },
      SCENE_MANAGER: {
        toneMappingExposure: sm.renderer.toneMappingExposure,
        backgroundColor: this._hexFromColor(sm.scene.background),
        fillLightColor: this._hexFromColor(sm.fillLight.color),
        fillLightIntensity: sm.fillLight.intensity,
      },
      POST_SHADER_DEFAULTS: {
        ChromaticAberrationShader_offset: pp.chromatic.uniforms.offset.value,
        ColorGradeShader_vignetteIntensity: cg.vignetteIntensity.value,
        ColorGradeShader_saturation: cg.saturation.value,
        ColorGradeShader_shadowColor: [sh.x, sh.y, sh.z],
        ColorGradeShader_highlightColor: [hi.x, hi.y, hi.z],
        ScanlineShader_intensity: pp.scanlines.uniforms.intensity.value,
        ScanlineShader_lineFrequency: pp.scanlines.uniforms.lineFrequency.value,
        FilmGrainShader_intensity: pp.grain.uniforms.intensity.value,
      },
    };
  }

  async copyVisualSettingsToClipboard() {
    const snapshot = this.getVisualSettingsSnapshot();
    const text = JSON.stringify(snapshot, null, 2);
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) { return false; }
  }

  _worldMotionScale() {
    if (!this.state || this.state.round.phase !== 'combat') return 1;
    const stats = this.playerEntity?.get('PlayerStatsComponent');
    const base = PLAYER.BASE_SPEED;
    let speed = stats?.speed ?? base;
    for (const b of (stats?.activeBoosts || [])) {
      if (b.stat === 'speed') speed *= b.multiplier;
    }
    return speed / base;
  }

  _syncStateFromPlayer() {
    if (!this.playerEntity || !this.state) return;
    const p = this.state.player;
    const h = this.playerEntity.get('HealthComponent');
    const s = this.playerEntity.get('ShieldComponent');
    const e = this.playerEntity.get('EnergyComponent');
    if (h) { p.hp = h.hp; p.maxHp = h.maxHp; }
    if (s) p.shieldHp = s.hp;
    if (e) p.energy = e.current;
  }

  _tick(delta) {
    // Raw, uncapped gap between this tick and the previous one. The GameLoop
    // clamps `delta` at 100 ms, so a multi-second browser/GC stall looks like
    // a single 100 ms frame in the fps average. This raw measurement surfaces
    // those hitches in the perf overlay.
    const nowMs = performance.now();
    const rawGapMs = this._lastTickMs != null ? nowMs - this._lastTickMs : 0;
    this._lastTickMs = nowMs;

    const dt = this._paused ? 0 : delta;

    // Feed perf metrics + adaptive quality with the real (unpaused) delta so
    // pausing the game doesn't trick the tier selector. Work time (CPU spent
    // inside _tick) is measured from the end of the *previous* tick, so the
    // value we pass here is for the frame that just ran.
    const prevWorkMs = this._lastWorkMs ?? 0;
    this.perfOverlay.tick(delta, rawGapMs, prevWorkMs);
    this.qualityController.tick(delta);

    if (!this.state || !this.playerEntity) {
      this.starfield.update(dt, 1);
      this.synthGrid.update(dt, 1);
      this.camera.update(dt);
      this._updateShaders(dt);
      this.projectileRenderer.flush();
      this.scene.render();
      this._lastWorkMs = performance.now() - nowMs;
      return;
    }

    const phase = this.state.round.phase;
    const worldSpeed = this._worldMotionScale();

    // Break `_tick` into labeled sections so the perf overlay can attribute
    // hitches. `_mark` is a cheap no-op when profiling is off.
    const mark = this._perfLogEnabled ? this._profMark.bind(this) : NOOP_MARK;
    mark('start');

    this.upgradeApplier?.tick(dt);                     mark('upgrade');
    const arenaActive = phase === 'boss_arena';
    const transitioning = phase === 'arena_transition';
    const starfieldSpeed = transitioning
      ? (this.arenaDirector?.getTransitionStarfieldSpeed?.() ?? worldSpeed)
      : (arenaActive ? 0 : worldSpeed);
    const gridSpeed = transitioning
      ? (this.arenaDirector?.getTransitionGridSpeed?.() ?? worldSpeed)
      : (arenaActive ? 0 : worldSpeed);
    this.starfield.update(dt, starfieldSpeed);         mark('starfield');
    this.synthGrid.update(dt, gridSpeed);              mark('synthgrid');

    // Feed the camera's combat-corridor screen tilt before it lerps this
    // frame. Arena phases drive their own camera state; zero out here so
    // the combat roll/sway relaxes back to level when we leave combat.
    if (phase === 'combat') {
      const t = this.playerEntity.get('TransformComponent');
      const vel = this.playerEntity.get('PlayerInputComponent')?.getVelocity?.() || { x: 0 };
      this.camera.setCombatSway({ roll: t?.rotation?.z ?? 0, vx: vel.x });
    } else if (!arenaActive && !transitioning) {
      this.camera.setCombatSway({ roll: 0, vx: 0 });
    }

    this.camera.update(dt);                            mark('camera');
    this.scene.lerpEnvironment(dt);                    mark('environment');
    this._updateShaders(dt);                           mark('shaders');

    if (phase === 'combat') {
      this.spawnDirector.update(dt);                   mark('spawn');

      const bossNow = !!this.state.round.bossIsActive;
      if (bossNow !== this._prevBossMusicActive) {
        this._prevBossMusicActive = bossNow;
        this.audio.playMusic(this._combatMusicKey());
      }
    }

    if (phase === 'boss_arena' || phase === 'arena_transition') {
      this._tickArenaInput(dt);
      this.arenaDirector?.update(dt);                  mark('arena');
    }

    this.world.update(dt);                             mark('world');
    this.voice?.update(dt);                            mark('voice');
    if (phase === 'combat' || phase === 'boss_arena' || phase === 'arena_transition') {
      this.collision.update();                         mark('collision');
    }

    this._syncStateFromPlayer();                       mark('sync');

    if (phase === 'combat' || phase === 'boss_arena' || phase === 'arena_transition') {
      const manual = this.playerEntity.get('ManualGunComponent');
      this.hud.update(this.state, this.computed, manual?.getHeatState?.() ?? null);
      mark('hud');
    }

    if (phase === 'boss_arena' || phase === 'arena_transition') {
      const bossAlive = this.arenaDirector?._isBossAlive?.() ?? true;
      this.arenaHUD.update(this.state.bossArena, { bossAlive });
      const targets = this.arenaDirector?.getIndicatorTargets?.() || [];
      this.arenaHUD.updateIndicators(targets, this.scene.camera, this.scene.renderer?.domElement);
    }

    if (this.techTreeUI && this._techTreeOpen) this.techTreeUI.tick(dt);

    if (this.techTree) this.saveManager.update(dt, this.state, this.techTree);
    mark('save');

    this.projectileRenderer.flush();                   mark('projFlush');

    // Disable auto-reset so renderer.info accumulates across all composer
    // passes. Lets us see the real total draw count (not just the last
    // fullscreen pass, which is always "1 draw / 1 triangle").
    const ri = this.scene.renderer.info;
    ri.autoReset = false;
    ri.reset();
    this.scene.render();                               mark('render');

    this._lastWorkMs = performance.now() - nowMs;
    if (this._perfLogEnabled) this._profFlush();
  }

  _updateShaders(delta) {
    this._grainTime += delta;
    const composer = this._composer;
    if (!composer) return;
    for (const pass of composer.passes) {
      if (pass.uniforms?.time) pass.uniforms.time.value = this._grainTime;
    }
  }
}

const game = new Game();
game.start();
