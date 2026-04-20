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
      arenaHud: document.getElementById('arena-hud'),
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
   * Show galaxy selection screen (replaces warp gate tier-skip).
   * @param {Array<{galaxyIndex: number, name: string, startTier: number}>} galaxies - unlocked galaxies
   * @param {function(galaxyIndex: number): void} onSelect - called with chosen galaxy index
   */
  showGalaxySelect(galaxies, onSelect) {
    const list = document.getElementById('warp-gate-list');
    list.innerHTML = '';

    for (const g of galaxies) {
      const btn = document.createElement('button');
      btn.className = 'neon-btn warp-gate-btn' + (g.galaxyIndex === 0 ? ' gate-standard' : '');
      btn.innerHTML = `
        <span class="warp-gate-sector">${g.name}</span>
        <span class="warp-gate-label">${g.galaxyIndex === 0 ? 'Standard Launch' : `Galaxy ${g.galaxyIndex + 1} — Sector 1`}</span>
      `;
      btn.onclick = () => { this.hide('warpGate'); onSelect(g.galaxyIndex); };
      list.appendChild(btn);
    }

    this.show('warpGate');
  }

  /** @deprecated Use showGalaxySelect instead */
  showWarpGateSelect(gates, onSelect) {
    this.showGalaxySelect(
      [{ galaxyIndex: 0, name: 'Milky Way', startTier: 1 },
       ...gates.map(g => ({ galaxyIndex: Math.floor(g.tier / 10), name: `Sector ${g.tier}`, startTier: g.tier }))],
      (idx) => onSelect(idx * 10 + 1),
    );
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
