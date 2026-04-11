import { CURRENCIES } from '../constants.js';

export class RoundTransition {
  constructor() {
    this._el = document.getElementById('round-transition');
    this._roundEl = document.getElementById('transition-round');
    this._lootEl = document.getElementById('transition-loot');
  }

  show(round, loot, onComplete) {
    this._roundEl.textContent = round;
    this._lootEl.innerHTML = '';

    // Build loot display
    for (const [type, amount] of Object.entries(loot)) {
      if (amount <= 0) continue;
      const meta = CURRENCIES[type];
      if (!meta) continue;
      const item = document.createElement('div');
      item.className = 'loot-item';
      item.innerHTML = `<span style="color:${meta.color}">${meta.icon} ${meta.label}: +${Math.floor(amount)}</span>`;
      this._lootEl.appendChild(item);
    }

    if (Object.keys(loot).length === 0) {
      const item = document.createElement('div');
      item.className = 'loot-item';
      item.textContent = 'No loot this round';
      this._lootEl.appendChild(item);
    }

    this._el.classList.remove('hidden');

    setTimeout(() => {
      this._el.classList.add('hidden');
      if (onComplete) onComplete();
    }, 2500);
  }

  hide() {
    this._el.classList.add('hidden');
  }
}
