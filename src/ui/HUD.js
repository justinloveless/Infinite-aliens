import { eventBus, EVENTS } from '../core/EventBus.js';
import { CURRENCIES } from '../constants.js';

export class HUD {
  constructor() {
    this._hpBar = document.getElementById('hp-bar');
    this._shieldBar = document.getElementById('shield-bar');
    this._roundNum = document.getElementById('round-number');
    this._enemiesDefeated = document.getElementById('enemies-defeated');
    this._enemiesRequired = document.getElementById('enemies-required');
    this._amtEls = {};

    for (const key of Object.keys(CURRENCIES)) {
      this._amtEls[key] = document.getElementById(`amt-${key}`);
    }

    this._subscribeEvents();
  }

  _subscribeEvents() {
    eventBus.on(EVENTS.CURRENCY_CHANGED, ({ type, total }) => {
      this._updateCurrencyDisplay(type, total);
    });
    eventBus.on(EVENTS.ROUND_STARTED, ({ round }) => {
      this._roundNum.textContent = round;
    });
  }

  show() { document.getElementById('hud').classList.remove('hidden'); }
  hide() { document.getElementById('hud').classList.add('hidden'); }

  update(state, computed) {
    if (!state) return;
    const p = state.player;

    // HP bar
    const hpPct = computed
      ? (p.hp / computed.maxHp) * 100
      : (p.hp / p.maxHp) * 100;
    this._hpBar.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;

    // Change color based on HP
    if (hpPct > 50) {
      this._hpBar.style.background = 'linear-gradient(90deg, #39ff14, #00f5ff)';
    } else if (hpPct > 25) {
      this._hpBar.style.background = 'linear-gradient(90deg, #ffaa00, #ff6600)';
    } else {
      this._hpBar.style.background = 'linear-gradient(90deg, #ff2200, #ff0055)';
    }

    // Shield bar
    if (computed && computed.maxShieldHp > 0) {
      const shieldPct = (p.shieldHp / computed.maxShieldHp) * 100;
      this._shieldBar.style.width = `${Math.max(0, Math.min(100, shieldPct))}%`;
      document.getElementById('shield-container').style.display = '';
    } else {
      document.getElementById('shield-container').style.display = 'none';
    }

    // Round info
    this._roundNum.textContent = state.round.current;
    this._enemiesDefeated.textContent = state.round.enemiesDefeated;
    this._enemiesRequired.textContent = state.round.enemiesRequired;

    // Currencies
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
