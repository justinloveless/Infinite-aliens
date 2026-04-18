/**
 * Automatically scales post-processing and pixel ratio based on measured
 * frame time. Can be forced to a specific tier by the user.
 *
 * Tiers:
 *   - high:   all post passes on, pixel ratio capped at 1.5x DPR
 *   - medium: drop scanlines + grain, softer bloom, pixel ratio 1.25x
 *   - low:    drop chromatic + scanlines + grain, lighter bloom, pixel ratio 1.0x
 *
 * Hysteresis is applied so transient spikes don't flicker settings. A tier
 * change requires the target tier to be "preferred" for ~1.5 seconds of
 * real time before we commit.
 */

const TIERS = ['high', 'medium', 'low'];

// Thresholds in FPS. We move DOWN a tier when fps is below the lower bound,
// and UP a tier when fps is above the upper bound, with hysteresis between.
const UP_FPS = { medium: 55, low: 45 }; // upgrade back to tier _key_ if fps > value
const DOWN_FPS = { high: 45, medium: 33 }; // downgrade from key when fps < value
const HOLD_SECONDS = 1.5;

export class QualityController {
  /**
   * @param {{
   *   renderer: import('three').WebGLRenderer,
   *   composer: import('three/addons/postprocessing/EffectComposer.js').EffectComposer,
   *   postPasses: object,
   *   getFps: () => number,
   * }} opts
   */
  constructor({ renderer, composer, postPasses, getFps }) {
    this._renderer = renderer;
    this._composer = composer;
    this._passes = postPasses;
    this._getFps = getFps;

    this._mode = 'auto';                  // 'auto' | 'high' | 'medium' | 'low'
    this._currentTier = 'high';
    this._candidateTier = 'high';
    this._candidateHold = 0;
    this._postProcessingEnabled = true;

    // Baseline bloom values so "medium/low" can restore vs. original.
    this._baseline = {
      bloomStrength: postPasses?.bloom?.strength ?? 0.8,
    };

    this._applyTier(this._currentTier, /*force*/true);
  }

  /** 'auto' | 'high' | 'medium' | 'low' */
  setMode(mode) {
    if (!['auto', 'high', 'medium', 'low'].includes(mode)) return;
    this._mode = mode;
    if (mode === 'auto') {
      // Next tick decides.
      this._candidateTier = this._currentTier;
      this._candidateHold = 0;
    } else {
      this._applyTier(mode);
    }
  }

  get mode() { return this._mode; }
  get currentTier() { return this._currentTier; }

  setPostProcessingEnabled(on) {
    this._postProcessingEnabled = !!on;
    this._applyPassEnables();
  }
  get postProcessingEnabled() { return this._postProcessingEnabled; }

  /** Called from the game loop (real dt, not paused-clamped). */
  tick(dt) {
    if (this._mode !== 'auto') return;
    const fps = this._getFps();
    if (!Number.isFinite(fps) || fps <= 0) return;

    const desired = this._desiredTier(fps);
    if (desired === this._currentTier) {
      this._candidateTier = desired;
      this._candidateHold = 0;
      return;
    }
    if (desired === this._candidateTier) {
      this._candidateHold += dt;
      if (this._candidateHold >= HOLD_SECONDS) {
        this._applyTier(desired);
        this._candidateHold = 0;
      }
    } else {
      this._candidateTier = desired;
      this._candidateHold = 0;
    }
  }

  _desiredTier(fps) {
    const cur = this._currentTier;
    if (cur === 'high' && fps < DOWN_FPS.high) return 'medium';
    if (cur === 'medium' && fps < DOWN_FPS.medium) return 'low';
    if (cur === 'medium' && fps > UP_FPS.medium) return 'high';
    if (cur === 'low' && fps > UP_FPS.low) return 'medium';
    return cur;
  }

  _applyTier(tier, force = false) {
    if (!TIERS.includes(tier)) return;
    if (!force && tier === this._currentTier) return;
    this._currentTier = tier;

    const p = this._passes;
    const baselineBloom = this._baseline.bloomStrength;

    if (tier === 'high') {
      if (p?.bloom) p.bloom.strength = baselineBloom;
      if (p?.chromatic) p.chromatic.enabled = true;
      if (p?.colorGrade) p.colorGrade.enabled = true;
      if (p?.scanlines) p.scanlines.enabled = true;
      if (p?.grain) p.grain.enabled = true;
      this._setPixelRatioCap(1.5);
    } else if (tier === 'medium') {
      if (p?.bloom) p.bloom.strength = baselineBloom * 0.75;
      if (p?.chromatic) p.chromatic.enabled = true;
      if (p?.colorGrade) p.colorGrade.enabled = true;
      if (p?.scanlines) p.scanlines.enabled = false;
      if (p?.grain) p.grain.enabled = false;
      this._setPixelRatioCap(1.25);
    } else {
      // low
      if (p?.bloom) p.bloom.strength = baselineBloom * 0.5;
      if (p?.chromatic) p.chromatic.enabled = false;
      if (p?.colorGrade) p.colorGrade.enabled = true;
      if (p?.scanlines) p.scanlines.enabled = false;
      if (p?.grain) p.grain.enabled = false;
      this._setPixelRatioCap(1.0);
    }

    this._applyPassEnables();
  }

  _applyPassEnables() {
    // Force-disable overrides tier enables: when post-processing is turned
    // off, only the base RenderPass + final tone map remain effective.
    if (this._postProcessingEnabled) return;
    const p = this._passes;
    if (p?.bloom) p.bloom.enabled = false;
    if (p?.chromatic) p.chromatic.enabled = false;
    if (p?.colorGrade) p.colorGrade.enabled = false;
    if (p?.scanlines) p.scanlines.enabled = false;
    if (p?.grain) p.grain.enabled = false;
  }

  _setPixelRatioCap(cap) {
    const target = Math.min(window.devicePixelRatio || 1, cap);
    if (Math.abs(this._renderer.getPixelRatio() - target) < 0.01) return;
    this._renderer.setPixelRatio(target);
    if (this._composer) {
      this._composer.setPixelRatio?.(target);
      this._composer.setSize(window.innerWidth, window.innerHeight);
    }
  }
}
