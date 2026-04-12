export class UIManager {
  constructor() {
    this._screens = {
      start: document.getElementById('start-screen'),
      hud: document.getElementById('hud'),
      techTree: document.getElementById('tech-tree-screen'),
      transition: document.getElementById('round-transition'),
      death: document.getElementById('death-screen'),
      welcome: document.getElementById('welcome-screen'),
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

  showDeath(onRetry) {
    this.show('death');
    const btn = document.getElementById('retry-btn');
    btn.onclick = () => {
      this.hide('death');
      onRetry();
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

  bindTechTreeButtons(onOpen, onClose, onLaunch) {
    document.getElementById('tech-tree-btn').onclick = onOpen;
    document.getElementById('close-tree-btn').onclick = onClose;
    document.getElementById('launch-btn').onclick = onLaunch;
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
