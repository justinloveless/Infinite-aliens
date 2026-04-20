import { eventBus, EVENTS } from '../core/EventBus.js';
import {
  getAllItems, getItem, buyItem, installItem, listActiveSlots, hasItemInstalled,
  listInstalledItems,
} from '../hangar/HangarSystem.js';

const CURRENCY_ICONS = {
  credits: { icon: '⬡', color: '#ffb347' },
  scrapMetal: { icon: '⚙', color: '#aaa' },
  plasmaCrystals: { icon: '◆', color: '#00f5ff' },
  bioEssence: { icon: '✦', color: '#39ff14' },
  darkMatter: { icon: '◉', color: '#9b30ff' },
  stellarDust: { icon: '★', color: '#ffd700' },
};

const SLOT_GROUPS = [
  { type: 'weapon', label: 'WEAPONS' },
  { type: 'defense', label: 'DEFENSE' },
  { type: 'utility', label: 'UTILITY' },
];

export class StoreUI {
  constructor({ state, currency, onClose }) {
    this.state = state;
    this.currency = currency;
    this.onClose = onClose;
    this._isOpen = false;
    this._targetSlotId = null;

    this._root = document.getElementById('store-screen');
    this._body = document.getElementById('store-body');
    this._currencies = document.getElementById('store-currencies');

    document.getElementById('store-close-btn')?.addEventListener('click', () => this.close());

    this._unsubs = [
      eventBus.on(EVENTS.CURRENCY_CHANGED, () => this._isOpen && this._renderCurrencies()),
      eventBus.on(EVENTS.UPGRADE_PURCHASED, () => this._isOpen && this._render()),
    ];
  }

  isOpen() { return this._isOpen; }

  /** @param {string|null} targetSlotId - if set, "install" buttons will default to this slot. */
  open(targetSlotId = null) {
    this._targetSlotId = targetSlotId;
    this._isOpen = true;
    this._root.classList.remove('hidden');
    this._render();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._root.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  destroy() {
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }

  _render() {
    this._renderCurrencies();
    const items = getAllItems();
    const activeSlots = listActiveSlots(this.state);
    const slotsByType = { weapon: [], defense: [], utility: [] };
    for (const s of activeSlots) slotsByType[s.type]?.push(s);

    const html = SLOT_GROUPS.map(group => {
      const groupItems = items.filter(i => i.slotType === group.type);
      if (!groupItems.length) return '';
      return `
        <section class="store-section">
          <h3 class="store-section-title">${group.label}</h3>
          <div class="store-grid">
            ${groupItems.map(item => this._cardHtml(item, slotsByType[group.type] || [])).join('')}
          </div>
        </section>
      `;
    }).join('');

    this._body.innerHTML = html;
    this._wire();
  }

  _cardHtml(item, slotsOfType) {
    const owned = this.state.ship.ownedItems.includes(item.id);
    const installed = hasItemInstalled(this.state, item.id);
    const installedSlot = installed
      ? listInstalledItems(this.state).find(({ item: it }) => it.id === item.id)?.slot
      : null;
    const installedWhere = installedSlot?.label || installedSlot?.id || '';
    const afford = this.currency.canAfford(item.cost || {});

    const costPills = Object.entries(item.cost || {}).map(([k, v]) => {
      const cfg = CURRENCY_ICONS[k] || { icon: '?', color: '#fff' };
      const ok = (this.state.currencies[k] ?? 0) >= v;
      return `<span class="cost-pill ${ok ? '' : 'afford-no'}"><span style="color:${cfg.color}">${cfg.icon}</span> ${v}</span>`;
    }).join('');

    let actions = '';
    if (installed) {
      const where = installedWhere ? ` — ${installedWhere}` : '';
      actions = `<span class="store-card-tag">INSTALLED${where}</span>`;
    } else if (owned) {
      actions = slotsOfType.map(s => {
        const isTarget = this._targetSlotId === s.id;
        return `<button class="neon-btn small store-install-btn${isTarget ? ' launch' : ''}" data-item="${item.id}" data-slot="${s.id}">INSTALL → ${s.label || s.id}</button>`;
      }).join('');
      if (!actions) actions = `<span class="store-card-tag">OWNED</span>`;
    } else {
      actions = `<button class="neon-btn small store-buy-btn" data-item="${item.id}" ${afford ? '' : 'disabled'}>BUY</button>`;
    }

    const cls = installed ? 'installed' : owned ? 'owned' : '';
    return `
      <div class="store-card ${cls}">
        <div class="store-card-head">
          <span class="store-card-name" style="color:${item.color || 'var(--cyan)'}">${item.icon || '◈'} ${item.name}</span>
          <span class="store-card-slot">${item.slotType.toUpperCase()}</span>
        </div>
        <div class="store-card-desc">${item.description || ''}</div>
        <div class="store-card-cost">${owned ? '' : costPills || '<span class="cost-pill">FREE</span>'}</div>
        <div class="store-card-actions">${actions}</div>
      </div>
    `;
  }

  _wire() {
    this._body.querySelectorAll('.store-buy-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.item;
        const item = getItem(id);
        if (!item) return;
        const ok = buyItem(this.state, this.currency, id);
        if (!ok) return;
        // If no target slot was specified, auto-install into the first compatible empty slot.
        if (!this._targetSlotId) {
          for (const slot of listActiveSlots(this.state)) {
            if (slot.type === item.slotType && !this.state.ship.slots[slot.id]?.installedItemId) {
              installItem(this.state, slot.id, id);
              break;
            }
          }
        } else {
          installItem(this.state, this._targetSlotId, id);
        }
      };
    });
    this._body.querySelectorAll('.store-install-btn').forEach(btn => {
      btn.onclick = () => {
        installItem(this.state, btn.dataset.slot, btn.dataset.item);
      };
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
