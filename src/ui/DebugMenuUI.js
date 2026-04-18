import { CURRENCIES } from '../constants.js';
import { reticleDebug } from '../components/enemy/EnemyVisualsComponent.js';
import { DEBUG_ENEMY_SPAWN_TYPES } from '../components/enemy/EnemyDefs.js';

const CURRENCY_KEYS = Object.keys(CURRENCIES);
const DEBUG_MENU_POS_KEY = 'infinite_aliens_debug_menu_pos';

function _fmtSlider(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 100) return String(Math.round(v));
  if (a >= 10) return (Math.round(v * 100) / 100).toString();
  return (Math.round(v * 1000) / 1000).toString();
}

export class DebugMenuUI {
  /**
   * @param {object} game - Game instance with state, currency, _debugResetGame, _debugGrantCurrencies
   */
  constructor(game) {
    this._game = game;
    this._panel = document.getElementById('debug-menu-screen');
    this._built = false;
    this._inputs = {};
    this._currentEls = {};
    this._visualSyncers = [];
    this._onDebugResize = null;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (!this._built) this._build();
    this._syncInputs();
    const panel = document.getElementById('debug-menu-panel');
    if (panel) this._clampPanelPosition(panel);
    this._panel.classList.remove('hidden');
    // Promote perf overlay to detailed view while the menu is open.
    this._game.perfOverlay?.setDetailed(true);
    this._startPerfPoll();
  }

  close() {
    this._panel.classList.add('hidden');
    this._game.perfOverlay?.setDetailed(false);
    this._stopPerfPoll();
  }

  get isOpen() {
    return !this._panel.classList.contains('hidden');
  }

  _syncInputs() {
    const s = this._game.state;
    for (const key of CURRENCY_KEYS) {
      const cur = s ? Math.floor(s.currencies[key] || 0) : 0;
      if (this._currentEls[key]) this._currentEls[key].textContent = `Current: ${cur}`;
      const inp = this._inputs[key];
      if (inp) inp.value = '0';
    }
    this._syncVisualControls();
  }

  _syncVisualControls() {
    for (const fn of this._visualSyncers) fn();
  }

  _build() {
    this._built = true;
    this._panel.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.id = 'debug-menu-panel';
    this._panel.appendChild(wrap);

    const header = document.createElement('div');
    header.className = 'debug-menu-header';
    header.title = 'Drag to move (position saved in this browser)';
    header.innerHTML = '<span class="debug-menu-title">DEBUG</span>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'neon-btn small';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    wrap.appendChild(header);

    const hint = document.createElement('p');
    hint.className = 'debug-menu-hint';
    hint.textContent =
      'Ctrl+Shift+D to toggle. Drag the header to move this panel; the game stays visible and clickable outside it. P / ⏸ / Esc (when paused) for pause. Resource amounts and visual sliders are not saved.';
    wrap.appendChild(hint);

    const pauseRow = document.createElement('div');
    pauseRow.className = 'debug-menu-actions';
    pauseRow.style.borderTop = 'none';
    pauseRow.style.paddingTop = '0';
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'neon-btn small';
    pauseBtn.textContent = 'TOGGLE PAUSE (P)';
    pauseBtn.addEventListener('click', () =>
      this._game.togglePause({ showPauseOverlay: false })
    );
    pauseRow.appendChild(pauseBtn);
    wrap.appendChild(pauseRow);

    this._buildSpawnSection(wrap);

    this._buildPerformanceSection(wrap);
    this._buildVisualSection(wrap);
    this._buildTargetingSection(wrap);

    const grid = document.createElement('div');
    grid.className = 'debug-menu-grid';
    for (const key of CURRENCY_KEYS) {
      const meta = CURRENCIES[key];
      const row = document.createElement('div');
      row.className = 'debug-menu-row';
      const left = document.createElement('div');
      left.className = 'debug-menu-row-label';
      const title = document.createElement('div');
      title.className = 'debug-menu-currency-title';
      title.textContent = `${meta.icon} ${meta.label}`;
      const curEl = document.createElement('div');
      curEl.className = 'debug-menu-currency-current';
      curEl.textContent = 'Current: 0';
      this._currentEls[key] = curEl;
      left.appendChild(title);
      left.appendChild(curEl);
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = `debug-amt-${key}`;
      inp.className = 'debug-menu-input';
      inp.title = 'Amount to add';
      inp.value = '0';
      inp.step = '1';
      this._inputs[key] = inp;
      row.appendChild(left);
      row.appendChild(inp);
      grid.appendChild(row);
    }
    wrap.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'debug-menu-actions';

    const grantBtn = document.createElement('button');
    grantBtn.className = 'neon-btn';
    grantBtn.textContent = 'ADD RESOURCES';
    grantBtn.onclick = () => {
      const amounts = {};
      for (const key of CURRENCY_KEYS) {
        const v = parseInt(this._inputs[key].value, 10);
        if (Number.isFinite(v) && v !== 0) amounts[key] = v;
      }
      this._game._debugGrantCurrencies(amounts);
      this._syncInputs();
    };
    actions.appendChild(grantBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'neon-btn small';
    resetBtn.style.borderColor = 'var(--pink)';
    resetBtn.style.color = 'var(--pink)';
    resetBtn.textContent = 'RESET GAME';
    resetBtn.onclick = () => {
      if (window.confirm('Clear save and start a fresh game?')) {
        this._game._debugResetGame();
        this.close();
      }
    };
    actions.appendChild(resetBtn);

    wrap.appendChild(actions);

    this._restorePanelPosition(wrap);
    this._clampPanelPosition(wrap);
    this._attachPanelDrag(header, wrap);
    this._onDebugResize = () => {
      if (this.isOpen) this._clampPanelPosition(wrap);
    };
    window.addEventListener('resize', this._onDebugResize);
  }

  _restorePanelPosition(panel) {
    try {
      const raw = localStorage.getItem(DEBUG_MENU_POS_KEY);
      if (raw) {
        const { left, top } = JSON.parse(raw);
        if (Number.isFinite(left) && Number.isFinite(top)) {
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
          panel.style.right = 'auto';
          return;
        }
      }
    } catch (_) { /* ignore */ }
    panel.style.left = '16px';
    panel.style.top = '16px';
    panel.style.right = 'auto';
  }

  _clampPanelPosition(panel) {
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    if (w === 0 || h === 0) return;
    const rect = panel.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    const maxL = Math.max(0, window.innerWidth - w);
    const maxT = Math.max(0, window.innerHeight - h);
    left = Math.max(0, Math.min(left, maxL));
    top = Math.max(0, Math.min(top, maxT));
    panel.style.right = 'auto';
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  _attachPanelDrag(header, panel) {
    header.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      e.preventDefault();
      header.setPointerCapture(e.pointerId);

      const rect = panel.getBoundingClientRect();
      panel.style.right = 'auto';
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;

      const o = {
        pointerId: e.pointerId,
        originX: e.clientX,
        originY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top,
      };

      const onMove = ev => {
        if (ev.pointerId !== o.pointerId) return;
        let left = o.startLeft + (ev.clientX - o.originX);
        let top = o.startTop + (ev.clientY - o.originY);
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const maxL = Math.max(0, window.innerWidth - w);
        const maxT = Math.max(0, window.innerHeight - h);
        left = Math.max(0, Math.min(left, maxL));
        top = Math.max(0, Math.min(top, maxT));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      };

      const onUp = ev => {
        if (ev.pointerId !== o.pointerId) return;
        if (header.hasPointerCapture(ev.pointerId)) {
          header.releasePointerCapture(ev.pointerId);
        }
        header.removeEventListener('pointermove', onMove);
        header.removeEventListener('pointerup', onUp);
        header.removeEventListener('pointercancel', onUp);
        document.body.style.userSelect = '';
        try {
          localStorage.setItem(
            DEBUG_MENU_POS_KEY,
            JSON.stringify({
              left: Math.round(parseFloat(panel.style.left) || 0),
              top: Math.round(parseFloat(panel.style.top) || 0),
            })
          );
        } catch (_) { /* ignore */ }
      };

      document.body.style.userSelect = 'none';
      header.addEventListener('pointermove', onMove);
      header.addEventListener('pointerup', onUp);
      header.addEventListener('pointercancel', onUp);
    });
  }

  _sectionTitle(wrap, text) {
    const h = document.createElement('div');
    h.className = 'debug-menu-section-title';
    h.textContent = text;
    wrap.appendChild(h);
  }

  _addSliderRow(wrap, label, min, max, step, read, write) {
    const row = document.createElement('div');
    row.className = 'debug-menu-row debug-menu-slider-row';
    const lab = document.createElement('div');
    lab.className = 'debug-menu-row-label';
    const t = document.createElement('div');
    t.className = 'debug-menu-currency-title';
    t.textContent = label;
    lab.appendChild(t);
    const controls = document.createElement('div');
    controls.className = 'debug-slider-controls';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.className = 'debug-menu-range';
    const val = document.createElement('span');
    val.className = 'debug-slider-value';
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      write(v);
      val.textContent = _fmtSlider(v);
    });
    controls.appendChild(range);
    controls.appendChild(val);
    row.appendChild(lab);
    row.appendChild(controls);
    wrap.appendChild(row);
    this._visualSyncers.push(() => {
      const v = read();
      range.value = String(v);
      val.textContent = _fmtSlider(v);
    });
  }

  _addColorRow(wrap, label, readHex, writeHex) {
    const row = document.createElement('div');
    row.className = 'debug-menu-row debug-menu-slider-row';
    const lab = document.createElement('div');
    lab.className = 'debug-menu-row-label';
    const t = document.createElement('div');
    t.className = 'debug-menu-currency-title';
    t.textContent = label;
    lab.appendChild(t);
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.className = 'debug-color-input';
    inp.addEventListener('input', () => {
      writeHex(parseInt(inp.value.slice(1), 16));
    });
    row.appendChild(lab);
    row.appendChild(inp);
    wrap.appendChild(row);
    this._visualSyncers.push(() => {
      const hex = readHex();
      inp.value = `#${hex.toString(16).padStart(6, '0')}`;
    });
  }

  _buildSpawnSection(wrap) {
    const sec = document.createElement('div');
    sec.className = 'debug-menu-visual';
    this._sectionTitle(sec, 'SPAWN ENEMIES');

    const hint = document.createElement('p');
    hint.className = 'debug-menu-hint';
    hint.style.marginTop = '0';
    hint.textContent =
      'Uses current sector tier. Swarm spawns a full pack (3). Boss obeys normal boss loot rules when killed.';
    sec.appendChild(hint);

    const row = document.createElement('div');
    row.className = 'debug-menu-spawn-btns';
    for (const id of DEBUG_ENEMY_SPAWN_TYPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'neon-btn small';
      btn.textContent = id.toUpperCase();
      btn.addEventListener('click', () => this._game._debugSpawnEnemy(id));
      row.appendChild(btn);
    }
    sec.appendChild(row);
    wrap.appendChild(sec);
  }

  _buildPerformanceSection(wrap) {
    const g = this._game;
    const sec = document.createElement('div');
    sec.className = 'debug-menu-visual';
    this._sectionTitle(sec, 'PERFORMANCE');

    const stats = document.createElement('div');
    stats.className = 'debug-perf-stats';
    this._perfStatsEl = stats;
    stats.textContent = 'fps — | ms — | draw — | tris — | entities —';
    sec.appendChild(stats);

    const qRow = document.createElement('div');
    qRow.className = 'debug-menu-spawn-btns';
    const label = document.createElement('span');
    label.style.marginRight = '6px';
    label.style.fontSize = '0.7rem';
    label.textContent = 'QUALITY:';
    qRow.appendChild(label);
    this._qualityBtns = {};
    for (const opt of ['auto', 'high', 'medium', 'low']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'neon-btn small';
      btn.textContent = opt.toUpperCase();
      btn.addEventListener('click', () => {
        g.settings.setGraphicsQuality(opt);
        this._syncQualityButtons();
      });
      this._qualityBtns[opt] = btn;
      qRow.appendChild(btn);
    }
    sec.appendChild(qRow);

    const ppRow = document.createElement('div');
    ppRow.className = 'debug-menu-actions';
    ppRow.style.borderTop = 'none';
    ppRow.style.paddingTop = '4px';
    const ppBtn = document.createElement('button');
    ppBtn.className = 'neon-btn small';
    ppBtn.textContent = 'TOGGLE POST-PROCESSING';
    ppBtn.addEventListener('click', () => {
      const cur = g.qualityController.postProcessingEnabled;
      g.qualityController.setPostProcessingEnabled(!cur);
      ppBtn.textContent = g.qualityController.postProcessingEnabled
        ? 'POST-PROCESSING: ON'
        : 'POST-PROCESSING: OFF';
    });
    ppBtn.textContent = g.qualityController.postProcessingEnabled
      ? 'POST-PROCESSING: ON'
      : 'POST-PROCESSING: OFF';
    ppRow.appendChild(ppBtn);
    sec.appendChild(ppRow);

    this._visualSyncers.push(() => this._syncQualityButtons());
    wrap.appendChild(sec);
  }

  _syncQualityButtons() {
    if (!this._qualityBtns) return;
    const active = this._game.settings.graphicsQuality;
    for (const [opt, btn] of Object.entries(this._qualityBtns)) {
      const on = opt === active;
      btn.style.borderColor = on ? 'var(--cyan)' : '';
      btn.style.color       = on ? 'var(--cyan)' : '';
      btn.style.boxShadow   = on ? 'var(--glow-cyan)' : 'none';
    }
  }

  _startPerfPoll() {
    if (this._perfPollTimer != null) return;
    const tick = () => {
      if (!this.isOpen) return;
      const s = this._game.perfOverlay?.getStats?.();
      if (s && this._perfStatsEl) {
        const tier = this._game.qualityController?.currentTier ?? '-';
        this._perfStatsEl.textContent =
          `fps ${Math.round(s.fps)} | ${s.frameMs.toFixed(1)} ms | gap ${s.maxGapMs.toFixed(0)} ms | work ${s.maxWorkMs.toFixed(0)} ms | draw ${s.drawCalls} | tris ${s.triangles.toLocaleString()} | entities ${s.entities} | tier ${tier}`;
      }
    };
    tick();
    this._perfPollTimer = window.setInterval(tick, 250);
  }

  _stopPerfPoll() {
    if (this._perfPollTimer != null) {
      window.clearInterval(this._perfPollTimer);
      this._perfPollTimer = null;
    }
  }

  _buildTargetingSection(wrap) {
    const PI = Math.PI;
    const sec = document.createElement('div');
    sec.className = 'debug-menu-visual';
    this._sectionTitle(sec, 'TARGETING RETICLE');

    this._addSliderRow(sec, 'Offset X', -PI, PI, 0.01,
      () => reticleDebug.offsetX, (v) => { reticleDebug.offsetX = v; });
    this._addSliderRow(sec, 'Offset Y', -PI, PI, 0.01,
      () => reticleDebug.offsetY, (v) => { reticleDebug.offsetY = v; });
    this._addSliderRow(sec, 'Offset Z', -PI, PI, 0.01,
      () => reticleDebug.offsetZ, (v) => { reticleDebug.offsetZ = v; });

    wrap.appendChild(sec);
  }

  _buildVisualSection(wrap) {
    const g = this._game;
    const pp = g._postPasses;
    const sm = g.scene;
    if (!pp || !sm) return;

    const sec = document.createElement('div');
    sec.className = 'debug-menu-visual';
    this._sectionTitle(sec, 'POST-PROCESSING');

    this._addSliderRow(
      sec,
      'Bloom strength',
      0,
      2,
      0.01,
      () => pp.bloom.strength,
      (v) => { pp.bloom.strength = v; }
    );
    this._addSliderRow(
      sec,
      'Bloom radius',
      0,
      1,
      0.01,
      () => pp.bloom.radius,
      (v) => { pp.bloom.radius = v; }
    );
    this._addSliderRow(
      sec,
      'Bloom threshold',
      0,
      1,
      0.01,
      () => pp.bloom.threshold,
      (v) => { pp.bloom.threshold = v; }
    );
    this._addSliderRow(
      sec,
      'Chromatic aberration',
      0,
      0.02,
      0.0001,
      () => pp.chromatic.uniforms.offset.value,
      (v) => { pp.chromatic.uniforms.offset.value = v; }
    );
    this._addSliderRow(
      sec,
      'Vignette',
      0,
      1.5,
      0.01,
      () => pp.colorGrade.uniforms.vignetteIntensity.value,
      (v) => { pp.colorGrade.uniforms.vignetteIntensity.value = v; }
    );
    this._addSliderRow(
      sec,
      'Saturation',
      0.3,
      2,
      0.01,
      () => pp.colorGrade.uniforms.saturation.value,
      (v) => { pp.colorGrade.uniforms.saturation.value = v; }
    );
    this._addSliderRow(
      sec,
      'Scanline intensity',
      0,
      0.12,
      0.001,
      () => pp.scanlines.uniforms.intensity.value,
      (v) => { pp.scanlines.uniforms.intensity.value = v; }
    );
    this._addSliderRow(
      sec,
      'Scanline frequency',
      200,
      1400,
      10,
      () => pp.scanlines.uniforms.lineFrequency.value,
      (v) => { pp.scanlines.uniforms.lineFrequency.value = v; }
    );
    this._addSliderRow(
      sec,
      'Film grain',
      0,
      0.12,
      0.001,
      () => pp.grain.uniforms.intensity.value,
      (v) => { pp.grain.uniforms.intensity.value = v; }
    );

    this._sectionTitle(sec, 'SCENE & LIGHTS');

    this._addSliderRow(
      sec,
      'Fog near',
      5,
      120,
      0.5,
      () => sm.scene.fog.near,
      (v) => { sm.scene.fog.near = v; }
    );
    this._addSliderRow(
      sec,
      'Fog far',
      20,
      200,
      0.5,
      () => sm.scene.fog.far,
      (v) => { sm.scene.fog.far = v; }
    );
    this._addColorRow(
      sec,
      'Fog color',
      () => sm.scene.fog.color.getHex(),
      (hex) => { sm.scene.fog.color.setHex(hex); }
    );
    this._addColorRow(
      sec,
      'Background',
      () => sm.scene.background.getHex(),
      (hex) => { sm.scene.background.setHex(hex); }
    );
    this._addColorRow(
      sec,
      'Ambient light',
      () => sm.ambientLight.color.getHex(),
      (hex) => { sm.ambientLight.color.setHex(hex); }
    );
    this._addSliderRow(
      sec,
      'Ambient intensity',
      0,
      2,
      0.01,
      () => sm.ambientLight.intensity,
      (v) => { sm.ambientLight.intensity = v; }
    );
    this._addColorRow(
      sec,
      'Directional light',
      () => sm.directionalLight.color.getHex(),
      (hex) => { sm.directionalLight.color.setHex(hex); }
    );
    this._addSliderRow(
      sec,
      'Directional intensity',
      0,
      3,
      0.01,
      () => sm.directionalLight.intensity,
      (v) => { sm.directionalLight.intensity = v; }
    );
    this._addSliderRow(
      sec,
      'Fill light (under)',
      0,
      1.5,
      0.01,
      () => sm.fillLight.intensity,
      (v) => { sm.fillLight.intensity = v; }
    );
    this._addSliderRow(
      sec,
      'Tone mapping exposure',
      0.2,
      3,
      0.01,
      () => sm.renderer.toneMappingExposure,
      (v) => { sm.renderer.toneMappingExposure = v; }
    );

    const visActions = document.createElement('div');
    visActions.className = 'debug-menu-visual-actions';
    const resetVis = document.createElement('button');
    resetVis.className = 'neon-btn small';
    resetVis.textContent = 'RESET VISUALS';
    resetVis.addEventListener('click', () => {
      g.resetDebugVisuals();
      this._syncVisualControls();
    });
    visActions.appendChild(resetVis);

    const copyVis = document.createElement('button');
    copyVis.type = 'button';
    copyVis.className = 'neon-btn small';
    copyVis.title =
      'Copies instructions + JSON for an AI to apply as new defaults in constants, SceneManager, ShaderPasses, and main.js';
    copyVis.textContent = 'COPY VISUAL JSON';
    const copyLabel = 'COPY VISUAL JSON';
    copyVis.addEventListener('click', async () => {
      const ok = await g.copyVisualSettingsToClipboard();
      copyVis.textContent = ok ? 'COPIED' : 'COPY FAILED';
      setTimeout(() => {
        copyVis.textContent = copyLabel;
      }, 2000);
    });
    visActions.appendChild(copyVis);
    sec.appendChild(visActions);

    wrap.appendChild(sec);
  }
}
