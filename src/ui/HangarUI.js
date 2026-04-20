import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';
import {
  buildShipHull, buildItemMarker, buildSlotIndicator,
} from '../scene/ShipMeshFactory.js';
import {
  listAllSlots, isSlotUnlocked, getSlotUnlockCost,
  unlockSlot, getItem, installItem, getNodeTemplate,
  listShips, isShipOwned, getShipUnlockCost,
  purchaseShip, selectShip,
} from '../hangar/HangarSystem.js';
import { getActiveShipDef, getShipBasePlayerValues } from '../data/ships.js';
import { PLAYER } from '../constants.js';
import { applySlotPanelLayout } from './shipSlotPanelLayout.js';

/**
 * Full-screen Hangar: 3D rotatable ship preview with slot wireframes,
 * edge info panels connected to each slot by tracking SVG lines, and
 * stat-bar preview comparing current vs. hypothetical config.
 *
 * Opens between runs (replaces death-screen flow via HANGAR button).
 * Does not own its own game state — everything is driven off the shared
 * state object + UpgradeApplier.preview().
 */
export class HangarUI {
  constructor({ state, currency, upgradeApplier, techTree, onLaunch, onOpenStore, onOpenResearch, onOpenTechTree, onClose }) {
    this.state = state;
    this.currency = currency;
    this.upgradeApplier = upgradeApplier;
    this.techTree = techTree;
    this.onLaunch = onLaunch;
    this.onOpenStore = onOpenStore;
    this.onOpenResearch = onOpenResearch;
    this.onOpenTechTree = onOpenTechTree;
    this.onClose = onClose;

    this._isOpen = false;
    this._raf = 0;
    this._last = 0;
    this._yaw = 0;
    this._pitch = 0.25;
    this._autoRotate = true;
    this._idleTimer = 0;        // seconds since last manual rotate/zoom
    this._idleResumeAfter = 2.5; // seconds before auto-rotate resumes
    this._zoom = 6.5;           // camera z-distance; clamped to [min, max]
    this._zoomMin = 3.0;
    this._zoomMax = 12.0;
    this._selectedSlotId = null;
    this._pendingShipState = null; // used for preview bars

    this._root = document.getElementById('hangar-screen');
    this._canvas = document.getElementById('hangar-canvas');
    this._svg = document.getElementById('hangar-svg');
    this._slotsContainer = document.getElementById('hangar-slot-panels');
    this._statsContainer = document.getElementById('hangar-stats');
    this._actionBar = document.getElementById('hangar-actions');
    this._shipSelectorContainer = document.getElementById('hangar-ship-selector');

    /** Index into `listShips()` currently shown on the selector card. */
    this._browseIndex = 0;

    this._initThree();
    this._initDrag();
    this._initButtons();
    this._onHangarKeyDown = (e) => {
      if (!this._isOpen || e.repeat) return;
      if (this._isTypingTarget(e.target)) return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this._browseShipRelative(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this._browseShipRelative(1);
      }
    };

    this._unsubs = [
      eventBus.on(EVENTS.UPGRADE_PURCHASED, () => this._isOpen && this._rebuildAll()),
      eventBus.on(EVENTS.UPGRADE_SOLD, () => this._isOpen && this._rebuildAll()),
      eventBus.on(EVENTS.CURRENCY_CHANGED, () => this._isOpen && this._renderCurrencies()),
      eventBus.on(EVENTS.STATS_UPDATED, () => this._isOpen && this._renderStats()),
    ];
  }

  isOpen() { return this._isOpen; }

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._root.classList.remove('hidden');
    const ships = listShips();
    const selectedIdx = ships.findIndex(s => s.id === this.state.ships?.selectedId);
    if (selectedIdx >= 0) this._browseIndex = selectedIdx;
    this._rebuildAll();
    this._last = performance.now();
    this._tick();
    window.addEventListener('resize', this._onResizeBound ||= () => this._resize());
    window.addEventListener('keydown', this._onHangarKeyDown);
    this._resize();
  }

  _isTypingTarget(el) {
    return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
  }

  /** Move carousel; owned ships auto-equip inside `_renderShipSelector`. */
  _browseShipRelative(delta) {
    const ships = listShips();
    if (!ships.length) return;
    this._browseIndex = (this._browseIndex + delta + ships.length) % ships.length;
    this._renderShipSelector();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._root.classList.add('hidden');
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    window.removeEventListener('resize', this._onResizeBound);
    window.removeEventListener('keydown', this._onHangarKeyDown);
    if (this.onClose) this.onClose();
  }

  destroy() {
    this.close();
    for (const u of this._unsubs) u();
    this._unsubs = [];
    this._renderer?.dispose?.();
  }

  // ─── Three.js setup ─────────────────────────────────────────────────────

  _initThree() {
    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas, antialias: true, alpha: true,
    });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this._scene = new THREE.Scene();
    this._scene.background = null;

    const hemi = new THREE.HemisphereLight(0xaaccff, 0x221133, 0.65);
    this._scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 5, 2);
    this._scene.add(key);
    const fill = new THREE.DirectionalLight(0xff66ff, 0.4);
    fill.position.set(-3, -1, -2);
    this._scene.add(fill);

    this._camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    this._camera.position.set(0, 0, 6.5);
    this._camera.lookAt(0, 0, 0);

    this._shipPivot = new THREE.Group();
    this._scene.add(this._shipPivot);

    this._buildPreviewShip();

    this._slotMeshes = new Map(); // slotId -> { indicator, marker, worldPos }
  }

  /** (Re)build the preview hull + slot container to match the selected ship. */
  _buildPreviewShip() {
    if (this._ship) {
      this._shipPivot.remove(this._ship);
      this._disposeObject3D(this._ship);
      this._ship = null;
    }
    const variant = getActiveShipDef(this.state)?.meshVariant || 'allrounder';
    this._ship = buildShipHull({ variant, withLights: false });
    this._shipPivot.add(this._ship);

    this._slotNode = new THREE.Group();
    this._ship.add(this._slotNode);
  }

  _disposeObject3D(obj) {
    obj.traverse?.(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }

  _resize() {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    if (this._svg) {
      this._svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this._svg.style.width = `${w}px`;
      this._svg.style.height = `${h}px`;
    }
  }

  _initDrag() {
    if (!this._canvas) return;
    let dragging = false;
    let lastX = 0, lastY = 0;
    this._canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      this._autoRotate = false;
      this._idleTimer = 0;
      lastX = e.clientX; lastY = e.clientY;
      this._canvas.setPointerCapture(e.pointerId);
    });
    this._canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this._yaw += dx * 0.008;
      this._pitch = Math.max(-1.0, Math.min(1.0, this._pitch + dy * 0.006));
      this._idleTimer = 0;
    });
    const endDrag = (e) => {
      dragging = false;
      this._idleTimer = 0;
      try { this._canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    this._canvas.addEventListener('pointerup', endDrag);
    this._canvas.addEventListener('pointercancel', endDrag);

    // Mousewheel zoom. Prevent page scroll; resets idle timer so the ship
    // stays still while the user inspects, then auto-rotation resumes.
    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.001);
      this._zoom = Math.max(this._zoomMin, Math.min(this._zoomMax, this._zoom * factor));
      this._autoRotate = false;
      this._idleTimer = 0;
    }, { passive: false });
  }

  _initButtons() {
    document.getElementById('hangar-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('hangar-store-btn')?.addEventListener('click', () => this.onOpenStore?.());
    document.getElementById('hangar-research-btn')?.addEventListener('click', () => this.onOpenResearch?.());
    document.getElementById('hangar-techtree-btn')?.addEventListener('click', () => this.onOpenTechTree?.());
    document.getElementById('hangar-launch-btn')?.addEventListener('click', () => this.onLaunch?.());
  }

  // ─── Rebuild logic ─────────────────────────────────────────────────────

  _rebuildAll() {
    this._buildSlotMeshes();
    this._buildSlotPanels();
    this._renderStats();
    this._renderCurrencies();
    this._renderShipSelector();
  }

  /** Called by main.js after SHIP_SELECTED → rebuild mesh + slot grids + stats. */
  onShipChanged() {
    this._pendingShipState = null;
    this._buildPreviewShip();
    if (this._isOpen) this._rebuildAll();
  }

  _buildSlotMeshes() {
    // Clear
    while (this._slotNode.children.length) {
      const c = this._slotNode.children[0];
      this._slotNode.remove(c);
      c.traverse?.(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    }
    this._slotMeshes.clear();

    // Render ALL slots (active + locked). Locked slots use a dimmer/pink
    // wireframe so they read as "upgrade me" targets.
    for (const slot of listAllSlots(this.state)) {
      const group = new THREE.Group();
      group.position.fromArray(slot.position);

      const unlocked = isSlotUnlocked(this.state, slot.id);
      const entry = this.state.ship.slots[slot.id];
      const itemId = unlocked ? entry?.installedItemId : null;
      const item = itemId ? getItem(itemId) : null;

      let color, opacity;
      if (!unlocked) { color = 0xff2d78; opacity = 0.55; }       // locked — pink
      else if (item) { color = 0x00f5ff; opacity = 0.35; }        // filled — cyan dim
      else           { color = 0x39ff14; opacity = 0.95; }        // empty — neon green

      const indicator = buildSlotIndicator(slot, { color, opacity });
      group.add(indicator);

      let marker = null;
      if (item) {
        marker = buildItemMarker(item, slot);
        group.add(marker);
      }

      this._slotNode.add(group);
      this._slotMeshes.set(slot.id, {
        group, indicator, marker, slot, unlocked,
        worldPos: new THREE.Vector3(),
      });
    }
  }

  _buildSlotPanels() {
    if (!this._slotsContainer) return;
    this._slotsContainer.innerHTML = '';

    const allSlots = listAllSlots(this.state);
    allSlots.forEach((slot, i) => {
      const unlocked = isSlotUnlocked(this.state, slot.id);
      const entry = this.state.ship.slots[slot.id];
      const item = (unlocked && entry?.installedItemId) ? getItem(entry.installedItemId) : null;

      const panel = document.createElement('div');
      panel.className = `hangar-slot-panel slot-${slot.type}${unlocked ? '' : ' slot-locked'}`;
      panel.dataset.slotId = slot.id;
      panel.innerHTML = this._slotPanelHtml(slot, item, unlocked);
      this._slotsContainer.appendChild(panel);

      this._positionPanelOnEdge(panel, i, allSlots.length, slot);
      this._wirePanelEvents(panel, slot, unlocked);
    });

    if (this._svg) {
      this._svg.innerHTML = '';
      for (const slot of allSlots) {
        const unlocked = isSlotUnlocked(this.state, slot.id);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', unlocked ? '#00f5ff' : '#ff2d78');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-opacity', unlocked ? '0.55' : '0.45');
        line.setAttribute('stroke-dasharray', '4,3');
        line.dataset.slotId = slot.id;
        this._svg.appendChild(line);
      }
    }
  }

  _slotPanelHtml(slot, item, unlocked) {
    const typeLabel = { weapon: 'WEAPON', defense: 'DEFENSE', utility: 'UTILITY' }[slot.type] || slot.type.toUpperCase();

    if (!unlocked) {
      const cost = getSlotUnlockCost(this.state, slot.id);
      const canAfford = Object.entries(cost).every(
        ([k, v]) => (this.state.currencies[k] || 0) >= v
      );
      const costPills = Object.entries(cost).map(([k, v]) => {
        const ok = (this.state.currencies[k] || 0) >= v;
        return `<span class="slot-cost-pill ${ok ? '' : 'afford-no'}">${this._currencyIcon(k)} ${v}</span>`;
      }).join('');
      return `
        <div class="slot-panel-head">
          <span class="slot-panel-label">${slot.label || typeLabel}</span>
          <span class="slot-panel-type">${typeLabel} · LOCKED</span>
        </div>
        <div class="slot-panel-body">
          <div class="slot-panel-desc">${slot.description || 'Locked hardpoint.'}</div>
          <div class="slot-panel-cost">${costPills}</div>
        </div>
        <div class="slot-panel-actions">
          <button class="neon-btn small slot-unlock-btn" ${canAfford ? '' : 'disabled'}>UNLOCK</button>
        </div>
      `;
    }

    if (!item) {
      return `
        <div class="slot-panel-head">
          <span class="slot-panel-label">${slot.label || typeLabel}</span>
          <span class="slot-panel-type">${typeLabel} · EMPTY</span>
        </div>
        <div class="slot-panel-body slot-panel-empty">No module installed</div>
        <div class="slot-panel-actions">
          <button class="neon-btn small slot-install-btn">INSTALL</button>
        </div>
      `;
    }
    const node = this._nodeForItem(item);
    const effectLine = this._describeNodeEffects(node, 1);
    return `
      <div class="slot-panel-head">
        <span class="slot-panel-label">${slot.label || typeLabel}</span>
        <span class="slot-panel-type">${typeLabel}</span>
      </div>
      <div class="slot-panel-body">
        <div class="slot-panel-item"><span class="slot-panel-icon" style="color:${item.color}">${item.icon || '◈'}</span>${item.name}</div>
        <div class="slot-panel-desc">${item.description || ''}</div>
        ${effectLine ? `<div class="slot-panel-effect">${effectLine}</div>` : ''}
      </div>
      <div class="slot-panel-actions">
        <button class="neon-btn small slot-swap-btn">SWAP</button>
        <button class="neon-btn small slot-uninstall-btn">UNINSTALL</button>
      </div>
    `;
  }

  _currencyIcon(key) {
    const map = {
      credits: { icon: '⬡', color: '#ffb347' },
      scrapMetal: { icon: '⚙', color: '#aaa' },
      plasmaCrystals: { icon: '◆', color: '#00f5ff' },
      bioEssence: { icon: '✦', color: '#39ff14' },
      darkMatter: { icon: '◉', color: '#9b30ff' },
      stellarDust: { icon: '★', color: '#ffd700' },
    };
    const cfg = map[key] || { icon: '?', color: '#fff' };
    return `<span style="color:${cfg.color}">${cfg.icon}</span>`;
  }

  _wirePanelEvents(panel, slot, unlocked) {
    if (!unlocked) {
      panel.querySelector('.slot-unlock-btn')?.addEventListener('click', () => {
        if (unlockSlot(this.state, this.currency, slot.id)) {
          this._rebuildAll();
        }
      });
      return;
    }
    panel.querySelector('.slot-install-btn')?.addEventListener('click', () => {
      this._selectedSlotId = slot.id;
      this.onOpenStore?.(slot.id);
    });
    panel.querySelector('.slot-swap-btn')?.addEventListener('click', () => {
      this._selectedSlotId = slot.id;
      this.onOpenStore?.(slot.id);
    });
    panel.querySelector('.slot-uninstall-btn')?.addEventListener('click', () => {
      installItem(this.state, slot.id, null);
      this._rebuildAll();
    });
  }

  _positionPanelOnEdge(panel, _idx, _total, slot) {
    applySlotPanelLayout(panel, slot?.panel);
  }

  _renderStats() {
    if (!this._statsContainer) return;
    // Current = stats for the live ship; Pending = stats if the pending swap were applied.
    const cur = this.upgradeApplier.preview(this.techTree, this.state.ship);
    const pending = this._pendingShipState
      ? this.upgradeApplier.preview(this.techTree, this._pendingShipState)
      : cur;

    const rows = [
      { label: 'Damage',  get: s => s.damage,    max: 300 },
      { label: 'Hull',    get: s => s.maxHp,     max: 800 },
      { label: 'Shield',  get: s => s.maxShieldHp, max: 300 },
      { label: 'Speed',   get: s => s.speed,     max: 15 },
      { label: 'Energy',  get: s => s.maxEnergy, max: 400 },
      { label: 'Magnet',  get: s => s.magnetRange, max: 30 },
    ];

    this._statsContainer.innerHTML = `
      <h3 class="hangar-stats-title">SHIP STATS</h3>
      ${rows.map(r => this._statBarHtml(r, cur, pending)).join('')}
      <div class="hangar-stats-sub">
        <div>Energy drain: <span>${this._fmt(cur.energyDrain)}/s</span></div>
        <div>Energy regen: <span>${this._fmt(cur.energyRegen)}/s</span></div>
        <div>Crit: <span>${(cur.critChance * 100).toFixed(0)}% × ${cur.critMultiplier.toFixed(1)}</span></div>
        <div>Weapons: <span>${[cur.hasAutoFire ? 'auto' : null, ...cur.extraWeapons].filter(Boolean).join(', ') || '—'}</span></div>
      </div>
    `;
  }

  _statBarHtml(row, cur, pending) {
    const a = row.get(cur);
    const b = pending ? row.get(pending) : a;
    const pctA = Math.max(0, Math.min(1, a / row.max));
    const pctB = Math.max(0, Math.min(1, b / row.max));
    const diff = b - a;
    const diffStr = Math.abs(diff) < 0.01 ? '' : (diff > 0 ? `+${this._fmt(diff)}` : `${this._fmt(diff)}`);
    const diffClass = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
    return `
      <div class="hangar-stat-row">
        <div class="hangar-stat-label">${row.label}</div>
        <div class="hangar-stat-bar">
          <div class="hangar-stat-fill" style="width:${(pctA * 100).toFixed(1)}%"></div>
          ${this._pendingShipState ? `<div class="hangar-stat-pending ${diffClass}" style="width:${(pctB * 100).toFixed(1)}%"></div>` : ''}
        </div>
        <div class="hangar-stat-value">${this._fmt(a)}<span class="hangar-stat-diff ${diffClass}">${diffStr}</span></div>
      </div>
    `;
  }

  // ─── Ship selector carousel ────────────────────────────────────────────

  _renderShipSelector() {
    const container = this._shipSelectorContainer;
    if (!container) return;

    const ships = listShips();
    if (!ships.length) { container.innerHTML = ''; return; }

    const selectedId = this.state.ships?.selectedId;
    const selectedIdx = ships.findIndex(s => s.id === selectedId);
    if (this._browseIndex < 0 || this._browseIndex >= ships.length) {
      this._browseIndex = Math.max(0, selectedIdx);
    }

    const def = ships[this._browseIndex];
    // Browsing to an owned ship equips it; rebuild runs via SHIP_SELECTED → onShipChanged.
    if (def && isShipOwned(this.state, def.id) && def.id !== this.state.ships?.selectedId) {
      selectShip(this.state, def.id);
      return;
    }

    const isSelected = def.id === selectedId;
    const owned = isShipOwned(this.state, def.id);
    const cost = getShipUnlockCost(def.id);
    const canAfford = Object.keys(cost).length === 0 || Object.entries(cost).every(
      ([k, v]) => (this.state.currencies[k] || 0) >= v
    );

    const costPills = Object.entries(cost).map(([k, v]) => {
      const ok = (this.state.currencies[k] || 0) >= v;
      return `<span class="slot-cost-pill ${ok ? '' : 'afford-no'}">${this._currencyIcon(k)} ${v}</span>`;
    }).join('');

    const statRows = this._shipStatPreviewRows(def).map(r => `
      <div class="ship-stat-row">
        <span class="ship-stat-label">${r.label}</span>
        <span class="ship-stat-value">${r.value}</span>
      </div>
    `).join('');

    let actionHtml = '';
    let statusLabel;
    if (isSelected) {
      statusLabel = 'EQUIPPED';
      actionHtml = `<button class="neon-btn small" disabled>EQUIPPED</button>`;
    } else if (owned) {
      statusLabel = 'OWNED';
      actionHtml = '';
    } else {
      statusLabel = 'LOCKED';
      actionHtml = `
        ${costPills ? `<div class="ship-cost">${costPills}</div>` : ''}
        <button class="neon-btn small ship-buy-btn" ${canAfford ? '' : 'disabled'}>BUY</button>
      `;
    }

    container.innerHTML = `
      <div class="ship-selector-card">
        <div class="ship-selector-nav">
          <button class="neon-btn small ship-prev-btn" aria-label="Previous ship">◀</button>
          <div class="ship-selector-title">
            <div class="ship-selector-name">${def.name}</div>
            <div class="ship-selector-status status-${statusLabel.toLowerCase()}">${statusLabel}</div>
          </div>
          <button class="neon-btn small ship-next-btn" aria-label="Next ship">▶</button>
        </div>
        <div class="ship-selector-desc">${def.description || ''}</div>
        <div class="ship-selector-stats">${statRows}</div>
        <div class="ship-selector-actions">${actionHtml}</div>
        <div class="ship-selector-pager">${ships.map((s, i) =>
          `<span class="ship-pager-dot${i === this._browseIndex ? ' active' : ''}${s.id === selectedId ? ' equipped' : ''}"></span>`
        ).join('')}</div>
      </div>
    `;

    container.querySelector('.ship-prev-btn')?.addEventListener('click', () => {
      this._browseShipRelative(-1);
    });
    container.querySelector('.ship-next-btn')?.addEventListener('click', () => {
      this._browseShipRelative(1);
    });
    container.querySelector('.ship-buy-btn')?.addEventListener('click', () => {
      if (purchaseShip(this.state, this.currency, def.id)) {
        selectShip(this.state, def.id);
        this._renderCurrencies();
      }
    });
  }

  /** Summarize a ship's base player stats for the preview card. */
  _shipStatPreviewRows(def) {
    const base = getShipBasePlayerValues(def);
    return [
      { label: 'Hull',   value: this._fmt(base.maxHp ?? PLAYER.BASE_HP) },
      { label: 'Damage', value: this._fmt(base.damage ?? PLAYER.BASE_DAMAGE) },
      { label: 'Speed',  value: this._fmt(base.speed ?? PLAYER.BASE_SPEED) },
      { label: 'Fire Rate', value: `${this._fmt(base.attackSpeed ?? PLAYER.BASE_ATTACK_SPEED)}/s` },
      { label: 'Armor',  value: this._fmt(base.armor ?? 0) },
    ];
  }

  _renderCurrencies() {
    const container = document.getElementById('hangar-currencies');
    if (!container) return;
    const c = this.state.currencies;
    container.innerHTML = `
      <span class="hangar-cur"><span style="color:#ffb347">⬡</span> ${Math.floor(c.credits || 0)}</span>
      <span class="hangar-cur"><span style="color:#aaa">⚙</span> ${Math.floor(c.scrapMetal)}</span>
      <span class="hangar-cur"><span style="color:#00f5ff">◆</span> ${Math.floor(c.plasmaCrystals)}</span>
      <span class="hangar-cur"><span style="color:#39ff14">✦</span> ${Math.floor(c.bioEssence)}</span>
      <span class="hangar-cur"><span style="color:#9b30ff">◉</span> ${Math.floor(c.darkMatter)}</span>
      <span class="hangar-cur"><span style="color:#ffd700">★</span> ${Math.floor(c.stellarDust)}</span>
    `;
  }

  // ─── Frame loop ────────────────────────────────────────────────────────

  _tick() {
    this._raf = requestAnimationFrame(() => this._tick());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;

    // Auto-rotation resumes after the user has been idle for a bit.
    if (!this._autoRotate) {
      this._idleTimer += dt;
      if (this._idleTimer >= this._idleResumeAfter) this._autoRotate = true;
    }
    if (this._autoRotate) this._yaw += dt * 0.35;
    this._shipPivot.rotation.x = this._pitch;
    this._shipPivot.rotation.y = this._yaw;

    // Smoothly interpolate camera z toward the target zoom distance.
    const camZ = this._camera.position.z;
    this._camera.position.z = camZ + (this._zoom - camZ) * Math.min(1, dt * 8);
    this._camera.lookAt(0, 0, 0);

    // Pulse empty slot indicators
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.004);
    for (const { indicator, marker } of this._slotMeshes.values()) {
      if (marker) continue;
      indicator.traverse(o => {
        if (o.material?.opacity !== undefined) o.material.opacity = 0.3 + pulse * 0.7;
      });
    }

    this._renderer.render(this._scene, this._camera);
    this._updateTrackingLines();
  }

  _updateTrackingLines() {
    if (!this._svg) return;
    const rect = this._canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const v = new THREE.Vector3();
    for (const [slotId, data] of this._slotMeshes) {
      data.group.getWorldPosition(v);
      v.project(this._camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      const line = this._svg.querySelector(`line[data-slot-id="${slotId}"]`);
      if (!line) continue;
      const panel = this._slotsContainer?.querySelector(`[data-slot-id="${slotId}"]`);
      if (!panel) continue;
      const panelRect = panel.getBoundingClientRect();
      const svgRect = this._svg.getBoundingClientRect();
      const px = panelRect.left + panelRect.width / 2 - svgRect.left;
      const py = panelRect.top + panelRect.height / 2 - svgRect.top;
      line.setAttribute('x1', px.toFixed(1));
      line.setAttribute('y1', py.toFixed(1));
      line.setAttribute('x2', sx.toFixed(1));
      line.setAttribute('y2', sy.toFixed(1));
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  _nodeForItem(item) {
    return item?.grantsNodeId ? getNodeTemplate(item.grantsNodeId) : null;
  }

  _describeNodeEffects(node, _level) {
    if (!node?.effects?.length) return '';
    const parts = [];
    for (const e of node.effects) {
      if (e.condition) continue;
      switch (e.type) {
        case 'multiply': {
          const pct = ((e.value - 1) * 100).toFixed(0);
          parts.push(`+${pct}% ${e.statLabel || e.stat}`);
          break;
        }
        case 'add':
          parts.push(`+${e.value} ${e.statLabel || e.stat}`);
          break;
        case 'add_weapon':
          parts.push(`${e.statLabel || e.value} weapon`);
          break;
        case 'special':
        case 'set':
          parts.push(e.specialDesc || `${e.statLabel || e.stat}`);
          break;
      }
    }
    return parts.join(' · ');
  }

  _fmt(n) {
    if (n === undefined || n === null || Number.isNaN(n)) return '—';
    if (Math.abs(n) >= 100) return Math.round(n).toString();
    if (Math.abs(n) >= 10) return n.toFixed(1);
    return n.toFixed(2);
  }
}
