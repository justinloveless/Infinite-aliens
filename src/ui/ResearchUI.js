import { eventBus, EVENTS } from '../core/EventBus.js';
import {
  getResearchCatalog, getResearchLevel, canPurchaseResearch, purchaseResearch,
  sellResearchLevel, getRequiredItem, hasItemInstalled, getItem,
  getResearchMasteryLevel, purchaseResearchMastery, getResearchMasteryCost,
} from '../hangar/HangarSystem.js';

const CURRENCY_ICONS = {
  credits: { icon: '⬡', color: '#ffb347' },
  scrapMetal: { icon: '⚙', color: '#aaa' },
  plasmaCrystals: { icon: '◆', color: '#00f5ff' },
  bioEssence: { icon: '✦', color: '#39ff14' },
  darkMatter: { icon: '◉', color: '#9b30ff' },
  stellarDust: { icon: '★', color: '#ffd700' },
};

export class ResearchUI {
  constructor({ state, currency, onClose }) {
    this.state = state;
    this.currency = currency;
    this.onClose = onClose;
    this._isOpen = false;

    this._root = document.getElementById('research-screen');
    this._body = document.getElementById('research-body');
    this._currencies = document.getElementById('research-currencies');
    this._filterInput = document.getElementById('research-filter');
    this._filterCat = document.getElementById('research-filter-cat');
    this._filterState = document.getElementById('research-filter-state');

    this._filter = { q: '', cat: 'all', state: 'available' };
    this._filterState.value = this._filter.state;

    document.getElementById('research-close-btn')?.addEventListener('click', () => this.close());
    this._filterInput.addEventListener('input', (e) => { this._filter.q = e.target.value.toLowerCase(); this._renderList(); });
    this._filterCat.addEventListener('change', (e) => { this._filter.cat = e.target.value; this._renderList(); });
    this._filterState.addEventListener('change', (e) => { this._filter.state = e.target.value; this._renderList(); });

    this._unsubs = [
      eventBus.on(EVENTS.CURRENCY_CHANGED, () => this._isOpen && this._renderCurrencies()),
      eventBus.on(EVENTS.UPGRADE_PURCHASED, () => this._isOpen && this._renderList()),
      eventBus.on(EVENTS.UPGRADE_SOLD, () => this._isOpen && this._renderList()),
      eventBus.on(EVENTS.MASTERY_PURCHASED, () => this._isOpen && this._renderList()),
    ];
  }

  isOpen() { return this._isOpen; }

  open() {
    this._isOpen = true;
    this._root.classList.remove('hidden');
    this._renderCurrencies();
    this._renderList();
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

  _renderCurrencies() {
    if (!this._currencies) return;
    const c = this.state.currencies;
    this._currencies.innerHTML = Object.entries(CURRENCY_ICONS).map(([k, cfg]) => {
      return `<span><span style="color:${cfg.color}">${cfg.icon}</span> ${Math.floor(c[k] || 0)}</span>`;
    }).join('');
  }

  _renderList() {
    if (!this._body) return;
    const q = this._filter.q;
    const cat = this._filter.cat;
    const state = this._filter.state;

    const nodes = getResearchCatalog().filter(n => {
      if (cat !== 'all' && n.category !== cat) return false;
      if (q && !(n.name?.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q))) return false;
      const level = getResearchLevel(this.state, n.id);
      const owned = level > 0;
      const requiredItem = getRequiredItem(n);
      const itemOk = !requiredItem || hasItemInstalled(this.state, requiredItem);
      const available = canPurchaseResearch(this.state, n.id) && itemOk;
      if (state === 'owned' && !owned) return false;
      if (state === 'available' && !available) return false;
      if (state === 'locked' && (available || owned)) return false;
      return true;
    });

    const html = `
      <div class="research-grid">
        ${nodes.map(n => this._cardHtml(n)).join('')}
      </div>
      ${nodes.length === 0 ? '<div style="color:rgba(255,255,255,0.4);text-align:center;padding:40px">No matching upgrades.</div>' : ''}
    `;
    this._body.innerHTML = html;
    this._wire();
  }

  _cardHtml(node) {
    const level = getResearchLevel(this.state, node.id);
    const maxLevel = node.maxLevel ?? 1;
    const owned = level > 0;
    const maxed = level >= maxLevel;
    const masteryLevel = maxed ? getResearchMasteryLevel(this.state, node.id) : 0;
    const requiredItem = getRequiredItem(node);
    const itemInstalled = !requiredItem || hasItemInstalled(this.state, requiredItem);
    const prereqOk = canPurchaseResearch(this.state, node.id) && itemInstalled;
    const cost = this._costFor(node, level);
    const afford = this.currency.canAfford(cost);

    const costPills = Object.entries(cost).map(([k, v]) => {
      const cfg = CURRENCY_ICONS[k] || { icon: '?', color: '#fff' };
      const ok = (this.state.currencies[k] ?? 0) >= v;
      return `<span class="cost-pill ${ok ? '' : 'afford-no'}"><span style="color:${cfg.color}">${cfg.icon}</span> ${v}</span>`;
    }).join('');

    let stateTag = '';
    if (maxed && masteryLevel > 0) {
      stateTag = `<span class="research-card-tag mastery">★ MASTERY LV ${masteryLevel}</span>`;
    } else if (maxed) {
      stateTag = '<span class="research-card-tag">MAXED</span>';
    } else if (owned) {
      stateTag = `<span class="research-card-level">LV ${level}/${maxLevel}</span>`;
    }

    let reqTag = '';
    if (requiredItem && !itemInstalled) {
      const reqItem = getItem(requiredItem);
      reqTag = `<div class="research-card-req">Requires: ${reqItem?.name || requiredItem}</div>`;
    }

    const cls = [
      owned ? 'owned' : '',
      !prereqOk ? 'locked' : '',
    ].filter(Boolean).join(' ');

    const masteryCost = maxed ? getResearchMasteryCost(node, masteryLevel) : null;
    const masteryAfford = masteryCost ? this.currency.canAfford(masteryCost) : false;
    const masteryCostPills = masteryCost ? Object.entries(masteryCost).map(([k, v]) => {
      const cfg = CURRENCY_ICONS[k] || { icon: '?', color: '#fff' };
      const ok = (this.state.currencies[k] ?? 0) >= v;
      return `<span class="cost-pill ${ok ? '' : 'afford-no'}"><span style="color:${cfg.color}">${cfg.icon}</span> ${v}</span>`;
    }).join('') : '';

    const btns = [];
    if (!maxed) {
      btns.push(`<button class="neon-btn small research-buy-btn" data-id="${node.id}" ${prereqOk && afford ? '' : 'disabled'}>RESEARCH</button>`);
    }
    if (maxed) {
      btns.push(`<button class="neon-btn small mastery-btn research-mastery-btn" data-id="${node.id}" ${masteryAfford ? '' : 'disabled'}>★ MASTERY</button>`);
    }
    if (owned) {
      btns.push(`<button class="neon-btn small research-sell-btn" data-id="${node.id}">SELL LV</button>`);
    }

    return `
      <div class="research-card ${cls}">
        <div class="research-card-head">
          <span class="research-card-name">${node.icon || '•'} ${node.name}</span>
          <span class="research-card-cat">${node.category.toUpperCase()}</span>
        </div>
        <div class="research-card-desc">${node.description || ''}</div>
        ${reqTag}
        <div class="research-card-cost">${maxed ? masteryCostPills : costPills}</div>
        <div class="research-card-actions">
          ${btns.join(' ')}
          ${stateTag}
        </div>
      </div>
    `;
  }

  _costFor(node, level) {
    const mult = Math.pow(1.4, level);
    const out = {};
    for (const [k, v] of Object.entries(node.baseCost || {})) out[k] = Math.ceil(v * mult);
    return out;
  }

  _wire() {
    this._body.querySelectorAll('.research-buy-btn').forEach(btn => {
      btn.onclick = () => purchaseResearch(this.state, this.currency, btn.dataset.id);
    });
    this._body.querySelectorAll('.research-sell-btn').forEach(btn => {
      btn.onclick = () => sellResearchLevel(this.state, this.currency, btn.dataset.id);
    });
    this._body.querySelectorAll('.research-mastery-btn').forEach(btn => {
      btn.onclick = () => purchaseResearchMastery(this.state, this.currency, btn.dataset.id);
    });
  }
}
