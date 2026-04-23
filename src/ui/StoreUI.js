import { eventBus, EVENTS } from '../core/EventBus.js';
import {
  getAllItems, getItem, buyItem, hasItemInstalled,
  getInventoryInstances,
} from '../hangar/HangarSystem.js';
import upgradesData from '../data/upgrades.json';
import {
  getStoreItemPreviewDataUrl,
  setStorePreviewHover,
  disposeAllStorePreviewHover,
} from './storeItemPreview.js';

const _nodeById = Object.fromEntries((upgradesData.nodes || []).map(n => [n.id, n]));

const _DRAIN_STATS = new Set(['hpDrain']);

const CURRENCY_ICONS = {
  credits:        { icon: '⬡', color: '#ffb347' },
  scrapMetal:     { icon: '⚙', color: '#aaa' },
  plasmaCrystals: { icon: '◆', color: '#00f5ff' },
  bioEssence:     { icon: '✦', color: '#39ff14' },
  darkMatter:     { icon: '◉', color: '#9b30ff' },
  stellarDust:    { icon: '★', color: '#ffd700' },
};

/** Store cooldown badges (seconds) — base values from UpgradeApplier / components. */
const _STORE_COOLDOWN_SEC = {
  emp: 25,
  warp_drive: 15,
  gravity_bomb: 30,
  decoy: 40,
  speed_booster: 20,
  phoenix_drive: 300,
};

function _energyDrainPerSecPill(eff) {
  const v = eff.value;
  const disp = Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
  const n = Math.abs(disp);
  let text;
  if (disp === 0) text = '0 ⚡/s';
  else if (disp > 0) text = `-${n} ⚡/s`;
  else text = `+${n} ⚡/s`;
  return `<span class="stat-pill stat-pill-energy-cost">${text}</span>`;
}

function _formatCooldownLabel(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const wholeMin = Math.round(s / 60);
  if (s >= 60 && Math.abs(s - wholeMin * 60) < 0.05) return `${wholeMin}m`;
  if (Number.isInteger(s)) return `${s}s`;
  return `${parseFloat(s.toFixed(1))}s`;
}

function _cooldownPill(seconds) {
  return `<span class="stat-pill stat-pill-cooldown">🕐 ${_formatCooldownLabel(seconds)}</span>`;
}

function _passiveCurrencyRatePill(eff) {
  let key = null;
  if (eff.stat === 'stellarDustRate') key = 'stellarDust';
  else if (eff.target === 'currency') {
    const m = String(eff.stat || '').match(/^passive\.(.+)$/);
    if (m && CURRENCY_ICONS[m[1]]) key = m[1];
  }
  if (!key) return null;
  const v = eff.value;
  const body = Math.abs(v) < 1e-9 ? '0' : String(+(Math.abs(v).toFixed(4)));
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const cfg = CURRENCY_ICONS[key];
  const neg = v < 0;
  const cls = neg ? 'stat-pill stat-pill-neg stat-pill-currency-rate' : 'stat-pill stat-pill-currency-rate';
  return `<span class="${cls}"><span style="color:${cfg.color}">${cfg.icon}</span> ${sign}${body}/s</span>`;
}

function _effectPills(nodeId) {
  const node = _nodeById[nodeId];
  if (!node?.effects?.length) return [];

  const pills = [];
  for (const eff of node.effects) {
    const label = eff.statLabel || '';
    let text = '';
    let negative = false;

    if ((eff.type === 'add' || eff.type === 'add_flat') && eff.stat === 'energyDrain') {
      pills.push(_energyDrainPerSecPill(eff));
      continue;
    }

    if (eff.type === 'add' || eff.type === 'add_flat') {
      const ratePill = _passiveCurrencyRatePill(eff);
      if (ratePill) {
        pills.push(ratePill);
        continue;
      }
      const isPct = ['critChance'].includes(eff.stat);
      const v = isPct ? eff.value * 100 : eff.value;
      const disp = Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
      const sign = v >= 0 ? '+' : '';
      const suffix = isPct ? '%' : '';
      text = label ? `${sign}${disp}${suffix} ${label}` : '';
      negative = _DRAIN_STATS.has(eff.stat) || v < 0;
    } else if (eff.type === 'multiply') {
      const pct = (eff.value - 1) * 100;
      const sign = pct >= 0 ? '+' : '';
      text = label ? `${sign}${parseFloat(pct.toFixed(0))}% ${label}` : '';
      negative = pct < 0 || _DRAIN_STATS.has(eff.stat);
    } else if (eff.type === 'add_weapon') {
      text = `Adds ${eff.statLabel || eff.value}`;
    } else if (eff.type === 'special') {
      text = eff.specialDesc || label;
    } else if (eff.type === 'toggle') {
      text = label;
    }

    if (text) {
      const cls = negative ? 'stat-pill stat-pill-neg' : 'stat-pill';
      pills.push(`<span class="${cls}">${text}</span>`);
    }
  }

  return pills;
}

function _storeCardStatsHtml(item) {
  const pills = _effectPills(item.grantsNodeId);
  if (item.energyCostPerShot != null) {
    const v = item.energyCostPerShot;
    const disp = Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
    pills.unshift(`<span class="stat-pill stat-pill-energy-cost">-${disp} ⚡/shot</span>`);
  }
  if (item.energyCostPerUse != null) {
    const v = item.energyCostPerUse;
    const disp = Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
    pills.unshift(`<span class="stat-pill stat-pill-energy-cost">-${disp} ⚡/use</span>`);
  }
  const cdSec = _STORE_COOLDOWN_SEC[item.grantsNodeId];
  if (cdSec != null) pills.unshift(_cooldownPill(cdSec));
  return pills.length ? `<div class="store-card-stats">${pills.join('')}</div>` : '';
}

const SLOT_GROUPS = [
  { type: 'weapon',  label: 'WEAPONS' },
  { type: 'defense', label: 'DEFENSE' },
  { type: 'utility', label: 'UTILITY' },
  { type: 'passive', label: 'PASSIVE' },
  { type: 'ability', label: 'ABILITIES' },
];

/** @type {readonly { id: string, label: string }[]} */
const _FILTER_CHIPS = [
  { id: 'all', label: 'ALL' },
  ...SLOT_GROUPS.map(g => ({ id: g.type, label: g.label })),
];


export class StoreUI {
  constructor({ state, currency, onClose }) {
    this.state = state;
    this.currency = currency;
    this.onClose = onClose;
    this._isOpen = false;
    /** @type {'all' | string} */
    this._filterType = 'all';
    /** @type {number | null} */
    this._previewRaf = null;

    this._root = document.getElementById('store-screen');
    this._body = document.getElementById('store-body');
    this._filters = document.getElementById('store-filters');
    this._currencies = document.getElementById('store-currencies');

    document.getElementById('store-close-btn')?.addEventListener('click', () => this.close());

    this._root?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-store-filter]');
      if (!btn || !this._isOpen) return;
      const next = btn.dataset.storeFilter;
      if (!next || next === this._filterType) return;
      this._filterType = next;
      this._render();
    });

    this._unsubs = [
      eventBus.on(EVENTS.CURRENCY_CHANGED, () => this._isOpen && this._renderCurrencies()),
      eventBus.on(EVENTS.UPGRADE_PURCHASED, () => this._isOpen && this._render()),
    ];
  }

  isOpen() { return this._isOpen; }

  open(_targetSlotId = null) {
    this._isOpen = true;
    this._filterType = 'all';
    this._root.classList.remove('hidden');
    this._render();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    disposeAllStorePreviewHover();
    this._root.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  destroy() {
    if (this._previewRaf != null) cancelAnimationFrame(this._previewRaf);
    this._previewRaf = null;
    disposeAllStorePreviewHover();
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  _render() {
    this._renderCurrencies();
    this._renderFilters();
    const items = getAllItems();

    const groups = this._filterType === 'all'
      ? SLOT_GROUPS
      : SLOT_GROUPS.filter(g => g.type === this._filterType);

    const html = groups.map(group => {
      const groupItems = items.filter(i => i.slotType === group.type);
      if (!groupItems.length) return '';
      return `
        <section class="store-section" data-store-section="${group.type}">
          <h3 class="store-section-title">${group.label}</h3>
          <div class="store-grid">
            ${groupItems.map(item => this._cardHtml(item)).join('')}
          </div>
        </section>
      `;
    }).join('');

    disposeAllStorePreviewHover();
    this._body.innerHTML = html;
    this._wire();
    this._schedulePreviewMounts();
  }

  _renderFilters() {
    if (!this._filters) return;
    const items = getAllItems();
    const counts = Object.fromEntries(
      SLOT_GROUPS.map(g => [g.type, items.filter(i => i.slotType === g.type).length]),
    );
    const chips = _FILTER_CHIPS.filter(
      c => c.id === 'all' || (counts[c.id] ?? 0) > 0,
    );
    this._filters.innerHTML = `
      <span class="store-filters-label">SHOW</span>
      <div class="store-filter-chips">
        ${chips.map((c) => {
          const active = c.id === this._filterType ? ' store-filter-btn-active' : '';
          const n = c.id === 'all' ? items.length : counts[c.id];
          const badge = `<span class="store-filter-count">${n}</span>`;
          return `<button type="button" class="store-filter-btn${active}" data-store-filter="${c.id}" role="tab" aria-selected="${c.id === this._filterType}">${c.label}${badge}</button>`;
        }).join('')}
      </div>
    `;
  }

  _schedulePreviewMounts() {
    if (this._previewRaf != null) {
      cancelAnimationFrame(this._previewRaf);
      this._previewRaf = null;
    }
    const cards = [...this._body.querySelectorAll('.store-card[data-item-id]')];
    let idx = 0;
    const step = () => {
      this._previewRaf = null;
      if (!this._isOpen || idx >= cards.length) return;
      const card = cards[idx++];
      const id = card.dataset.itemId;
      const host = card.querySelector('.store-card-preview');
      if (!host || !id) {
        this._previewRaf = requestAnimationFrame(step);
        return;
      }
      getStoreItemPreviewDataUrl(id).then((url) => {
        if (url && this._isOpen && host.isConnected) {
          host.innerHTML = `<img src="${url}" alt="" draggable="false" loading="lazy" />`;
        }
        this._previewRaf = requestAnimationFrame(step);
      }).catch(() => {
        this._previewRaf = requestAnimationFrame(step);
      });
    };
    this._previewRaf = requestAnimationFrame(step);
  }

  _cardHtml(item) {
    const ownedCount = getInventoryInstances(this.state).filter(i => i.itemId === item.id).length;
    const installed = hasItemInstalled(this.state, item.id);
    const afford = this.currency.canAfford(item.cost || {});

    const costPills = Object.entries(item.cost || {}).map(([k, v]) => {
      const cfg = CURRENCY_ICONS[k] || { icon: '?', color: '#fff' };
      const ok = (this.state.currencies[k] ?? 0) >= v;
      return `<span class="cost-pill ${ok ? '' : 'afford-no'}"><span style="color:${cfg.color}">${cfg.icon}</span> ${v}</span>`;
    }).join('');

    const ownedBadge = ownedCount > 0
      ? `<span class="store-count-badge">Owned ${ownedCount}</span>`
      : '';

    const statsHtml = _storeCardStatsHtml(item);
    const cls = installed ? 'installed' : ownedCount > 0 ? 'owned' : '';
    return `
      <div class="store-card ${cls}" data-item-id="${item.id}">
        <div class="store-card-head">
          <div class="store-card-title-block">
            <span class="store-card-name" style="color:${item.color || 'var(--cyan)'}">${item.icon || '◈'} ${item.name}</span>
            ${ownedBadge}
          </div>
          <span class="store-card-slot">${item.slotType.toUpperCase()}</span>
        </div>
        <div class="store-card-preview" aria-hidden="true"></div>
        <div class="store-card-desc">${item.description || ''}</div>
        ${statsHtml}
        <div class="store-card-actions">
          <div class="store-card-cost">${costPills || '<span class="cost-pill">FREE</span>'}</div>
          <button class="neon-btn small store-buy-btn" data-item="${item.id}" ${afford ? '' : 'disabled'}>BUY</button>
        </div>
      </div>
    `;
  }

  _wire() {
    this._body.querySelectorAll('.store-buy-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.item;
        if (!getItem(id)) return;
        buyItem(this.state, this.currency, id);
      };
    });

    this._body.querySelectorAll('.store-card[data-item-id]').forEach((card) => {
      const id = card.dataset.itemId;
      const prevHost = card.querySelector('.store-card-preview');
      if (!id || !prevHost) return;
      card.addEventListener('pointerenter', () => {
        if (this._isOpen) setStorePreviewHover(prevHost, id, true);
      });
      card.addEventListener('pointerleave', () => {
        setStorePreviewHover(prevHost, id, false);
      });
    });
  }

  _renderCurrencies() {
    if (!this._currencies) return;
    const c = this.state.currencies;
    this._currencies.innerHTML = Object.entries(CURRENCY_ICONS).map(([k, cfg]) => {
      return `<span><span style="color:${cfg.color}">${cfg.icon}</span> ${Math.floor(c[k] || 0)}</span>`;
    }).join('');
  }
}
