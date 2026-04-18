/**
 * Lightweight FPS/stats overlay that lives in the DOM so it costs nothing on
 * the WebGL side.
 *
 * Exposes:
 *   - An always-on "compact" view (FPS + frame ms) anchored to a screen corner.
 *   - A "full" view (adds entities / draw calls / triangles) used when the
 *     Debug Menu is open or the detailed toggle is on.
 *
 * The overlay samples a rolling window of frame deltas so FPS/frame-time don't
 * flicker. Values are repainted at ~4 Hz regardless of frame rate.
 */
export class PerfOverlay {
  constructor({ renderer, world } = {}) {
    this._renderer = renderer;
    this._world = world;

    this._visible = false;
    this._detailed = false;
    this._repaintHz = 4;
    this._repaintInterval = 1 / this._repaintHz;
    this._repaintTimer = 0;

    this._frameWindow = 120;
    this._frameTimes = new Float32Array(this._frameWindow);
    this._frameIdx = 0;
    this._frameCount = 0;

    this._fps = 0;
    this._frameMs = 0;
    this._fpsMin = 0;

    // Rolling window (shorter) of RAW frame gap + work time so transient
    // stalls aren't washed out by the fps average. We also track a "peak"
    // that decays over time so a single bad spike stays visible for a while.
    this._spikeWindow = 240;        // ~4 seconds at 60 Hz
    this._gapMs = new Float32Array(this._spikeWindow);
    this._workMs = new Float32Array(this._spikeWindow);
    this._spikeIdx = 0;
    this._spikeCount = 0;
    this._recentMaxGapMs = 0;
    this._recentMaxWorkMs = 0;
    this._peakGapMs = 0;
    this._peakGapAgeSec = 0;

    this._host = this._buildDom();
    this._updateVisibility();
  }

  _buildDom() {
    const host = document.createElement('div');
    host.id = 'perf-overlay';
    host.className = 'perf-overlay hidden';
    host.setAttribute('aria-hidden', 'true');

    const fps = document.createElement('div');
    fps.className = 'perf-fps';
    host.appendChild(fps);
    this._fpsEl = fps;

    const ms = document.createElement('div');
    ms.className = 'perf-ms';
    host.appendChild(ms);
    this._msEl = ms;

    const spike = document.createElement('div');
    spike.className = 'perf-spike';
    host.appendChild(spike);
    this._spikeEl = spike;

    const details = document.createElement('div');
    details.className = 'perf-details hidden';
    host.appendChild(details);
    this._detailsEl = details;

    document.body.appendChild(host);
    return host;
  }

  setRenderer(renderer) { this._renderer = renderer; }
  setWorld(world) { this._world = world; }

  show() { this._visible = true; this._updateVisibility(); }
  hide() { this._visible = false; this._updateVisibility(); }
  toggle() { this._visible = !this._visible; this._updateVisibility(); }
  get visible() { return this._visible; }

  setDetailed(on) {
    this._detailed = !!on;
    this._detailsEl.classList.toggle('hidden', !this._detailed);
  }

  _updateVisibility() {
    this._host.classList.toggle('hidden', !this._visible);
    this._host.setAttribute('aria-hidden', this._visible ? 'false' : 'true');
  }

  /**
   * Called once per tick (real dt, not paused-clamped). `renderer.info` is
   * sampled here to measure the *previous* frame's draw calls/triangles, which
   * is fine for a monitoring overlay.
   *
   * @param {number} dt          - delta seconds as seen by the game loop (may be clamped).
   * @param {number} [rawGapMs]  - RAW milliseconds between rAF callbacks (uncapped).
   *                               Lets us surface hitches that the capped `dt` hides.
   * @param {number} [workMs]    - milliseconds spent inside the previous tick
   *                               (update + render). Useful to distinguish
   *                               CPU work from browser stalls/GC.
   */
  tick(dt, rawGapMs, workMs) {
    const clamped = Math.max(1e-5, Math.min(dt, 0.5));
    this._frameTimes[this._frameIdx] = clamped;
    this._frameIdx = (this._frameIdx + 1) % this._frameWindow;
    this._frameCount = Math.min(this._frameCount + 1, this._frameWindow);

    if (rawGapMs != null) {
      this._gapMs[this._spikeIdx] = rawGapMs;
      this._workMs[this._spikeIdx] = workMs ?? 0;
      this._spikeIdx = (this._spikeIdx + 1) % this._spikeWindow;
      this._spikeCount = Math.min(this._spikeCount + 1, this._spikeWindow);

      // Track a "sticky" peak that decays slowly so a 1-second hitch stays
      // visible for ~5 seconds instead of scrolling offscreen in 2 frames.
      this._peakGapAgeSec += clamped;
      if (rawGapMs > this._peakGapMs || this._peakGapAgeSec > 5) {
        this._peakGapMs = rawGapMs;
        this._peakGapAgeSec = 0;
      }

      // Log significant hitches to the console with whatever context we can
      // pull together (entity count, draw calls). Rate-limited so a sustained
      // stall doesn't spam.
      if (rawGapMs > 100) {
        const now = performance.now();
        if (!this._lastHitchLog || now - this._lastHitchLog > 500) {
          this._lastHitchLog = now;
          const info = this._renderer?.info?.render;
          const programs = this._renderer?.info?.programs?.length ?? 0;
          console.warn(
            `[perf] hitch: gap=${rawGapMs.toFixed(0)}ms work=${(workMs ?? 0).toFixed(0)}ms` +
            ` entities=${this._world?.entityCount ?? 0}` +
            ` draw=${info?.calls ?? 0} tris=${info?.triangles ?? 0}` +
            ` programs=${programs}`
          );
        }
      }
    }

    this._repaintTimer += clamped;
    if (!this._visible) return;
    if (this._repaintTimer < this._repaintInterval) return;
    this._repaintTimer = 0;

    this._recomputeStats();
    this._paint();
  }

  _recomputeStats() {
    let sum = 0;
    let worst = 0;
    const n = this._frameCount;
    for (let i = 0; i < n; i++) {
      const t = this._frameTimes[i];
      sum += t;
      if (t > worst) worst = t;
    }
    const avg = n > 0 ? sum / n : 0;
    this._frameMs = avg * 1000;
    this._fps = avg > 0 ? 1 / avg : 0;
    this._fpsMin = worst > 0 ? 1 / worst : 0;

    let maxGap = 0;
    let maxWork = 0;
    const m = this._spikeCount;
    for (let i = 0; i < m; i++) {
      if (this._gapMs[i] > maxGap) maxGap = this._gapMs[i];
      if (this._workMs[i] > maxWork) maxWork = this._workMs[i];
    }
    this._recentMaxGapMs = maxGap;
    this._recentMaxWorkMs = maxWork;
  }

  _paint() {
    this._fpsEl.textContent = `${Math.round(this._fps)} FPS`;
    this._fpsEl.dataset.tier = this._fps >= 55 ? 'high' : this._fps >= 40 ? 'mid' : 'low';
    this._msEl.textContent = `${this._frameMs.toFixed(1)} ms avg (worst ${Math.round(this._fpsMin)} fps)`;

    // Spike line: recent worst gap + sticky peak + worst work time. The gap
    // reflects any browser stall or GC even when the sliding fps average
    // looks fine, so it's the first thing to check when the game hitches.
    const gapNow = Math.max(this._recentMaxGapMs, this._peakGapMs);
    const tier = gapNow >= 200 ? 'bad' : gapNow >= 50 ? 'warn' : 'ok';
    this._spikeEl.dataset.tier = tier;
    this._spikeEl.textContent =
      `gap ${gapNow.toFixed(0)} ms  work ${this._recentMaxWorkMs.toFixed(0)} ms`;

    if (!this._detailed) return;
    const info = this._renderer?.info?.render;
    const calls = info?.calls ?? 0;
    const tris = info?.triangles ?? 0;
    const entities = this._world?.entityCount ?? 0;
    this._detailsEl.textContent =
      `entities ${entities}  draw ${calls}  tris ${tris.toLocaleString()}`;
  }

  /** Snapshot of the current stats for external consumers (e.g. Debug Menu). */
  getStats() {
    const info = this._renderer?.info?.render;
    return {
      fps: this._fps,
      frameMs: this._frameMs,
      fpsMin: this._fpsMin,
      maxGapMs: Math.max(this._recentMaxGapMs, this._peakGapMs),
      maxWorkMs: this._recentMaxWorkMs,
      entities: this._world?.entityCount ?? 0,
      drawCalls: info?.calls ?? 0,
      triangles: info?.triangles ?? 0,
    };
  }
}
