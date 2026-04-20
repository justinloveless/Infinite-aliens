import { eventBus, EVENTS } from '../core/EventBus.js';
import { CURRENCIES, RUN, CAMPAIGN } from '../constants.js';

export class HUD {
  constructor() {
    this._hpBar = document.getElementById('hp-bar');
    this._shieldBar = document.getElementById('shield-bar');
    this._heatBar = document.getElementById('heat-bar');
    this._energyBar = document.getElementById('energy-bar');
    this._roundNum = document.getElementById('round-number');
    this._galaxyLabel = document.getElementById('galaxy-label');
    this._distanceVal = document.getElementById('distance-value');
    this._bossBar = document.getElementById('boss-progress-bar');
    this._enemiesDefeated = document.getElementById('enemies-defeated');
    this._amtEls = {};

    for (const key of Object.keys(CURRENCIES)) {
      this._amtEls[key] = document.getElementById(`amt-${key}`);
    }

    this._warningEl = document.getElementById('arena-warning');
    this._warningHideTimer = null;

    this._subscribeEvents();
  }

  _subscribeEvents() {
    eventBus.on(EVENTS.CURRENCY_CHANGED, ({ type, total }) => {
      this._updateCurrencyDisplay(type, total);
    });
    eventBus.on(EVENTS.ROUND_STARTED, ({ round }) => {
      this._roundNum.textContent = round;
    });
    eventBus.on(EVENTS.ARENA_WARNING, () => this.showArenaWarning());
    eventBus.on(EVENTS.ARENA_TRANSITION_STARTED, () => this.hideArenaWarning());
  }

  /** Show the sector-9 heads-up banner for ~4 seconds. */
  showArenaWarning() {
    if (!this._warningEl) return;
    this._warningEl.classList.remove('hidden');
    if (this._warningHideTimer) clearTimeout(this._warningHideTimer);
    this._warningHideTimer = setTimeout(() => this.hideArenaWarning(), 4500);
  }

  hideArenaWarning() {
    if (!this._warningEl) return;
    this._warningEl.classList.add('hidden');
    if (this._warningHideTimer) {
      clearTimeout(this._warningHideTimer);
      this._warningHideTimer = null;
    }
  }

  show() { document.getElementById('hud').classList.remove('hidden'); }
  hide() { document.getElementById('hud').classList.add('hidden'); }

  update(state, computed, heatState) {
    if (!state) return;
    const p = state.player;

    const hpPct = computed
      ? (p.hp / computed.maxHp) * 100
      : (p.hp / p.maxHp) * 100;
    this._hpBar.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;

    if (hpPct > 50) {
      this._hpBar.style.background = 'linear-gradient(90deg, #39ff14, #00f5ff)';
    } else if (hpPct > 25) {
      this._hpBar.style.background = 'linear-gradient(90deg, #ffaa00, #ff6600)';
    } else {
      this._hpBar.style.background = 'linear-gradient(90deg, #ff2200, #ff0055)';
    }

    if (this._heatBar && heatState) {
      const pct = (heatState.heat / heatState.max) * 100;
      this._heatBar.style.width = `${Math.min(100, pct)}%`;
      if (heatState.overheated) {
        this._heatBar.style.background = 'linear-gradient(90deg, #ff0000, #ff4400)';
        this._heatBar.style.opacity = Math.sin(Date.now() * 0.012) * 0.4 + 0.6;
      } else if (pct > 70) {
        this._heatBar.style.background = 'linear-gradient(90deg, #ff4400, #ffaa00)';
        this._heatBar.style.opacity = 1;
      } else if (pct > 40) {
        this._heatBar.style.background = 'linear-gradient(90deg, #ffaa00, #ffee00)';
        this._heatBar.style.opacity = 1;
      } else {
        this._heatBar.style.background = 'linear-gradient(90deg, #00ff88, #00f5ff)';
        this._heatBar.style.opacity = 1;
      }
    }

    if (computed && computed.maxShieldHp > 0) {
      const shieldPct = (p.shieldHp / computed.maxShieldHp) * 100;
      this._shieldBar.style.width = `${Math.max(0, Math.min(100, shieldPct))}%`;
      document.getElementById('shield-container').style.display = '';
    } else {
      document.getElementById('shield-container').style.display = 'none';
    }

    if (this._energyBar && computed && computed.energyRegen > 0) {
      const energyPct = (p.energy / computed.maxEnergy) * 100;
      this._energyBar.style.width = `${Math.max(0, Math.min(100, energyPct))}%`;
      document.getElementById('energy-container').style.display = '';
    } else if (this._energyBar) {
      document.getElementById('energy-container').style.display = 'none';
    }

    const r = state.round;
    this._roundNum.textContent = r.current;

    if (this._galaxyLabel && state.campaign) {
      const g = state.campaign;
      const galaxyName = CAMPAIGN.GALAXY_NAMES[g.galaxyIndex] || 'Unknown Galaxy';
      const sector = ((r.current - 1) % CAMPAIGN.SECTORS_PER_GALAXY) + 1;
      this._galaxyLabel.textContent = g.infiniteMode
        ? `INFINITE MODE — Sector ${g.infiniteSector + 1}`
        : `${galaxyName} — Sector ${sector}/${CAMPAIGN.SECTORS_PER_GALAXY}`;
    }
    if (this._distanceVal) {
      this._distanceVal.textContent = Math.floor(r.distanceTraveled || 0);
    }

    if (this._bossBar) {
      // Progress through current galaxy's 10 sectors; boss fires at the start of sector 10.
      const galaxySpan = CAMPAIGN.SECTORS_PER_GALAXY * RUN.DISTANCE_PER_TIER;
      const bossAt = (CAMPAIGN.SECTORS_PER_GALAXY - 1) * RUN.DISTANCE_PER_TIER;
      const d = r.distanceTraveled || 0;
      const relD = galaxySpan > 0 ? d - Math.floor(d / galaxySpan) * galaxySpan : 0;
      const t = bossAt > 0 ? Math.min(1, Math.max(0, relD / bossAt)) : 0;
      this._bossBar.style.width = `${(r.bossIsActive ? 1 : t) * 100}%`;
    }

    this._enemiesDefeated.textContent = r.enemiesDefeated;

    for (const [key, amt] of Object.entries(state.currencies)) {
      if (this._amtEls[key]) {
        this._amtEls[key].textContent = this._formatNum(amt);
      }
    }
  }

  _updateCurrencyDisplay(type, total) {
    if (this._amtEls[type]) {
      this._amtEls[type].textContent = this._formatNum(total);
    }
  }

  _formatNum(n) {
    const v = Math.floor(n);
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toString();
  }
}
