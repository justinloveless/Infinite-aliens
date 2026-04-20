export class UIManager {
  constructor() {
    this._screens = {
      start: document.getElementById('start-screen'),
      hud: document.getElementById('hud'),
      techTree: document.getElementById('tech-tree-screen'),
      transition: document.getElementById('round-transition'),
      death: document.getElementById('death-screen'),
      welcome: document.getElementById('welcome-screen'),
      warpGate: document.getElementById('warp-gate-screen'),
      hangar: document.getElementById('hangar-screen'),
      store: document.getElementById('store-screen'),
      research: document.getElementById('research-screen'),
    };
  }

  show(id) {
    const el = this._screens[id];
    if (el) el.classList.remove('hidden');
  }

  hide(id) {
    const el = this._screens[id];
    if (el) el.classList.add('hidden');
  }

  hideAll() {
    Object.values(this._screens).forEach(el => el?.classList.add('hidden'));
  }

  /**
   * @param {object|null} stats  - lastRun stats, or null for first-run "ready" state
   * @param {function} onViewTree - open tech tree overlay
   * @param {function} onLaunch   - start a new run
   * @param {function} [onViewHangar] - open hangar overlay
   */
  showDeath(stats, onViewTree, onLaunch, onViewHangar) {
    const title = document.getElementById('death-title');
    const statsEl = document.getElementById('death-stats');

    if (stats) {
      title.textContent = 'SHIP DESTROYED';
      const lootLines = Object.entries(stats.loot || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<span>${v} ${k}</span>`)
        .join('  ');
      statsEl.innerHTML = `
        <div class="death-stat">Distance: ${Math.floor(stats.distance)} ly  |  Tier ${stats.tier}</div>
        <div class="death-stat">Enemies: ${stats.enemiesDefeated}  |  Bosses: ${stats.bossesDefeated}</div>
        ${lootLines ? `<div class="death-stat">${lootLines}</div>` : ''}
      `;
    } else {
      title.textContent = 'READY FOR LAUNCH';
      statsEl.innerHTML = '<div class="death-stat">Your upgrades persist between runs. Good luck, Commander.</div>';
    }

    this.show('death');
    document.getElementById('view-tree-btn').onclick = onViewTree;
    const hangarBtn = document.getElementById('view-hangar-btn');
    if (hangarBtn) hangarBtn.onclick = onViewHangar || null;
    document.getElementById('death-launch-btn').onclick = () => {
      this.hide('death');
      onLaunch();
    };
  }

  showWelcome(offlineData, onOk) {
    const earningsEl = document.getElementById('offline-earnings');
    if (offlineData) {
      const hrs = Math.floor(offlineData.elapsed / 3600);
      const mins = Math.floor((offlineData.elapsed % 3600) / 60);
      let timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      let lines = [`While you were away for ${timeStr}...`];
      for (const [type, amt] of Object.entries(offlineData.earnings)) {
        if (amt > 0) lines.push(`+${amt} Stellar Dust collected`);
      }
      earningsEl.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
    } else {
      earningsEl.innerHTML = '<div>Your mission continues, Commander.</div>';
    }

    this.show('welcome');
    document.getElementById('welcome-ok-btn').onclick = () => {
      this.hide('welcome');
      if (onOk) onOk();
    };
  }

  showStart(onStart) {
    this.show('start');
    document.getElementById('start-btn').onclick = () => {
      this.hide('start');
      if (onStart) onStart();
    };
  }

  /**
   * Show the warp gate selection screen.
   * @param {Array<{gateNum: number, tier: number}>} gates - unlocked gates (excluding gate 0)
   * @param {function(startTier: number): void} onSelect - called with the chosen starting tier
   */
  showWarpGateSelect(gates, onSelect) {
    const list = document.getElementById('warp-gate-list');
    list.innerHTML = '';

    // Standard launch (always first)
    const standardBtn = document.createElement('button');
    standardBtn.className = 'neon-btn warp-gate-btn gate-standard';
    standardBtn.innerHTML = `
      <span class="warp-gate-sector">Sector 1</span>
      <span class="warp-gate-label">Standard Launch</span>
    `;
    standardBtn.onclick = () => { this.hide('warpGate'); onSelect(1); };
    list.appendChild(standardBtn);

    for (const gate of gates) {
      const btn = document.createElement('button');
      btn.className = 'neon-btn warp-gate-btn';
      btn.innerHTML = `
        <span class="warp-gate-sector">Sector ${gate.tier}</span>
        <span class="warp-gate-label">Warp Gate ${gate.gateNum}</span>
      `;
      btn.onclick = () => { this.hide('warpGate'); onSelect(gate.tier); };
      list.appendChild(btn);
    }

    this.show('warpGate');
  }

  bindTechTreeButtons(onOpen, onClose) {
    document.getElementById('tech-tree-btn').onclick = onOpen;
    document.getElementById('close-tree-btn').onclick = onClose;
  }

  bindMuteButton(audioManager, settingsManager) {
    const btn = document.getElementById('mute-btn');
    // Sync initial label
    btn.textContent = audioManager.muted ? '🔇' : '♪';
    btn.onclick = () => {
      const muted = audioManager.toggleMute();
      if (settingsManager) settingsManager.setMuted(muted);
      btn.textContent = muted ? '🔇' : '♪';
    };
    // Keep label in sync when settings panel changes the mute state
    if (settingsManager) {
      settingsManager.onChange((key) => {
        if (key === 'muted' || key === 'reset') {
          btn.textContent = audioManager.muted ? '🔇' : '♪';
        }
      });
    }
  }
}
