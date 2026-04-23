import { KEYBIND_ACTIONS, GRAPHICS_QUALITY_OPTIONS } from '../core/SettingsManager.js';

// Human-readable label for a KeyboardEvent.code string
function codeLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key'))    return code.slice(3);           // KeyA -> A
  if (code.startsWith('Digit'))  return code.slice(5);           // Digit1 -> 1
  if (code === 'ArrowUp')    return '↑';
  if (code === 'ArrowDown')  return '↓';
  if (code === 'ArrowLeft')  return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'Space')      return 'Space';
  if (code === 'ShiftLeft')  return 'L.Shift';
  if (code === 'ShiftRight') return 'R.Shift';
  if (code === 'ControlLeft') return 'L.Ctrl';
  if (code === 'ControlRight') return 'R.Ctrl';
  return code;
}

export class SettingsUI {
  /**
   * @param {import('../core/SettingsManager.js').SettingsManager} settings
   * @param {import('../core/AudioManager.js').AudioManager} audio
   * @param {import('../audio/VoiceManager.js').VoiceManager} [voice]
   */
  constructor(settings, audio, voice = null) {
    this._settings = settings;
    this._audio    = audio;
    this._voice    = voice;
    this._panel    = document.getElementById('settings-screen');
    this._capturingAction = null; // keybind action currently listening for a key
    this._captureHandler  = null; // active keydown listener
    this._built = false;
  }

  open() {
    if (!this._built) this._build();
    this._sync();
    this._panel.classList.remove('hidden');
  }

  close() {
    this._cancelCapture();
    this._panel.classList.add('hidden');
  }

  get isOpen() { return !this._panel.classList.contains('hidden'); }

  // ---- Build DOM ----

  _build() {
    this._built = true;
    this._panel.innerHTML = '';

    // ---- Wrapper ----
    const wrap = document.createElement('div');
    wrap.id = 'settings-panel';
    this._panel.appendChild(wrap);

    // ---- Header ----
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = `<span class="settings-title">SETTINGS</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'neon-btn small';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    wrap.appendChild(header);

    // ---- Audio section ----
    wrap.appendChild(this._buildSection('AUDIO', this._buildAudio()));

    // ---- Graphics section ----
    wrap.appendChild(this._buildSection('GRAPHICS', this._buildGraphics()));

    // ---- Controls section ----
    wrap.appendChild(this._buildSection('CONTROLS', this._buildControls()));

    // ---- Footer ----
    const footer = document.createElement('div');
    footer.className = 'settings-footer';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'neon-btn small';
    resetBtn.textContent = 'RESET TO DEFAULTS';
    resetBtn.onclick = () => {
      this._settings.resetDefaults();
      this._audio.setMusicVolume(this._settings.musicVolume);
      this._audio.setSfxVolume(this._settings.sfxVolume);
      this._audio.setMuted(this._settings.muted);
      this._voice?.setVolume(this._settings.voiceVolume);
      this._sync();
    };
    footer.appendChild(resetBtn);
    wrap.appendChild(footer);

    // Close on backdrop click
    this._panel.addEventListener('click', e => {
      if (e.target === this._panel) this.close();
    });
  }

  _buildSection(title, content) {
    const section = document.createElement('div');
    section.className = 'settings-section';
    const h = document.createElement('div');
    h.className = 'settings-section-title';
    h.textContent = title;
    section.appendChild(h);
    section.appendChild(content);
    return section;
  }

  // ---- Audio controls ----

  _buildAudio() {
    const el = document.createElement('div');
    el.className = 'settings-audio';

    el.appendChild(this._buildSlider(
      'music-vol', 'MUSIC VOLUME',
      () => this._settings.musicVolume,
      v => {
        this._settings.setMusicVolume(v);
        this._audio.setMusicVolume(v);
      }
    ));

    el.appendChild(this._buildSlider(
      'sfx-vol', 'SFX VOLUME',
      () => this._settings.sfxVolume,
      v => {
        this._settings.setSfxVolume(v);
        this._audio.setSfxVolume(v);
        this._audio.play('pickup'); // preview the sfx
      }
    ));

    el.appendChild(this._buildSlider(
      'voice-vol', 'VOICE VOLUME',
      () => this._settings.voiceVolume,
      v => {
        this._settings.setVoiceVolume(v);
        this._voice?.setVolume(v);
      }
    ));

    // Voice toggle row
    const voiceRow = document.createElement('div');
    voiceRow.className = 'settings-row';
    const voiceLabel = document.createElement('span');
    voiceLabel.className = 'settings-label';
    voiceLabel.textContent = 'ASSISTANT VOICE';
    this._voiceBtn = document.createElement('button');
    this._voiceBtn.className = 'neon-btn small';
    this._voiceBtn.onclick = () => {
      const next = !this._settings.voiceEnabled;
      this._settings.setVoiceEnabled(next);
      if (!next) this._voice?.stopAll();
      this._syncVoiceBtn();
    };
    voiceRow.appendChild(voiceLabel);
    voiceRow.appendChild(this._voiceBtn);
    el.appendChild(voiceRow);

    // Subtitles toggle row
    const subRow = document.createElement('div');
    subRow.className = 'settings-row';
    const subLabel = document.createElement('span');
    subLabel.className = 'settings-label';
    subLabel.textContent = 'SUBTITLES';
    this._subtitlesBtn = document.createElement('button');
    this._subtitlesBtn.className = 'neon-btn small';
    this._subtitlesBtn.onclick = () => {
      this._settings.setSubtitlesEnabled(!this._settings.subtitlesEnabled);
      this._syncSubtitlesBtn();
    };
    subRow.appendChild(subLabel);
    subRow.appendChild(this._subtitlesBtn);
    el.appendChild(subRow);

    // Mute toggle row
    const muteRow = document.createElement('div');
    muteRow.className = 'settings-row';
    const muteLabel = document.createElement('span');
    muteLabel.className = 'settings-label';
    muteLabel.textContent = 'MUTE ALL';
    this._muteBtn = document.createElement('button');
    this._muteBtn.className = 'neon-btn small';
    this._muteBtn.onclick = () => {
      const next = !this._settings.muted;
      this._settings.setMuted(next);
      this._audio.setMuted(next);
      this._syncMuteBtn();
    };
    muteRow.appendChild(muteLabel);
    muteRow.appendChild(this._muteBtn);
    el.appendChild(muteRow);

    return el;
  }

  _buildSlider(id, label, getter, setter) {
    const row = document.createElement('div');
    row.className = 'settings-row settings-slider-row';

    const lbl = document.createElement('span');
    lbl.className = 'settings-label';
    lbl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.className = 'settings-slider';
    slider.dataset.id = id;

    const pct = document.createElement('span');
    pct.className = 'settings-slider-pct';
    pct.dataset.id = id;

    const update = v => {
      pct.textContent = `${Math.round(v * 100)}%`;
      slider.value = v;
    };

    slider.oninput = () => {
      const v = parseFloat(slider.value);
      update(v);
      setter(v);
    };

    row.appendChild(lbl);
    row.appendChild(slider);
    row.appendChild(pct);
    return row;
  }

  // ---- Graphics controls ----

  _buildGraphics() {
    const el = document.createElement('div');
    el.className = 'settings-audio';

    const fpsRow = document.createElement('div');
    fpsRow.className = 'settings-row';
    const fpsLabel = document.createElement('span');
    fpsLabel.className = 'settings-label';
    fpsLabel.textContent = 'SHOW FPS (F3)';
    this._fpsBtn = document.createElement('button');
    this._fpsBtn.className = 'neon-btn small';
    this._fpsBtn.onclick = () => {
      this._settings.setShowFps(!this._settings.showFps);
      this._syncShowFpsBtn();
    };
    fpsRow.appendChild(fpsLabel);
    fpsRow.appendChild(this._fpsBtn);
    el.appendChild(fpsRow);

    const tiltRow = document.createElement('div');
    tiltRow.className = 'settings-row';
    const tiltLabel = document.createElement('span');
    tiltLabel.className = 'settings-label';
    tiltLabel.textContent = 'CAMERA TILT';
    this._cameraTiltBtn = document.createElement('button');
    this._cameraTiltBtn.className = 'neon-btn small';
    this._cameraTiltBtn.onclick = () => {
      this._settings.setCameraTiltEnabled(!this._settings.cameraTiltEnabled);
      this._syncCameraTiltBtn();
    };
    tiltRow.appendChild(tiltLabel);
    tiltRow.appendChild(this._cameraTiltBtn);
    el.appendChild(tiltRow);

    const qRow = document.createElement('div');
    qRow.className = 'settings-row';
    const qLabel = document.createElement('span');
    qLabel.className = 'settings-label';
    qLabel.textContent = 'QUALITY';
    const qBtns = document.createElement('div');
    qBtns.className = 'settings-quality-btns';
    this._qualityBtns = {};
    for (const opt of GRAPHICS_QUALITY_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'neon-btn small';
      btn.textContent = opt.toUpperCase();
      btn.onclick = () => {
        this._settings.setGraphicsQuality(opt);
        this._syncQualityBtns();
      };
      this._qualityBtns[opt] = btn;
      qBtns.appendChild(btn);
    }
    qRow.appendChild(qLabel);
    qRow.appendChild(qBtns);
    el.appendChild(qRow);

    return el;
  }

  // ---- Keybind controls ----

  _buildControls() {
    const el = document.createElement('div');
    el.className = 'settings-controls';

    for (const action of KEYBIND_ACTIONS) {
      const row = document.createElement('div');
      row.className = 'settings-row';

      const lbl = document.createElement('span');
      lbl.className = 'settings-label';
      lbl.textContent = action.label;

      const btn = document.createElement('button');
      btn.className = 'keybind-btn';
      btn.dataset.action = action.id;
      btn.onclick = () => this._startCapture(action.id, btn);

      row.appendChild(lbl);
      row.appendChild(btn);
      el.appendChild(row);
    }

    const hint = document.createElement('p');
    hint.className = 'settings-hint';
    hint.textContent = 'Arrow keys always work as alternates.';
    el.appendChild(hint);

    return el;
  }

  // ---- Keybind capture ----

  _startCapture(action, btn) {
    this._cancelCapture();
    this._capturingAction = action;
    btn.classList.add('capturing');
    btn.textContent = 'Press a key…';

    this._captureHandler = e => {
      e.preventDefault();
      // Ignore modifier-only presses
      if (['Shift','Control','Alt','Meta'].includes(e.key)) return;
      // Escape cancels
      if (e.code === 'Escape') { this._cancelCapture(); return; }

      this._settings.setKeybind(action, e.code);
      this._cancelCapture();
      this._syncKeybinds();
    };
    window.addEventListener('keydown', this._captureHandler);
  }

  _cancelCapture() {
    if (this._captureHandler) {
      window.removeEventListener('keydown', this._captureHandler);
      this._captureHandler = null;
    }
    this._capturingAction = null;
    // Restore all buttons to their current label
    this._syncKeybinds();
  }

  // ---- Sync UI state from settings ----

  _sync() {
    this._syncSliders();
    this._syncMuteBtn();
    this._syncVoiceBtn();
    this._syncSubtitlesBtn();
    this._syncKeybinds();
    this._syncShowFpsBtn();
    this._syncCameraTiltBtn();
    this._syncQualityBtns();
  }

  _syncVoiceBtn() {
    if (!this._voiceBtn) return;
    const on = this._settings.voiceEnabled;
    this._voiceBtn.textContent = on ? 'ON' : 'OFF';
    this._voiceBtn.style.borderColor = on ? 'var(--green)' : 'var(--pink)';
    this._voiceBtn.style.color       = on ? 'var(--green)' : 'var(--pink)';
  }

  _syncSubtitlesBtn() {
    if (!this._subtitlesBtn) return;
    const on = this._settings.subtitlesEnabled;
    this._subtitlesBtn.textContent = on ? 'ON' : 'OFF';
    this._subtitlesBtn.style.borderColor = on ? 'var(--green)' : 'var(--pink)';
    this._subtitlesBtn.style.color       = on ? 'var(--green)' : 'var(--pink)';
  }

  _syncShowFpsBtn() {
    if (!this._fpsBtn) return;
    const on = this._settings.showFps;
    this._fpsBtn.textContent = on ? 'ON' : 'OFF';
    this._fpsBtn.style.borderColor = on ? 'var(--green)' : '';
    this._fpsBtn.style.color       = on ? 'var(--green)' : '';
  }

  _syncCameraTiltBtn() {
    if (!this._cameraTiltBtn) return;
    const on = this._settings.cameraTiltEnabled;
    this._cameraTiltBtn.textContent = on ? 'ON' : 'OFF';
    this._cameraTiltBtn.style.borderColor = on ? 'var(--green)' : 'var(--pink)';
    this._cameraTiltBtn.style.color       = on ? 'var(--green)' : 'var(--pink)';
  }

  _syncQualityBtns() {
    if (!this._qualityBtns) return;
    const q = this._settings.graphicsQuality;
    for (const [opt, btn] of Object.entries(this._qualityBtns)) {
      const active = opt === q;
      btn.style.borderColor = active ? 'var(--cyan)' : '';
      btn.style.color       = active ? 'var(--cyan)' : 'rgba(255,255,255,0.55)';
      btn.style.boxShadow   = active ? 'var(--glow-cyan)' : 'none';
    }
  }

  _syncSliders() {
    const valueFor = (id) => {
      if (id === 'music-vol') return this._settings.musicVolume;
      if (id === 'voice-vol') return this._settings.voiceVolume;
      return this._settings.sfxVolume;
    };
    for (const slider of this._panel.querySelectorAll('.settings-slider')) {
      slider.value = valueFor(slider.dataset.id);
    }
    for (const pct of this._panel.querySelectorAll('.settings-slider-pct')) {
      pct.textContent = `${Math.round(valueFor(pct.dataset.id) * 100)}%`;
    }
  }

  _syncMuteBtn() {
    if (this._muteBtn) {
      const m = this._settings.muted;
      this._muteBtn.textContent = m ? 'UNMUTE' : 'MUTE';
      this._muteBtn.style.borderColor = m ? 'var(--pink)' : '';
      this._muteBtn.style.color       = m ? 'var(--pink)' : '';
    }
  }

  _syncKeybinds() {
    for (const btn of this._panel.querySelectorAll('.keybind-btn')) {
      if (btn.dataset.action === this._capturingAction) continue;
      const code = this._settings.getKeybind(btn.dataset.action);
      btn.textContent = codeLabel(code);
      btn.classList.remove('capturing');
    }
  }
}
