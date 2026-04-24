import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { buildShipHull, buildSlotIndicator } from '../scene/ShipMeshFactory.js';
import { createItemMesh } from '../scene/itemMeshes/index.js';
import { applySlotGroupTransform } from '../scene/slotGroupUtils.js';
import {
  listAllSlots, isSlotUnlocked, getSlotUnlockCost,
  unlockSlot, getItem, getSlot, installItem, getNodeTemplate,
  listShips, isShipOwned, getShipUnlockCost,
  purchaseShip, selectShip,
  getInstalledInstance, getInventoryInstances, getInstance,
  getUpgradesForItem, getInstanceUpgradeLevel,
  canPurchaseInstanceUpgrade, purchaseInstanceUpgrade, sellInstanceUpgrade,
} from '../hangar/HangarSystem.js';
import { getActiveShipDef, getShipBasePlayerValues } from '../data/ships.js';
import { PLAYER } from '../constants.js';
import { getHotkeyDigitForAbilityItem } from './abilityHotkeys.js';

export class HangarUI {
  constructor({ state, currency, upgradeApplier, onLaunch, onOpenStore, onClose, onGalaxyMap }) {
    this.state = state;
    this.currency = currency;
    this.upgradeApplier = upgradeApplier;
    this.onLaunch = onLaunch;
    this.onOpenStore = onOpenStore;
    this.onClose = onClose;
    this.onGalaxyMap = onGalaxyMap;

    this._isOpen = false;
    this._raf = 0;
    this._last = 0;
    this._yaw = 0;
    this._pitch = 0.25;
    this._autoRotate = true;
    this._idleTimer = 0;
    this._idleResumeAfter = 2.5;
    this._zoom = 6.5;
    this._zoomMin = 3.0;
    this._zoomMax = 12.0;
    this._selectedSlotId = null;
    this._selectedInstanceId = null;
    this._pendingShipState = null;
    this._installMode = null; // { source: 'slot'|'item', slotId?/instanceId?, slotType }

    this._root = document.getElementById('hangar-screen');
    this._canvas = document.getElementById('hangar-canvas');
    this._svg = document.getElementById('hangar-svg');
    this._slotsContainer = document.getElementById('hangar-slot-panels');
    this._statsContainer = document.getElementById('hangar-stat-bars');
    this._radarCanvas = document.getElementById('hangar-radar');
    this._actionBar = document.getElementById('hangar-actions');
    this._shipSelectorContainer = document.getElementById('hangar-ship-selector');
    this._upgradePanel = document.getElementById('hangar-upgrade-panel');

    this._browseIndex = 0;
    this._carouselIndex = 0;
    this._carouselSlotId = null;

    this._initThree();
    this._initDrag();
    this._initButtons();
    this._onHangarKeyDown = (e) => {
      if (!this._isOpen || e.repeat) return;
      if (this._isTypingTarget(e.target)) return;
      if (e.code === 'Escape' && this._installMode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this._exitInstallMode();
        return;
      }
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
    window.addEventListener('keydown', this._onHangarKeyDown, true);
    this._resize();
  }

  _isTypingTarget(el) {
    return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
  }

  _browseShipRelative(delta) {
    const ships = listShips();
    if (!ships.length) return;
    this._browseIndex = (this._browseIndex + delta + ships.length) % ships.length;
    this._renderShipSelector();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._resetHangarCanvasCursor();
    this._root.classList.add('hidden');
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    window.removeEventListener('resize', this._onResizeBound);
    window.removeEventListener('keydown', this._onHangarKeyDown, true);
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

    this._slotMeshes = new Map();
    this._raycaster = new THREE.Raycaster();
    this._raycaster.params.Line = { threshold: 0.08 };
    this._pickNdc = new THREE.Vector2();
  }

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
    let downX = 0, downY = 0;
    let dragMoved = false;
    const clickThresholdPx = 8;

    this._canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      dragMoved = false;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      this._autoRotate = false;
      this._idleTimer = 0;
      this._canvas.setPointerCapture(e.pointerId);
    });
    this._canvas.addEventListener('pointermove', (e) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > clickThresholdPx) dragMoved = true;
        this._yaw += dx * 0.008;
        this._pitch = Math.max(-1.0, Math.min(1.0, this._pitch + dy * 0.006));
        this._idleTimer = 0;
        this._canvas.style.cursor = 'grabbing';
        return;
      }
      if (this._isOpen) this._updateHangarCanvasHoverCursor(e.clientX, e.clientY);
    });
    this._canvas.addEventListener('pointerenter', (e) => {
      if (this._isOpen && !dragging) this._updateHangarCanvasHoverCursor(e.clientX, e.clientY);
    });
    this._canvas.addEventListener('pointerleave', () => {
      if (!dragging) this._resetHangarCanvasCursor();
    });
    const endDrag = (e) => {
      const isCancel = e.type === 'pointercancel';
      const wasClick = !isCancel && dragging && !dragMoved && e.button === 0;
      dragging = false;
      this._idleTimer = 0;
      try { this._canvas.releasePointerCapture(e.pointerId); } catch {}
      if (wasClick && this._isOpen) this._tryPickHangarSlotFromPointer(e);
      if (this._isOpen) this._updateHangarCanvasHoverCursor(e.clientX, e.clientY);
      else this._resetHangarCanvasCursor();
    };
    this._canvas.addEventListener('pointerup', endDrag);
    this._canvas.addEventListener('pointercancel', endDrag);

    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.001);
      this._zoom = Math.max(this._zoomMin, Math.min(this._zoomMax, this._zoom * factor));
      this._autoRotate = false;
      this._idleTimer = 0;
    }, { passive: false });
  }

  _raycastHangarSlotId(clientX, clientY) {
    if (!this._canvas || !this._camera || !this._slotMeshes?.size) return null;
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    this._pickNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pickNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pickNdc, this._camera);
    const roots = [...this._slotMeshes.values()].map(d => d.group);
    const hits = this._raycaster.intersectObjects(roots, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj) {
      if (obj.userData?.hangarSlotId) return obj.userData.hangarSlotId;
      obj = obj.parent;
    }
    return null;
  }

  _updateHangarCanvasHoverCursor(clientX, clientY) {
    if (!this._canvas || !this._isOpen) return;
    const slotId = this._raycastHangarSlotId(clientX, clientY);
    this._canvas.style.cursor = slotId ? 'pointer' : 'grab';
  }

  _resetHangarCanvasCursor() {
    if (this._canvas) this._canvas.style.cursor = '';
  }

  _tryPickHangarSlotFromPointer(e) {
    const slotId = this._raycastHangarSlotId(e.clientX, e.clientY);
    if (!slotId) return;
    const allSlots = listAllSlots(this.state);
    const idx = allSlots.findIndex(s => s.id === slotId);
    if (idx < 0) return;
    this._carouselIndex = idx;
    if (this._installMode?.source === 'slot') {
      const slot = getSlot(this.state, slotId);
      if (slot) this._installMode = { source: 'slot', slotId, slotType: slot.type };
    }
    this._buildSlotPanels();
    if (this._installMode?.source === 'slot') this._renderInventory();
  }

  _initButtons() {
    document.getElementById('hangar-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('hangar-store-btn')?.addEventListener('click', () => this.onOpenStore?.());
    document.getElementById('hangar-launch-btn')?.addEventListener('click', () => this.onLaunch?.());
    document.getElementById('hangar-map-btn')?.addEventListener('click', () => this.onGalaxyMap?.());
  }

  // ─── Rebuild logic ─────────────────────────────────────────────────────

  _rebuildAll() {
    this._buildSlotMeshes();
    this._buildSlotPanels();
    this._renderStats();
    this._renderCurrencies();
    this._renderShipSelector();
    this._renderInventory();
    // Refresh upgrade panel if it's open
    if (this._selectedInstanceId && this._upgradePanel && !this._upgradePanel.classList.contains('hidden')) {
      this._renderItemUpgradePanel(this._selectedInstanceId);
    }
  }

  onShipChanged() {
    this._pendingShipState = null;
    this._buildPreviewShip();
    if (this._isOpen) this._rebuildAll();
  }

  _buildSlotMeshes() {
    for (const [, data] of this._slotMeshes) {
      if (data?.itemMesh) data.itemMesh.dispose();
    }
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

    for (const slot of listAllSlots(this.state)) {
      const group = new THREE.Group();
      applySlotGroupTransform(group, slot);
      group.userData.hangarSlotId = slot.id;

      const unlocked = isSlotUnlocked(this.state, slot.id);
      const inst = unlocked ? getInstalledInstance(this.state, slot.id) : null;
      const item = inst ? getItem(inst.itemId) : null;

      let color, opacity;
      if (!unlocked) { color = 0xff2d78; opacity = 0.55; }
      else if (item)  { color = 0x00f5ff; opacity = 0.35; }
      else            { color = 0x39ff14; opacity = 0.95; }

      const indicator = buildSlotIndicator(slot, { color, opacity });
      group.add(indicator);

      let itemMesh = null;
      if (item) {
        itemMesh = createItemMesh(item, slot, { phase: 'hangar' });
        itemMesh.phase = 'hangar';
        group.add(itemMesh.root);
      }

      this._slotNode.add(group);
      this._slotMeshes.set(slot.id, {
        group, indicator, itemMesh, slot, unlocked,
        worldPos: new THREE.Vector3(),
      });
    }
  }

  _buildSlotPanels() {
    if (!this._slotsContainer) return;
    this._slotsContainer.innerHTML = '';

    const allSlots = listAllSlots(this.state);
    if (!allSlots.length) {
      this._carouselSlotId = null;
      if (this._svg) this._svg.innerHTML = '';
      return;
    }

    this._carouselIndex = Math.max(0, Math.min(this._carouselIndex, allSlots.length - 1));
    const n = allSlots.length;
    const slot = allSlots[this._carouselIndex];
    this._carouselSlotId = slot.id;

    const unlocked = isSlotUnlocked(this.state, slot.id);
    const inst = unlocked ? getInstalledInstance(this.state, slot.id) : null;
    const item = inst ? getItem(inst.itemId) : null;

    const carousel = document.createElement('div');
    carousel.className = 'slot-carousel';

    const header = document.createElement('div');
    header.className = 'slot-carousel-header';
    header.innerHTML = `
      <span class="slot-carousel-label">${slot.label || slot.type.toUpperCase()} <span class="slot-carousel-count">${this._carouselIndex + 1}/${allSlots.length}</span></span>
    `;
    carousel.appendChild(header);

    const row = document.createElement('div');
    row.className = 'slot-carousel-row';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'neon-btn slot-carousel-side-btn carousel-prev-btn';
    prevBtn.setAttribute('aria-label', 'Previous slot');
    prevBtn.textContent = '◀';
    prevBtn.addEventListener('click', () => {
      this._carouselIndex = (this._carouselIndex - 1 + n) % n;
      this._buildSlotPanels();
    });

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'neon-btn slot-carousel-side-btn carousel-next-btn';
    nextBtn.setAttribute('aria-label', 'Next slot');
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => {
      this._carouselIndex = (this._carouselIndex + 1) % n;
      this._buildSlotPanels();
    });

    const track = document.createElement('div');
    track.className = 'slot-carousel-track';

    const mode = this._installMode;
    const previewStats = this.upgradeApplier?.preview?.(this.state.ship) ?? null;

    if (n > 1) {
      const prevIdx = (this._carouselIndex - 1 + n) % n;
      track.appendChild(this._createSlotPeekEl(allSlots[prevIdx], prevIdx, previewStats));
    } else {
      const ph = document.createElement('div');
      ph.className = 'slot-carousel-peek-spacer';
      ph.setAttribute('aria-hidden', 'true');
      track.appendChild(ph);
    }

    let panelClass = `hangar-slot-panel slot-${slot.type}${unlocked ? '' : ' slot-locked'}`;
    if (mode?.source === 'item' && unlocked && mode.slotType === slot.type) panelClass += ' install-mode-target';
    else if (mode?.source === 'slot' && mode.slotId === slot.id) panelClass += ' install-mode-active';
    const panel = document.createElement('div');
    panel.className = panelClass;
    panel.dataset.slotId = slot.id;
    panel.innerHTML = this._slotPanelHtml(slot, item, unlocked, previewStats);
    this._wirePanelEvents(panel, slot, unlocked);

    const centerCol = document.createElement('div');
    centerCol.className = 'slot-carousel-center';
    centerCol.appendChild(panel);
    track.appendChild(centerCol);
    if (n > 1) {
      const nextIdx = (this._carouselIndex + 1) % n;
      track.appendChild(this._createSlotPeekEl(allSlots[nextIdx], nextIdx, previewStats));
    } else {
      const ph = document.createElement('div');
      ph.className = 'slot-carousel-peek-spacer';
      ph.setAttribute('aria-hidden', 'true');
      track.appendChild(ph);
    }

    row.appendChild(prevBtn);
    row.appendChild(track);
    row.appendChild(nextBtn);
    carousel.appendChild(row);

    this._slotsContainer.appendChild(carousel);

    if (this._svg) {
      this._svg.innerHTML = '';
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', unlocked ? '#00f5ff' : '#ff2d78');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-opacity', unlocked ? '0.7' : '0.5');
      line.setAttribute('stroke-dasharray', '4,3');
      line.dataset.slotId = slot.id;
      this._svg.appendChild(line);
    }
  }

  _createSlotPeekEl(slot, index, previewStats) {
    const unlocked = isSlotUnlocked(this.state, slot.id);
    const inst = unlocked ? getInstalledInstance(this.state, slot.id) : null;
    const item = inst ? getItem(inst.itemId) : null;
    const typeLabel = { weapon: 'WEAPON', defense: 'DEFENSE', utility: 'UTILITY', passive: 'PASSIVE', ability: 'ABILITY' }[slot.type] || slot.type.toUpperCase();
    const hk = slot.type === 'ability' && item && unlocked && previewStats
      ? getHotkeyDigitForAbilityItem(item, previewStats) : null;
    const hkHtml = hk != null ? `<span class="slot-peek-hotkey">${hk}</span>` : '';

    let statusHtml;
    if (!unlocked) statusHtml = '<span class="slot-peek-status locked">LOCKED</span>';
    else if (!item) statusHtml = '<span class="slot-peek-status empty">EMPTY</span>';
    else {
      statusHtml = `<span class="slot-peek-item"><span class="slot-peek-icon" style="color:${item.color || '#aaa'}">${item.icon || '◈'}</span><span class="slot-peek-name">${item.name}</span>${hkHtml}</span>`;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hangar-slot-peek slot-${slot.type}${unlocked ? '' : ' slot-locked'}`;
    btn.innerHTML = `
      <span class="slot-peek-type">${typeLabel}</span>
      <span class="slot-peek-label">${slot.label || typeLabel}</span>
      ${statusHtml}
    `;
    btn.addEventListener('click', () => {
      this._carouselIndex = index;
      this._buildSlotPanels();
    });
    return btn;
  }

  _slotPanelHtml(slot, item, unlocked, previewStats) {
    const typeLabel = { weapon: 'WEAPON', defense: 'DEFENSE', utility: 'UTILITY', passive: 'PASSIVE', ability: 'ABILITY' }[slot.type] || slot.type.toUpperCase();
    const mode = this._installMode;
    const abilityHotkey = slot.type === 'ability' && item && unlocked && previewStats
      ? getHotkeyDigitForAbilityItem(item, previewStats) : null;
    const hotkeyHtml = abilityHotkey != null
      ? `<span class="slot-ability-hotkey" title="Combat hotkey (loadout order)">${abilityHotkey}</span>`
      : '';

    // ── Install-from-item mode: this slot is a valid target ──────────────
    if (mode?.source === 'item' && unlocked && mode.slotType === slot.type) {
      const replaceHint = item
        ? `<div class="slot-panel-item"><span class="slot-panel-icon" style="color:${item.color}">${item.icon || '◈'}</span>${item.name} will be unequipped</div>`
        : `<div class="slot-panel-empty">Empty slot</div>`;
      return `
        <div class="slot-panel-head">
          <span class="slot-panel-label">${slot.label || typeLabel}${hotkeyHtml}</span>
          <span class="slot-panel-type install-label">${item ? 'REPLACE' : 'INSTALL HERE'}</span>
        </div>
        <div class="slot-panel-body">${replaceHint}</div>
        <div class="slot-panel-actions">
          <button class="neon-btn small slot-install-here-btn launch">INSTALL HERE</button>
          <button class="neon-btn small slot-cancel-mode-btn">CANCEL</button>
        </div>
      `;
    }

    // ── Install-from-slot mode: this is the selected slot ────────────────
    if (mode?.source === 'slot' && mode.slotId === slot.id) {
      return `
        <div class="slot-panel-head">
          <span class="slot-panel-label">${slot.label || typeLabel}${hotkeyHtml}</span>
          <span class="slot-panel-type install-label">SELECTING ITEM</span>
        </div>
        <div class="slot-panel-body">
          <div class="slot-install-mode-hint">← Pick an item from inventory</div>
        </div>
        <div class="slot-panel-actions">
          <button class="neon-btn small slot-cancel-mode-btn">CANCEL</button>
        </div>
      `;
    }

    // ── Normal: locked ───────────────────────────────────────────────────
    if (!unlocked) {
      const cost = getSlotUnlockCost(this.state, slot.id);
      const canAfford = Object.entries(cost).every(([k, v]) => (this.state.currencies[k] || 0) >= v);
      const costPills = Object.entries(cost).map(([k, v]) => {
        const ok = (this.state.currencies[k] || 0) >= v;
        return `<span class="slot-cost-pill ${ok ? '' : 'afford-no'}">${this._currencyIcon(k)} ${v}</span>`;
      }).join('');
      return `
        <div class="slot-panel-head">
          <span class="slot-panel-label">${slot.label || typeLabel}${hotkeyHtml}</span>
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

    // ── Normal: empty ────────────────────────────────────────────────────
    if (!item) {
      return `
        <div class="slot-panel-head">
          <span class="slot-panel-label">${slot.label || typeLabel}${hotkeyHtml}</span>
          <span class="slot-panel-type">${typeLabel} · EMPTY</span>
        </div>
        <div class="slot-panel-body slot-panel-empty">No module installed</div>
        <div class="slot-panel-actions">
          <button class="neon-btn small slot-install-btn">INSTALL</button>
        </div>
      `;
    }

    // ── Normal: filled ───────────────────────────────────────────────────
    const node = this._nodeForItem(item);
    const effectLine = this._describeNodeEffects(node, 1);
    const energyLine = this._energyStatLine(item);
    const energyLineClass = item.energyRegenPerSec != null
      && item.energyCostPerUse == null
      && item.energyCostPerShot == null
      && item.energyDrainPerSec == null
      ? 'slot-panel-energy slot-panel-energy-regen'
      : 'slot-panel-energy slot-panel-energy-cost';
    return `
      <div class="slot-panel-head">
        <span class="slot-panel-label">${slot.label || typeLabel}${hotkeyHtml}</span>
        <span class="slot-panel-type">${typeLabel}</span>
      </div>
      <div class="slot-panel-body">
        <div class="slot-panel-item"><span class="slot-panel-icon" style="color:${item.color}">${item.icon || '◈'}</span>${item.name}</div>
        <div class="slot-panel-desc">${item.description || ''}</div>
        ${effectLine ? `<div class="slot-panel-effect">${effectLine}</div>` : ''}
        ${energyLine ? `<div class="${energyLineClass}">${energyLine}</div>` : ''}
      </div>
      <div class="slot-panel-actions">
        <button class="neon-btn small slot-swap-btn">SWAP</button>
        <button class="neon-btn small slot-uninstall-btn">UNINSTALL</button>
      </div>
    `;
  }

  _currencyIcon(key) {
    const map = {
      credits:        { icon: '⬡', color: '#ffb347' },
      scrapMetal:     { icon: '⚙', color: '#aaa' },
      plasmaCrystals: { icon: '◆', color: '#00f5ff' },
      bioEssence:     { icon: '✦', color: '#39ff14' },
      darkMatter:     { icon: '◉', color: '#9b30ff' },
      stellarDust:    { icon: '★', color: '#ffd700' },
    };
    const cfg = map[key] || { icon: '?', color: '#fff' };
    return `<span style="color:${cfg.color}">${cfg.icon}</span>`;
  }

  _wirePanelEvents(panel, slot, unlocked) {
    const mode = this._installMode;

    // Cancel button appears in both install-mode states.
    panel.querySelector('.slot-cancel-mode-btn')?.addEventListener('click', () => this._exitInstallMode());

    if (!unlocked) {
      panel.querySelector('.slot-unlock-btn')?.addEventListener('click', () => {
        if (unlockSlot(this.state, this.currency, slot.id)) this._rebuildAll();
      });
      return;
    }

    // Install-from-item mode: clicking "INSTALL HERE" completes placement.
    if (mode?.source === 'item' && mode.slotType === slot.type) {
      panel.querySelector('.slot-install-here-btn')?.addEventListener('click', () => {
        installItem(this.state, slot.id, mode.instanceId);
        this._exitInstallMode();
      });
      return;
    }

    // Normal mode.
    panel.querySelector('.slot-install-btn')?.addEventListener('click', () => {
      this._enterInstallModeFromSlot(slot.id);
    });
    panel.querySelector('.slot-swap-btn')?.addEventListener('click', () => {
      this._enterInstallModeFromSlot(slot.id);
    });
    panel.querySelector('.slot-uninstall-btn')?.addEventListener('click', () => {
      installItem(this.state, slot.id, null);
      this._rebuildAll();
    });
  }

  // ─── Stats panel ────────────────────────────────────────────────────────

  _renderStats() {
    const cur = this.upgradeApplier.preview(this.state.ship);
    const pending = this._pendingShipState
      ? this.upgradeApplier.preview(this._pendingShipState)
      : cur;

    this._renderRadarChart(cur, pending);

    if (!this._statsContainer) return;
    const rows = [
      { label: 'Damage',  get: s => s.damage,      max: 300 },
      { label: 'Hull',    get: s => s.maxHp,        max: 800 },
      { label: 'Shield',  get: s => s.maxShieldHp,  max: 300 },
      { label: 'Speed',   get: s => s.speed,        max: 15  },
      { label: 'Energy',  get: s => s.maxEnergy,    max: 400 },
      { label: 'Magnet',  get: s => s.magnetRange,  max: 30  },
    ];

    this._statsContainer.innerHTML = `
      ${rows.map(r => this._statBarHtml(r, cur, pending)).join('')}
      <div class="hangar-stats-sub">
        <div><span class="hangar-stats-energy-drain">-${this._fmt(cur.energyDrain)} ⚡/s</span></div>
        <div><span class="hangar-stats-energy-regen">+${this._fmt(cur.energyRegen)} ⚡/s</span></div>
        <div>Crit: <span>${(cur.critChance * 100).toFixed(0)}% × ${cur.critMultiplier.toFixed(1)}</span></div>
        <div>Weapons: <span>${[cur.hasAutoFire ? 'auto' : null, ...cur.extraWeapons].filter(Boolean).join(', ') || '—'}</span></div>
      </div>
    `;
  }

  _renderRadarChart(cur, pending) {
    const canvas = this._radarCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Size canvas to its CSS dimensions.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.floor(rect.width  * dpr));
    const H = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const R  = Math.min(W, H) * 0.36;

    const axes = [
      { label: 'DMG',    get: s => s.damage,      max: 300 },
      { label: 'HULL',   get: s => s.maxHp,        max: 800 },
      { label: 'SHIELD', get: s => s.maxShieldHp,  max: 300 },
      { label: 'SPEED',  get: s => s.speed,        max: 15  },
      { label: 'ENERGY', get: s => s.maxEnergy,    max: 400 },
      { label: 'MAGNET', get: s => s.magnetRange,  max: 30  },
    ];
    const N = axes.length;
    const angle0 = -Math.PI / 2;
    const ang = i => angle0 + (2 * Math.PI * i) / N;

    // Grid rings
    for (let ring = 1; ring <= 3; ring++) {
      const r = R * ring / 3;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = cx + r * Math.cos(ang(i));
        const y = cy + r * Math.sin(ang(i));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0,245,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axis spokes
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i)));
      ctx.strokeStyle = 'rgba(0,245,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const drawPoly = (stats, fill, stroke) => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const v = Math.max(0, Math.min(1, (axes[i].get(stats) || 0) / axes[i].max));
        const r = R * v;
        const x = cx + r * Math.cos(ang(i));
        const y = cy + r * Math.sin(ang(i));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    drawPoly(cur, 'rgba(0,245,255,0.15)', 'rgba(0,245,255,0.8)');
    if (pending && pending !== cur) {
      drawPoly(pending, 'rgba(57,255,20,0.12)', 'rgba(57,255,20,0.7)');
    }

    // Labels
    const fontSize = Math.max(8, Math.round(Math.min(W, H) * 0.075));
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.font = `${fontSize}px "Share Tech Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const labelR = R + fontSize * 1.1;
      ctx.fillText(axes[i].label, cx + labelR * Math.cos(ang(i)), cy + labelR * Math.sin(ang(i)));
    }
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

  // ─── Inventory panel ────────────────────────────────────────────────────

  _renderInventory() {
    const container = document.getElementById('hangar-item-list');
    if (!container) return;

    const installedIn = new Map();
    for (const [slotId, entry] of Object.entries(this.state.ship?.slots || {})) {
      if (entry?.installedInstanceId) installedIn.set(entry.installedInstanceId, slotId);
    }

    const instances = getInventoryInstances(this.state);
    if (!instances.length) {
      container.innerHTML = '<div class="hangar-inventory-empty">No items owned</div>';
      return;
    }

    const mode = this._installMode;
    container.innerHTML = '';

    for (const inst of instances) {
      const item = getItem(inst.itemId);
      if (!item) continue;

      const installed = installedIn.has(inst.instanceId);
      const totalUpgrades = Object.values(inst.upgrades || {}).reduce((a, b) => a + b, 0);
      const isUpgradeSelected = this._selectedInstanceId === inst.instanceId;
      const isInstallActive = mode?.source === 'item' && mode.instanceId === inst.instanceId;
      const isInstallTarget = mode?.source === 'slot' && item.slotType === mode.slotType;

      if (mode?.source === 'slot' && !isInstallTarget) continue;

      let rowClass = 'hangar-item-row';
      if (installed) rowClass += ' installed';
      if (isUpgradeSelected) rowClass += ' selected';
      if (isInstallActive) rowClass += ' install-active';
      if (isInstallTarget) rowClass += ' install-target';

      const lvlBadge = totalUpgrades > 0 ? `<span class="hangar-item-lvl">+${totalUpgrades}</span>` : '';
      const statusBadge = installed
        ? `<span class="hangar-item-status equipped">EQUIPPED</span>`
        : `<span class="hangar-item-status">UNEQUIPPED</span>`;

      // Right-side action button varies by mode.
      let actionBtn;
      if (isInstallActive) {
        actionBtn = `<button class="neon-btn small hangar-item-cancel-btn">CANCEL</button>`;
      } else if (isInstallTarget) {
        actionBtn = `<button class="neon-btn small hangar-item-do-install-btn launch">INSTALL</button>`;
      } else {
        actionBtn = `<button class="neon-btn small hangar-item-equip-btn">EQUIP</button>`;
      }

      const row = document.createElement('div');
      row.className = rowClass;
      row.dataset.instanceId = inst.instanceId;
      row.innerHTML = `
        <span class="hangar-item-icon" style="color:${item.color || '#aaa'}">${item.icon || '◈'}</span>
        <div class="hangar-item-info">
          <div class="hangar-item-name">${item.name}${lvlBadge}</div>
          <div class="hangar-item-meta">${(item.slotType || '').toUpperCase()} ${statusBadge}</div>
        </div>
        ${actionBtn}
      `;

      // Row-level click: install if target, cancel if active, open upgrades if normal.
      if (isInstallTarget) {
        row.addEventListener('click', () => {
          installItem(this.state, mode.slotId, inst.instanceId);
          this._exitInstallMode();
        });
      } else if (isInstallActive) {
        row.addEventListener('click', () => this._exitInstallMode());
      } else if (!mode) {
        row.addEventListener('click', () => {
          this._selectedInstanceId = inst.instanceId;
          this._showUpgradePanel(inst.instanceId);
        });
      }

      // Button-specific handlers (stop propagation so they don't double-fire row click).
      row.querySelector('.hangar-item-equip-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._enterInstallModeFromItem(inst.instanceId);
      });
      row.querySelector('.hangar-item-do-install-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        installItem(this.state, mode.slotId, inst.instanceId);
        this._exitInstallMode();
      });
      row.querySelector('.hangar-item-cancel-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._exitInstallMode();
      });

      container.appendChild(row);
    }
  }

  _showUpgradePanel(instanceId) {
    if (this._installMode) {
      this._installMode = null;
      this._buildSlotPanels();
    }
    const inv = document.getElementById('hangar-inventory');
    if (inv) inv.classList.add('hidden');
    if (this._upgradePanel) this._upgradePanel.classList.remove('hidden');
    this._renderItemUpgradePanel(instanceId);
  }

  _hideUpgradePanel() {
    this._selectedInstanceId = null;
    if (this._upgradePanel) {
      this._upgradePanel.classList.add('hidden');
      this._upgradePanel.innerHTML = '';
    }
    const inv = document.getElementById('hangar-inventory');
    if (inv) inv.classList.remove('hidden');
    this._renderInventory();
  }

  _enterInstallModeFromSlot(slotId) {
    if (this._installMode?.source === 'slot' && this._installMode.slotId === slotId) {
      this._exitInstallMode();
      return;
    }
    const slot = getSlot(this.state, slotId);
    if (!slot) return;
    this._selectedInstanceId = null;
    if (this._upgradePanel) this._upgradePanel.classList.add('hidden');
    document.getElementById('hangar-inventory')?.classList.remove('hidden');
    this._installMode = { source: 'slot', slotId, slotType: slot.type };
    const idx = listAllSlots(this.state).findIndex(s => s.id === slotId);
    if (idx >= 0) this._carouselIndex = idx;
    this._buildSlotPanels();
    this._renderInventory();
  }

  _enterInstallModeFromItem(instanceId) {
    if (this._installMode?.source === 'item' && this._installMode.instanceId === instanceId) {
      this._exitInstallMode();
      return;
    }
    const inst = getInstance(this.state, instanceId);
    const item = inst ? getItem(inst.itemId) : null;
    if (!item) return;
    this._selectedInstanceId = null;
    if (this._upgradePanel) this._upgradePanel.classList.add('hidden');
    document.getElementById('hangar-inventory')?.classList.remove('hidden');
    this._installMode = { source: 'item', instanceId, slotType: item.slotType };
    this._buildSlotPanels();
    this._renderInventory();
  }

  _exitInstallMode() {
    this._installMode = null;
    this._buildSlotPanels();
    this._renderInventory();
  }

  _renderItemUpgradePanel(instanceId) {
    const panel = this._upgradePanel;
    if (!panel) return;

    const inst = getInstance(this.state, instanceId);
    if (!inst) { this._hideUpgradePanel(); return; }
    const item = getItem(inst.itemId);
    if (!item) { this._hideUpgradePanel(); return; }

    const upgrades = getUpgradesForItem(inst.itemId);

    const cards = upgrades.map(node => {
      const level = getInstanceUpgradeLevel(this.state, instanceId, node.id);
      const maxLevel = node.maxLevel ?? 1;
      const canBuy = canPurchaseInstanceUpgrade(this.state, instanceId, node.id);
      const costObj = this._upgradeCost(node, level);
      const canAfford = canBuy && this.currency.canAfford(costObj);
      const isLocked = !canBuy && level === 0;

      const costPills = canBuy
        ? Object.entries(costObj).map(([k, v]) => {
            const ok = (this.state.currencies[k] || 0) >= v;
            return `<span class="slot-cost-pill ${ok ? '' : 'afford-no'}">${this._currencyIcon(k)} ${v}</span>`;
          }).join('')
        : `<span class="upg-locked-hint">Requires prereq</span>`;

      let refundPills = '';
      if (level > 0) {
        const refundObj = this._upgradeCost(node, level - 1);
        refundPills = Object.entries(refundObj)
          .map(([k, v]) => {
            const amt = Math.floor(v * 0.5);
            return amt > 0 ? `<span class="slot-cost-pill refund">${this._currencyIcon(k)} ${amt}</span>` : '';
          })
          .join('');
      }

      return `
        <div class="hangar-upg-card${isLocked ? ' locked' : ''}${level >= maxLevel ? ' maxed' : ''}">
          <div class="hangar-upg-card-head">
            <span class="hangar-upg-name">${node.name}</span>
            <span class="hangar-upg-level">${level}/${maxLevel}</span>
          </div>
          <div class="hangar-upg-desc">${node.description || ''}</div>
          <div class="hangar-upg-actions">
            <div class="hangar-upg-cost">${costPills}</div>
            <div class="hangar-upg-btns">
              ${level > 0 ? `<button class="neon-btn small upg-sell-btn" data-node-id="${node.id}">▼ ${refundPills}</button>` : ''}
              ${level < maxLevel
                ? `<button class="neon-btn small upg-buy-btn" data-node-id="${node.id}" ${canAfford ? '' : 'disabled'}>▲ BUY</button>`
                : `<span class="upg-maxed-badge">MAX</span>`}
            </div>
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="hangar-upgrade-header">
        <button class="neon-btn small" id="hangar-upg-back">◀ BACK</button>
        <span class="hangar-upgrade-title">
          <span style="color:${item.color || '#aaa'}">${item.icon || '◈'}</span>
          ${item.name}
        </span>
      </div>
      <div class="hangar-upg-cards">
        ${upgrades.length ? cards : '<div class="hangar-inventory-empty">No upgrades available.</div>'}
      </div>
    `;

    panel.querySelector('#hangar-upg-back')?.addEventListener('click', () => this._hideUpgradePanel());

    panel.querySelectorAll('.upg-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (purchaseInstanceUpgrade(this.state, this.currency, instanceId, btn.dataset.nodeId)) {
          this._renderItemUpgradePanel(instanceId);
          this._renderInventory();
          this._renderStats();
        }
      });
    });

    panel.querySelectorAll('.upg-sell-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (sellInstanceUpgrade(this.state, this.currency, instanceId, btn.dataset.nodeId)) {
          this._renderItemUpgradePanel(instanceId);
          this._renderInventory();
          this._renderStats();
        }
      });
    });
  }

  _upgradeCost(node, level) {
    const mult = Math.pow(1.4, level);
    const out = {};
    for (const [k, v] of Object.entries(node.baseCost || {})) out[k] = Math.ceil(v * mult);
    return out;
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

    container.querySelector('.ship-prev-btn')?.addEventListener('click', () => this._browseShipRelative(-1));
    container.querySelector('.ship-next-btn')?.addEventListener('click', () => this._browseShipRelative(1));
    container.querySelector('.ship-buy-btn')?.addEventListener('click', () => {
      if (purchaseShip(this.state, this.currency, def.id)) {
        selectShip(this.state, def.id);
        this._renderCurrencies();
      }
    });
  }

  _shipStatPreviewRows(def) {
    const base = getShipBasePlayerValues(def);
    return [
      { label: 'Hull',      value: this._fmt(base.maxHp ?? PLAYER.BASE_HP) },
      { label: 'Damage',    value: this._fmt(base.damage ?? PLAYER.BASE_DAMAGE) },
      { label: 'Speed',     value: this._fmt(base.speed ?? PLAYER.BASE_SPEED) },
      { label: 'Fire Rate', value: `${this._fmt(base.attackSpeed ?? PLAYER.BASE_ATTACK_SPEED)}/s` },
      { label: 'Armor',     value: this._fmt(base.armor ?? 0) },
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

    if (!this._autoRotate) {
      this._idleTimer += dt;
      if (this._idleTimer >= this._idleResumeAfter) this._autoRotate = true;
    }
    if (this._autoRotate) this._yaw += dt * 0.35;
    this._shipPivot.rotation.x = this._pitch;
    this._shipPivot.rotation.y = this._yaw;

    const camZ = this._camera.position.z;
    this._camera.position.z = camZ + (this._zoom - camZ) * Math.min(1, dt * 8);
    this._camera.lookAt(0, 0, 0);

    const pulse = 0.55 + 0.45 * Math.sin(now * 0.004);
    for (const [slotId, { indicator, itemMesh }] of this._slotMeshes) {
      const isCurrent = slotId === this._carouselSlotId;
      indicator.traverse(o => {
        if (o.material?.opacity !== undefined) {
          o.material.opacity = isCurrent
            ? (itemMesh ? 0.5 : 0.3 + pulse * 0.7)
            : 0.12;
        }
      });
      if (itemMesh) itemMesh.update(dt, { phase: 'hangar' });
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

  _energyStatLine(item) {
    if (!item) return '';
    if (item.energyCostPerUse != null) return `-${item.energyCostPerUse} ⚡/use`;
    if (item.energyCostPerShot != null) return `-${item.energyCostPerShot} ⚡/shot`;
    if (item.energyDrainPerSec != null) return `-${item.energyDrainPerSec} ⚡/s`;
    if (item.energyRegenPerSec != null) return `+${item.energyRegenPerSec} ⚡/s`;
    return '';
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
        case 'add_flat':
          if (e.stat === 'energyDrain') {
            const v = e.value;
            const n = Math.abs(v);
            if (v > 0) parts.push(`-${n} ⚡/s`);
            else if (v < 0) parts.push(`+${n} ⚡/s`);
            else parts.push('0 ⚡/s');
          } else {
            parts.push(`+${e.value} ${e.statLabel || e.stat}`);
          }
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
