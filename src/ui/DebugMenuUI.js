import { CURRENCIES } from '../constants.js';

const CURRENCY_KEYS = Object.keys(CURRENCIES);

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
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (!this._built) this._build();
    this._syncInputs();
    this._panel.classList.remove('hidden');
  }

  close() {
    this._panel.classList.add('hidden');
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
  }

  _build() {
    this._built = true;
    this._panel.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.id = 'debug-menu-panel';
    this._panel.appendChild(wrap);

    const header = document.createElement('div');
    header.className = 'debug-menu-header';
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
      'Ctrl+Shift+D to toggle. Enter an amount to add per resource (negative subtracts).';
    wrap.appendChild(hint);

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
  }
}
