import { SettingsManager } from './core/SettingsManager.js';
import { SettingsUI } from './ui/SettingsUI.js';
import { DebugMenuUI } from './ui/DebugMenuUI.js';
import { SceneManager } from './scene/SceneManager.js';
import { Starfield } from './scene/Starfield.js';
import { SynthGrid } from './scene/SynthGrid.js';
import { CameraController } from './scene/CameraController.js';
import { setupPostProcessing } from './scene/PostProcessing.js';
import { GameLoop } from './core/GameLoop.js';
import { createInitialState } from './core/GameState.js';
import { SaveManager } from './core/SaveManager.js';
import { AudioManager } from './core/AudioManager.js';
import { eventBus, EVENTS } from './core/EventBus.js';

import { Ship } from './entities/Ship.js';
import { ProjectilePool } from './entities/ProjectilePool.js';

import { CollisionSystem } from './systems/CollisionSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { RoundSystem } from './systems/RoundSystem.js';
import { CurrencySystem } from './systems/CurrencySystem.js';
import { UpgradeSystem } from './systems/UpgradeSystem.js';

import { TechTreeState } from './techtree/TechTreeState.js';
import { AsteroidSystem } from './systems/AsteroidSystem.js';
import { BeamLaserSystem } from './systems/BeamLaserSystem.js';

import { UIManager } from './ui/UIManager.js';
import { HUD } from './ui/HUD.js';
import { TechTreeUI } from './ui/TechTreeUI.js';
import { RoundTransition } from './ui/RoundTransition.js';
import { DamageNumbers } from './ui/DamageNumbers.js';
import { BLOOM, SCENE } from './constants.js';

// ============================
// GAME ORCHESTRATOR
// ============================
class Game {
  constructor() {
    this.state = null;
    this.computed = null;

    // Core
    this.loop = new GameLoop();
    this.saveManager = new SaveManager();
    this.settings = new SettingsManager();
    this.audio = new AudioManager();

    // Scene
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

    // Apply saved audio settings before anything plays
    this.audio.setMusicVolume(this.settings.musicVolume);
    this.audio.setSfxVolume(this.settings.sfxVolume);
    this.audio.setMuted(this.settings.muted);

    // Entities
    this.ship = new Ship(this.scene, this.settings);
    this.projectilePool = new ProjectilePool(this.scene);

    // Systems
    this.collision = new CollisionSystem();
    this.combat = new CombatSystem(this.projectilePool, this.collision);
    this.currency = new CurrencySystem();
    this.upgrade = new UpgradeSystem();
    this.round = new RoundSystem(this.currency);
    this.asteroidSystem = new AsteroidSystem(this.scene.scene);
    this.beamLaser = new BeamLaserSystem(this.scene.scene);

    // UI
    this.ui = new UIManager();
    this.hud = new HUD();
    this.transition = new RoundTransition();
    this.damageNumbers = new DamageNumbers();
    this.settingsUI = new SettingsUI(this.settings, this.audio);
    this.debugMenu = new DebugMenuUI(this);

    // These get set up after state is loaded
    this.techTree = null;
    this.techTreeUI = null;
    this._prevBossMusicActive = false;
    this._paused = false;

    this._setupEventListeners();
    this._setupClickHandling();
    this._setupManualGunInput();
    this._setupSettingsButton();
    this._setupDebugMenuHotkey();
    this._setupPauseControls();
  }

  _setupEventListeners() {
    // Player damage handler
    eventBus.on(EVENTS.PLAYER_DAMAGED, ({ amount, source }) => {
      if (!this.state) return;
      const s = this.state.player;
      const c = this.computed;

      // Shield absorbs first
      if (s.shieldHp > 0 && c?.maxShieldHp > 0) {
        const shieldDmg = Math.min(s.shieldHp, amount);
        s.shieldHp -= shieldDmg;
        const remaining = amount - shieldDmg;
        if (remaining > 0) {
          s.hp = Math.max(0, s.hp - remaining);
          this.ship.flash(0xff0000);
          this.audio.play('playerDamage');
        } else {
          this.audio.play('shieldHit');
        }
      } else {
        s.hp = Math.max(0, s.hp - amount);
        this.ship.flash(0xff0000);
        this.audio.play('playerDamage');
      }

      this.camera.shake(0.35, 0.2);

      if (s.hp <= 0) {
        eventBus.emit(EVENTS.PLAYER_DIED);
      }
    });

    eventBus.on(EVENTS.PLAYER_HEALED, ({ amount }) => {
      if (!this.state || !this.computed) return;
      this.state.player.hp = Math.min(
        this.computed.maxHp,
        this.state.player.hp + amount
      );
    });

    eventBus.on(EVENTS.PLAYER_DIED, () => {
      this.setPaused(false);
      this.audio.stopMusic();
      this.audio.play('death');
      const r = this.state.round;
      r.phase = 'dead';
      r.distanceTraveled = 0;
      r.current = 1;
      r.enemiesDefeated = 0;
      r.totalEnemiesDefeated = 0;
      r.bossesDefeated = 0;
      r.bossIsActive = false;
      this.round.purgeCombatWorld();
      this.projectilePool.clear();
      this.asteroidSystem.clear();
      this.beamLaser.clear();
      this.combat.setEnemies(this.round.enemies);
      this.combat.setLootDrops(this.round.lootDrops);
      this.ui.hide('hud');
      this.ui.showDeath(() => {
        // Repair ship
        this.state.player.hp = this.computed.maxHp;
        this.state.player.shieldHp = 0;
        this._openTechTree();
      });
    });

    eventBus.on(EVENTS.ENEMY_DAMAGED, ({ enemy, damage, isCrit }) => {
      const screen = this.scene.worldToScreen(enemy.group.position);
      this.damageNumbers.spawn(screen.x, screen.y, damage, isCrit, false);
    });

    eventBus.on(EVENTS.UPGRADE_PURCHASED, () => {
      this._rebuildComputed();
    });

    eventBus.on(EVENTS.CURRENCY_CHANGED, () => {
      if (this.techTreeUI) this.techTreeUI.updateCurrencyBar(this.state);
    });
  }

  _setupSettingsButton() {
    const btn = document.getElementById('settings-btn');
    if (btn) {
      btn.onclick = () => {
        if (this.settingsUI.isOpen) this.settingsUI.close();
        else this.settingsUI.open();
      };
    }
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.settingsUI.isOpen) {
        this.settingsUI.close();
        return;
      }
      if (e.code === 'Escape' && this.debugMenu.isOpen) {
        this.debugMenu.close();
        return;
      }
      if (e.code === 'Escape' && this._paused && this.state) {
        this.setPaused(false);
      }
    });
  }

  _isTypingTarget(el) {
    return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
  }

  /**
   * @param {boolean} on
   * @param {{ showPauseOverlay?: boolean }} [options] - If `showPauseOverlay` is false, pause without the full-screen overlay (e.g. debug menu).
   */
  setPaused(on, options = {}) {
    const want = !!on;
    if (want === this._paused) return;
    if (want && (!this.state || this.state.round.phase === 'dead')) return;
    this._paused = want;
    const ov = document.getElementById('pause-overlay');
    const showOverlay = options.showPauseOverlay !== false;
    if (want && this.state) {
      if (showOverlay) {
        ov?.classList.remove('hidden');
        ov?.setAttribute('aria-hidden', 'false');
      } else {
        ov?.classList.add('hidden');
        ov?.setAttribute('aria-hidden', 'true');
      }
      this.audio.pauseMusic();
    } else {
      ov?.classList.add('hidden');
      ov?.setAttribute('aria-hidden', 'true');
      this.audio.resumeMusic();
    }
  }

  /** @param {{ showPauseOverlay?: boolean }} [options] - Passed through when entering pause; ignored when unpausing. */
  togglePause(options) {
    if (this._paused) this.setPaused(false);
    else this.setPaused(true, options);
  }

  _setupPauseControls() {
    document.getElementById('pause-resume-btn')?.addEventListener('click', () => {
      this.setPaused(false);
    });
    document.getElementById('pause-btn')?.addEventListener('click', () => {
      this.togglePause();
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
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      this.debugMenu.toggle();
    });
  }

  _debugGrantCurrencies(amounts) {
    if (!this.state || !amounts) return;
    for (const [type, amount] of Object.entries(amounts)) {
      if (this.state.currencies[type] === undefined) continue;
      this.currency.add(type, amount);
    }
  }

  _debugResetGame() {
    this.setPaused(false);
    this.transition.hide();
    this.ui.hide('death');
    this.ui.hide('welcome');
    this.settingsUI.close();
    document.getElementById('start-screen')?.classList.add('hidden');

    if (this.state) {
      this.round.purgeCombatWorld();
      this.projectilePool.clear();
      this.asteroidSystem.clear();
      this.beamLaser.clear();
      this.combat.setEnemies(this.round.enemies);
      this.combat.setLootDrops(this.round.lootDrops);
    }

    this.saveManager.clearSave();
    this.state = createInitialState();
    this.techTree = new TechTreeState(this.state.seed);
    this._rebuildComputed();
    this.currency.init(this.state);

    if (this.techTreeUI) {
      this.techTreeUI.setTree(this.techTree);
      this.round.init(this.state, this.scene, (round) => this._onRoundStart(round));
    } else {
      this._setupTechTreeUI();
    }

    this.state.player.hp = this.computed.maxHp;
    this.state.player.shieldHp = 0;
    this.ship.setShieldVisible(this.computed.maxShieldHp > 0 && this.state.player.shieldHp > 0);

    this.ui.hide('hud');
    this.ui.hide('techTree');
    this.techTreeUI.close();
    this.audio.stopMusic();
    this._openTechTree();
  }

  _setupClickHandling() {
    document.getElementById('game-canvas').addEventListener('click', () => {
      if (this._paused) return;
      this.combat.fireManualGun(this.state, this.computed, this.ship);
    });
  }

  _setupManualGunInput() {
    window.addEventListener('keydown', e => {
      if (e.code !== 'Space') return;
      if (this._paused) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      this.combat.fireManualGun(this.state, this.computed, this.ship);
    });
  }

  async start() {
    // Show start screen first
    this.ui.showStart(() => {
      this.audio.init();
      this._loadOrNewGame();
    });

    // Start render loop immediately (shows scene behind start screen)
    this.loop.onUpdate(delta => this._tick(delta));
    this.loop.start();
  }

  _loadOrNewGame() {
    const saved = this.saveManager.load();

    if (saved) {
      this.state = saved;
      this.state._computed = null; // will be recomputed

      // Restore tech tree
      this.techTree = new TechTreeState(this.state.seed);
      this.techTree.loadFromSave(
        saved.techTree?.unlockedNodes || {},
        saved.techTree?.generatedTiers || 0
      );

      this._rebuildComputed();
      this._setupTechTreeUI();

      // Offline earnings
      const offline = this.saveManager.calculateOfflineEarnings(
        saved.lastActiveTime,
        this.computed.stellarDustRate
      );

      this.ui.showWelcome(offline, () => {
        if (offline && offline.earnings.stellarDust > 0) {
          this.currency.add('stellarDust', offline.earnings.stellarDust);
        }
        this._openTechTree();
      });
    } else {
      this._newGame();
    }

    this.state.lastActiveTime = Date.now();
  }

  _newGame() {
    this.state = createInitialState();
    this.techTree = new TechTreeState(this.state.seed);
    this._rebuildComputed();
    this._setupTechTreeUI();
    this._openTechTree(); // Start in upgrade screen
  }

  _setupTechTreeUI() {
    this.currency.init(this.state);
    this.techTreeUI = new TechTreeUI(this.techTree, this.currency, this.audio);

    this.ui.bindTechTreeButtons(
      () => this._openTechTree(),
      () => this._closeTechTree(),
      () => this._launchRound()
    );

    this.ui.bindMuteButton(this.audio, this.settings);

    this.round.init(this.state, this.scene, (round) => this._onRoundStart(round));
  }

  _combatMusicKey() {
    return this.state?.round?.bossIsActive ? 'boss' : 'combat';
  }

  _rebuildComputed() {
    this.computed = this.upgrade.compute(this.state, this.techTree);
    this.state._computed = this.computed;
    // Ensure current HP doesn't exceed new max
    const p = this.state.player;
    p.hp = Math.min(p.hp, this.computed.maxHp);
    p.shieldHp = Math.min(p.shieldHp, this.computed.maxShieldHp);
    this.ship.setShieldVisible(this.computed.maxShieldHp > 0 && p.shieldHp > 0);
    this.ship.syncTurrets(this.computed.extraWeapons || []);
    this.ship.syncVisualModifiers(this.computed.visualModifiers || []);
    this.projectilePool.applyProjectileVisual(this.computed.projectileVisuals || new Map());
    eventBus.emit(EVENTS.STATS_UPDATED, this.computed);
  }

  _openTechTree() {
    const prevPhase = this.state.round.phase;
    this._prevPhaseBeforeTree = prevPhase;
    if (prevPhase !== 'combat') {
      this.state.round.phase = 'upgrade';
    }
    this.ui.hide('hud');
    this.ui.show('techTree');
    this.techTreeUI.open(this.state);
    this.audio.playMusic('tech-tree');
  }

  _closeTechTree() {
    this.ui.hide('techTree');
    this.techTreeUI.close();
    const prev = this._prevPhaseBeforeTree;
    if (prev === 'combat') {
      // Resume combat
      this.state.round.phase = 'combat';
      this.ui.show('hud');
      this._prevBossMusicActive = !!this.state.round.bossIsActive;
      this.audio.playMusic(this._combatMusicKey());
    } else {
      // Still in upgrade — keep HUD visible but show Launch button
      this.ui.show('hud');
    }
  }

  _launchRound() {
    this.ui.hide('techTree');
    this.techTreeUI.close();
    this.ui.show('hud');
    this.audio.play('launch');

    this.projectilePool.clear();
    this.round.startRound();
    this.combat.setEnemies(this.round.enemies);
    this.combat.setLootDrops(this.round.lootDrops);

    this._prevBossMusicActive = !!this.state.round.bossIsActive;
    this.audio.playMusic(this._combatMusicKey());
  }

  _onRoundStart(round) {
    this.hud.show();
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

  /** @param {import('three').Color} color */
  _hexFromColor(color) {
    return `0x${color.getHexString()}`;
  }

  /** Live visual values (debug sliders + scene) for export / AI handoff. */
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
      BLOOM: {
        STRENGTH: pp.bloom.strength,
        RADIUS: pp.bloom.radius,
        THRESHOLD: pp.bloom.threshold,
      },
      SCENE: {
        FOG_NEAR: fog.near,
        FOG_FAR: fog.far,
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

  _buildVisualSettingsExportText() {
    const snapshot = this.getVisualSettingsSnapshot();
    const json = JSON.stringify(snapshot, null, 2);
    return `${[
      '=== INSTRUCTIONS (give this whole block to an AI or developer) ===',
      '',
      'Save the JSON below as the new default look for Infinite Aliens. Apply it like this:',
      '',
      '1. src/constants.js — Replace the `BLOOM` object with the JSON `BLOOM` (numeric fields as-is).',
      '2. src/constants.js — Replace the `SCENE` object: copy FOG_NEAR, FOG_FAR, AMBIENT_INTENSITY, DIR_INTENSITY. For each *COLOR field, use a JavaScript hex literal, e.g. FOG_COLOR: 0x000011 (parse the string from JSON if needed).',
      '3. src/scene/SceneManager.js — In _setupRenderer(), set `this.renderer.toneMappingExposure` to SCENE_MANAGER.toneMappingExposure.',
      '4. src/scene/SceneManager.js — In _setupFog(), set `this.scene.background` to `new THREE.Color(<backgroundColor hex literal>)` matching SCENE_MANAGER.backgroundColor.',
      '5. src/scene/SceneManager.js — In _setupLighting(), the fill DirectionalLight: first arg = fillLightColor hex literal, second = SCENE_MANAGER.fillLightIntensity.',
      '6. src/scene/ShaderPasses.js — Set each shader export’s default `uniforms.*.value` to match POST_SHADER_DEFAULTS (shadowColor/highlightColor as `{ x, y, z }` vec3 objects).',
      '7. src/scene/PostProcessing.js — Bloom pass constructor already uses `BLOOM` from constants after you edit constants.',
      '8. src/main.js — Update `_captureVisualDefaults()` so its returned object matches the new defaults (BLOOM/SCENE imports for fog and main lights; same numeric values as POST_SHADER_DEFAULTS and SCENE_MANAGER for exposure, background hex, fill intensity, etc.) so debug "RESET VISUALS" stays correct.',
      '',
      'After edits, reload the game and use debug Reset Visuals to confirm.',
      '',
      '=== JSON ===',
      '',
    ].join('\n')}${json}\n`;
  }

  async copyVisualSettingsToClipboard() {
    const text = this._buildVisualSettingsExportText();
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  _tick(delta) {
    const dt = this._paused ? 0 : delta;

    if (!this.state) {
      // Just render the scene (start screen visible)
      this.starfield.update(dt);
      this.synthGrid.update(dt);
      this.camera.update(dt);
      this.ship.update(dt, null);
      this.ship.syncAttachments(null, dt);
      this._updateShaders(dt);
      this.scene.render();
      return;
    }

    const phase = this.state.round.phase;

    // Always update ship visuals
    this.ship.update(dt, this.computed, phase);
    this.ship.syncAttachments(this.computed?.attachments, dt);
    this.upgrade.tickTriggers(dt);
    this.starfield.update(dt);
    this.synthGrid.update(dt);
    this.camera.update(dt);

    // Update post-processing uniforms
    this._updateShaders(dt);

    if (phase === 'combat') {
      this.round.update(dt, this.computed);
      this.combat.setEnemies(this.round.enemies);
      this.combat.setLootDrops(this.round.lootDrops);

      const bossNow = !!this.state.round.bossIsActive;
      if (bossNow !== this._prevBossMusicActive) {
        this._prevBossMusicActive = bossNow;
        this.audio.playMusic(this._combatMusicKey());
      }

      // Auto-attack + collision
      this.combat.update(dt, this.state, this.computed, this.ship, this.audio);

      // Asteroids
      this.asteroidSystem.update(dt, this.projectilePool.active, this.round.enemies);

      // Beam laser turret
      const beamEquipped = this.computed.extraWeapons?.includes('beam') ?? false;
      this.beamLaser.update(dt, beamEquipped, this.ship, this.round.enemies, this.computed);

      // Regen
      this.upgrade.applyRegen(dt, this.state, this.computed);

      // Sync shield visual
      this.ship.setShieldVisible(
        this.computed.maxShieldHp > 0 && this.state.player.shieldHp > 0
      );

      // HUD update
      this.hud.update(this.state, this.computed, this.combat.getHeatState());
    }

    // Projectile updates always
    this.projectilePool.update(dt);

    // Tech tree UI tick (animation)
    if (this.techTreeUI && phase === 'upgrade') {
      this.techTreeUI.tick(dt);
    }

    // Save
    if (this.techTree) {
      this.saveManager.update(dt, this.state, this.techTree);
    }

    // Render
    this.scene.render();
  }

  _updateShaders(delta) {
    this._grainTime += delta;
    const composer = this._composer;
    if (!composer) return;

    // Update grain pass time uniform
    for (const pass of composer.passes) {
      if (pass.uniforms?.time) {
        pass.uniforms.time.value = this._grainTime;
      }
    }
  }
}

// Boot
const game = new Game();
game.start();
