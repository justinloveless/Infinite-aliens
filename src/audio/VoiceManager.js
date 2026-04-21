// VoiceManager: plays PIP robot-assistant voice lines in response to events
// and to polled hull/shield state. Sits beside AudioManager. Uses HTMLAudio
// elements (one per variant) so it can run independently of the Web Audio
// context that powers SFX and music.
//
// Missing mp3 files are silently tolerated — absent files just play silence
// and resolve their 'ended' path so the slot frees up immediately.

import {
  VOICE_LINES,
  VOICE_PRIORITY,
  VOICE_COOLDOWNS,
  VOICE_PRIORITY_NORMAL,
} from './voiceLines.js';
import { eventBus as defaultBus, EVENTS } from '../core/EventBus.js';

const VOICE_DIR = './audio/voice/';

/**
 * Hull percentage thresholds (descending). When hull drops below `pct`, fire
 * the matching trigger key. The flag stays latched until hull climbs back
 * above `rearm` so small fluctuations don't retrigger the line.
 */
const HULL_THRESHOLDS = [
  { flag: '75', pct: 0.75, rearm: 0.85, key: 'hull_75' },
  { flag: '50', pct: 0.50, rearm: 0.65, key: 'hull_50' },
  { flag: '25', pct: 0.25, rearm: 0.40, key: 'hull_25' },
  { flag: '10', pct: 0.10, rearm: 0.20, key: 'hull_10' },
];

const IDLE_GAP_MIN_SEC = 90;
const IDLE_GAP_MAX_SEC = 150;

export class VoiceManager {
  /**
   * @param {object} opts
   * @param {import('../core/EventBus.js').EventBus} [opts.eventBus]
   * @param {import('../core/SettingsManager.js').SettingsManager} opts.settings
   * @param {() => ({ playerEntity: any, galaxyIndex: number } | null)} opts.getContext
   *   Returns the current game context. Called on demand; may return null
   *   before the world is initialized.
   */
  constructor({ eventBus = defaultBus, settings, getContext }) {
    this._bus = eventBus;
    this._settings = settings;
    this._getContext = getContext || (() => null);

    /** @type {Map<string, HTMLAudioElement>} */
    this._audioMap = new Map();
    /** @type {Map<string, number>} lastPlayed ms (performance.now) */
    this._lastPlayedByKey = new Map();
    /** @type {Map<string, string>} last variant id per key, for non-repeat */
    this._recentVariantByKey = new Map();

    /** @type {null | { audio: HTMLAudioElement, key: string, priority: number }} */
    this._current = null;

    this._idleTimer = 0;
    this._idleNextAt = this._randomIdleGap();

    this._killCounter = 0;

    /** Hull threshold flags (true once crossed, cleared on rearm or new run). */
    this._hullFlags = { '75': false, '50': false, '25': false, '10': false };
    this._shieldDown = false;

    /** Tracks which galaxy-specific run_start lines have fired this session. */
    this._playedGalaxyRunStart = new Set();

    /** Pending delayed `play()` handles, keyed by trigger key. */
    this._delayedPlays = new Map();

    /** @type {Array<() => void>} unsubscribe fns */
    this._unsubs = [];

    this._preload();
    this._subscribe();
  }

  // ---- Public API ----

  /** Per-tick update. Polls health/shield + drives the idle timer. */
  update(dt) {
    if (dt > 0) this._pollPlayerStatus();

    // Idle flavor: only tick when nothing is playing so back-to-back lines
    // can't fire in the same window.
    if (!this._current) {
      this._idleTimer += dt;
      if (this._idleTimer >= this._idleNextAt) {
        this._idleTimer = 0;
        this._idleNextAt = this._randomIdleGap();
        const ctx = this._getContext?.();
        const phase = ctx?.playerEntity ? undefined : undefined; // reserved
        // Only chatter during gameplay phases — suppress idle chatter between
        // runs (death/hangar/tech-tree) where other music/UI dominates.
        if (this._isInGameplayPhase()) this.play('idle_flavor');
      }
    } else {
      this._idleTimer = 0;
    }
  }

  /**
   * Request a voice line by trigger key. Drops the request if a higher- or
   * equal-priority line is currently playing, if the key is on cooldown, or
   * if voice is muted / disabled.
   *
   * @param {string} triggerKey
   * @param {{ ignoreCooldown?: boolean }} [opts]
   */
  play(triggerKey, opts = {}) {
    if (!this._isEnabled()) return;
    const variants = VOICE_LINES[triggerKey];
    if (!variants || variants.length === 0) return;

    const priority = VOICE_PRIORITY[triggerKey] ?? VOICE_PRIORITY_NORMAL;
    const now = performance.now();

    if (!opts.ignoreCooldown) {
      const cd = VOICE_COOLDOWNS[triggerKey] ?? 0;
      if (cd > 0) {
        const last = this._lastPlayedByKey.get(triggerKey);
        if (last != null && now - last < cd) return;
      }
    }

    if (this._current) {
      if (priority <= this._current.priority) return;
      this._stopCurrent();
    }

    // Pick a non-repeating variant when possible
    const lastVariantId = this._recentVariantByKey.get(triggerKey);
    let pool = variants;
    if (variants.length > 1 && lastVariantId) {
      const filtered = variants.filter(v => v.id !== lastVariantId);
      if (filtered.length > 0) pool = filtered;
    }
    const choice = pool[Math.floor(Math.random() * pool.length)];
    const audio = this._audioMap.get(choice.id);
    if (!audio) return;

    try {
      audio.currentTime = 0;
    } catch (_) { /* Safari quirk before metadata loads */ }
    audio.volume = this._currentVolume();
    audio.muted = !this._isEnabled();

    const playPromise = audio.play();
    this._current = { audio, key: triggerKey, priority };
    this._lastPlayedByKey.set(triggerKey, now);
    this._recentVariantByKey.set(triggerKey, choice.id);
    this._idleTimer = 0;

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay blocked (pre-user-gesture) or file missing — free the slot.
        if (this._current && this._current.audio === audio) this._current = null;
      });
    }
  }

  /**
   * Called when a new run starts (ROUND_STARTED). Resets threshold flags so
   * the next damage event fires fresh lines, and triggers the right
   * per-galaxy or generic run_start line.
   */
  onRunStarted() {
    this._resetThresholds();
    this._clearDelayedPlays();
    const ctx = this._getContext?.();
    const gi = ctx?.galaxyIndex ?? 0;
    const galaxyKey = `run_start_galaxy_${gi}`;
    if (VOICE_LINES[galaxyKey] && !this._playedGalaxyRunStart.has(gi)) {
      this._playedGalaxyRunStart.add(gi);
      this.play(galaxyKey);
    } else {
      this.play('run_start');
    }
  }

  /** Hard stop whatever is currently playing. */
  stopAll() {
    this._stopCurrent();
  }

  /** Pause the currently playing line (for menu pauses). */
  pauseAll() {
    if (this._current) {
      try { this._current.audio.pause(); } catch (_) {}
    }
  }

  /** Resume the currently playing line (for menu unpauses). */
  resumeAll() {
    if (this._current) {
      const p = this._current.audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  }

  /** Called from settings UI when the voice volume slider moves. */
  setVolume(v) {
    const vol = Math.max(0, Math.min(1, v));
    if (this._current) this._current.audio.volume = vol * (this._isEnabled() ? 1 : 0);
  }

  /** Detach listeners (used when the game is torn down; usually not needed). */
  destroy() {
    this._stopCurrent();
    this._clearDelayedPlays();
    for (const off of this._unsubs) { try { off(); } catch (_) {} }
    this._unsubs = [];
    this._audioMap.clear();
  }

  /**
   * Queue a line to play after `delayMs`. Only one pending timer per key is
   * kept — requesting the same key again resets the timer. Used to sequence
   * VO after other audio beats (e.g. play the objective brief a few seconds
   * after the arrival line so they do not talk over each other).
   */
  _scheduleDelayedPlay(triggerKey, delayMs) {
    const existing = this._delayedPlays.get(triggerKey);
    if (existing != null) clearTimeout(existing);
    const handle = setTimeout(() => {
      this._delayedPlays.delete(triggerKey);
      this.play(triggerKey);
    }, delayMs);
    this._delayedPlays.set(triggerKey, handle);
  }

  _clearDelayedPlays() {
    for (const handle of this._delayedPlays.values()) clearTimeout(handle);
    this._delayedPlays.clear();
  }

  // ---- Internals ----

  _preload() {
    for (const variants of Object.values(VOICE_LINES)) {
      for (const v of variants) {
        const audio = new Audio(`${VOICE_DIR}${v.file}`);
        audio.preload = 'auto';
        audio.addEventListener('ended', () => this._onEnded(audio));
        // Browsers fire 'error' when the file 404s. Treat as silent no-op.
        audio.addEventListener('error', () => this._onEnded(audio));
        this._audioMap.set(v.id, audio);
      }
    }
  }

  _subscribe() {
    const bus = this._bus;
    const sub = (ev, fn) => { this._unsubs.push(bus.on(ev, fn)); };

    sub(EVENTS.PLAYER_DIED,              () => { this._clearDelayedPlays(); this.play('player_died'); });
    sub(EVENTS.PHOENIX_REVIVED,          () => this.play('phoenix_revived'));
    sub(EVENTS.ARENA_WARNING,            () => this.play('arena_warning'));
    sub(EVENTS.ARENA_TRANSITION_STARTED, () => this.play('arena_transition_start'));
    sub(EVENTS.ARENA_TRANSITION_ENDED,   () => this.play('arena_transition_end'));
    sub(EVENTS.GALAXY_BOSS_PENDING,      () => this.play('galaxy_boss_pending'));

    // Arena sub-phase narration (objective brief, gate build, ready to leave).
    // ARENA_PHASE_CHANGED fires alongside ARENA_TRANSITION_ENDED on arrival,
    // so the objective brief is delayed long enough to let the short "we've
    // arrived" line play first.
    sub(EVENTS.ARENA_PHASE_CHANGED, (payload) => {
      const subPhase = payload?.subPhase;
      if (subPhase === 'fighting') this._scheduleDelayedPlay('arena_objective_intro', 3500);
      else if (subPhase === 'building_gate') this.play('arena_building_gate');
      else if (subPhase === 'complete')      this.play('arena_ready_to_leave');
      else if (subPhase === 'inactive')      this._clearDelayedPlays();
    });
    sub(EVENTS.STELLAR_NOVA,             () => this.play('stellar_nova'));
    sub(EVENTS.EMP_FIRED,                () => this.play('emp_fired'));
    sub(EVENTS.UPGRADE_PURCHASED,        () => this.play('upgrade_purchased'));
    sub(EVENTS.SHIP_PURCHASED,           () => this.play('ship_purchased'));

    sub(EVENTS.SHIP_SELECTED, (payload) => {
      const shipId = payload?.shipId;
      if (!shipId) return;
      const key = `ship_selected_${shipId}`;
      if (VOICE_LINES[key]) this.play(key);
    });

    sub(EVENTS.CAMPAIGN_ADVANCED, (payload) => {
      const gi = payload?.galaxyIndex;
      const specific = gi != null ? `campaign_advanced_${gi}` : null;
      if (specific && VOICE_LINES[specific]) this.play(specific);
      else this.play('campaign_advanced');
    });

    sub(EVENTS.ROUND_STARTED, () => this.onRunStarted());

    sub(EVENTS.ENEMY_KILLED, () => {
      this._killCounter += 1;
      if (this._killCounter > 0 && this._killCounter % 100 === 0) {
        this.play('kill_milestone_100');
      } else if (this._killCounter > 0 && this._killCounter % 25 === 0) {
        this.play('kill_milestone_25');
      }
    });
  }

  _pollPlayerStatus() {
    const ctx = this._getContext?.();
    const player = ctx?.playerEntity;
    if (!player || typeof player.get !== 'function') return;
    const health = player.get('HealthComponent');
    const shield = player.get('ShieldComponent');

    // Hull thresholds (skip while dead; PLAYER_DIED handles that beat)
    if (health && health.maxHp > 0 && !health.dead) {
      const pct = health.hp / health.maxHp;
      for (const t of HULL_THRESHOLDS) {
        if (!this._hullFlags[t.flag] && pct <= t.pct) {
          this._hullFlags[t.flag] = true;
          this.play(t.key);
        } else if (this._hullFlags[t.flag] && pct >= t.rearm) {
          this._hullFlags[t.flag] = false;
        }
      }
    }

    // Shield transitions
    if (shield && shield.maxHp > 0) {
      const nowDown = shield.hp <= 0.001;
      if (nowDown && !this._shieldDown) {
        this._shieldDown = true;
        this.play('shield_down');
      } else if (!nowDown && this._shieldDown && shield.hp > shield.maxHp * 0.25) {
        this._shieldDown = false;
        this.play('shield_restored');
      }
    }
  }

  _resetThresholds() {
    this._hullFlags = { '75': false, '50': false, '25': false, '10': false };
    this._shieldDown = false;
  }

  _stopCurrent() {
    if (!this._current) return;
    try { this._current.audio.pause(); } catch (_) {}
    try { this._current.audio.currentTime = 0; } catch (_) {}
    this._current = null;
  }

  _onEnded(audio) {
    if (this._current && this._current.audio === audio) this._current = null;
  }

  _currentVolume() {
    if (!this._isEnabled()) return 0;
    return this._settings?.voiceVolume ?? 0.9;
  }

  _isEnabled() {
    if (!this._settings) return true;
    if (this._settings.muted) return false;
    if (this._settings.voiceEnabled === false) return false;
    return true;
  }

  _isInGameplayPhase() {
    const ctx = this._getContext?.();
    if (!ctx || !ctx.playerEntity) return false;
    // No direct phase field in ctx; treat presence of playerEntity + non-dead
    // as a sufficient proxy. The VoiceManager is paused externally (see
    // Game.setPaused) so this only decides whether idle flavor is eligible.
    const health = ctx.playerEntity.get?.('HealthComponent');
    return !(health && health.dead);
  }

  _randomIdleGap() {
    return IDLE_GAP_MIN_SEC + Math.random() * (IDLE_GAP_MAX_SEC - IDLE_GAP_MIN_SEC);
  }
}
