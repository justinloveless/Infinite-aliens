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

import { UIManager } from './ui/UIManager.js';
import { HUD } from './ui/HUD.js';
import { TechTreeUI } from './ui/TechTreeUI.js';
import { RoundTransition } from './ui/RoundTransition.js';
import { DamageNumbers } from './ui/DamageNumbers.js';

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
    this.audio = new AudioManager();

    // Scene
    this.scene = new SceneManager();
    this.starfield = new Starfield(this.scene.scene);
    this.synthGrid = new SynthGrid(this.scene.scene);
    this.camera = new CameraController(this.scene.camera);

    // Post-processing
    const composer = setupPostProcessing(
      this.scene.renderer, this.scene.scene, this.scene.camera
    );
    this.scene.setComposer(composer);
    this._composer = composer;
    this._grainTime = 0;

    // Entities
    this.ship = new Ship(this.scene);
    this.projectilePool = new ProjectilePool(this.scene);

    // Systems
    this.collision = new CollisionSystem();
    this.combat = new CombatSystem(this.projectilePool, this.collision);
    this.currency = new CurrencySystem();
    this.upgrade = new UpgradeSystem();
    this.round = new RoundSystem(this.currency);

    // UI
    this.ui = new UIManager();
    this.hud = new HUD();
    this.transition = new RoundTransition();
    this.damageNumbers = new DamageNumbers();

    // These get set up after state is loaded
    this.techTree = null;
    this.techTreeUI = null;

    this._setupEventListeners();
    this._setupClickHandling();
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
      this.state.round.phase = 'dead';
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

  _setupClickHandling() {
    document.getElementById('game-canvas').addEventListener('click', e => {
      if (!this.state || this.state.round.phase !== 'combat') return;
      this.combat.handleClick(
        e.clientX, e.clientY,
        this.state, this.computed,
        this.ship, this.scene.camera
      );
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

    this.ui.bindMuteButton(this.audio);

    this.round.init(
      this.state, this.scene,
      (round, loot) => this._onRoundComplete(round, loot),
      (round) => this._onRoundStart(round)
    );
  }

  _rebuildComputed() {
    this.computed = this.upgrade.compute(this.state, this.techTree);
    this.state._computed = this.computed;
    // Ensure current HP doesn't exceed new max
    const p = this.state.player;
    p.hp = Math.min(p.hp, this.computed.maxHp);
    p.shieldHp = Math.min(p.shieldHp, this.computed.maxShieldHp);
    this.ship.setShieldVisible(this.computed.maxShieldHp > 0 && p.shieldHp > 0);
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
      this.audio.playMusic('combat');
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

    const nextRound = this.state.round.current;
    this.projectilePool.clear();
    this.round.startRound(nextRound);
    this.combat.setEnemies(this.round.enemies);
    this.combat.setLootDrops(this.round.lootDrops);

    this.audio.playMusic('combat');
  }

  _onRoundComplete(round, loot) {
    this.audio.play('roundComplete');
    this.transition.show(round, loot, () => {
      this.state.round.current++;
      this._openTechTree();
    });
  }

  _onRoundStart(round) {
    this.hud.show();
  }

  _tick(delta) {
    if (!this.state) {
      // Just render the scene (start screen visible)
      this.starfield.update(delta);
      this.synthGrid.update(delta);
      this.camera.update(delta);
      this.ship.update(delta);
      this._updateShaders(delta);
      this.scene.render();
      return;
    }

    const phase = this.state.round.phase;

    // Always update ship visuals
    this.ship.update(delta);
    this.starfield.update(delta);
    this.synthGrid.update(delta);
    this.camera.update(delta);

    // Update post-processing uniforms
    this._updateShaders(delta);

    // Combat phase
    if (phase === 'combat') {
      // Update enemies + loot + explosions
      this.round.update(delta, this.computed);
      this.combat.setEnemies(this.round.enemies);
      this.combat.setLootDrops(this.round.lootDrops);

      // Auto-attack + collision
      this.combat.update(delta, this.state, this.computed, this.ship, this.audio);

      // Regen
      this.upgrade.applyRegen(delta, this.state, this.computed);

      // Sync shield visual
      this.ship.setShieldVisible(
        this.computed.maxShieldHp > 0 && this.state.player.shieldHp > 0
      );

      // HUD update
      this.hud.update(this.state, this.computed);
    }

    // Projectile updates always
    this.projectilePool.update(delta);

    // Tech tree UI tick (animation)
    if (this.techTreeUI && phase === 'upgrade') {
      this.techTreeUI.tick(delta);
    }

    // Save
    if (this.techTree) {
      this.saveManager.update(delta, this.state, this.techTree);
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
