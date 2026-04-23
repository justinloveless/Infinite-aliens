/**
 * Ship Slot Designer — standalone dev-only page at /dev/shipslotdesigner
 *
 * Renders each ship in a hangar-style 3D preview with draggable slot gizmos
 * and HTML info panels that can be dragged around the stage. Edits mutate a
 * working copy; "Save" POSTs the JSON to `/dev/save-ship-slots`, which the
 * Vite dev plugin writes back to src/data/shipSlots/<shipId>.json.
 *
 * Ship component classes read those JSON files at import time, so a reload
 * picks up the new layout both in the live game and in the hangar UI.
 */

import * as THREE from 'three';
import { buildShipHull, buildSlotIndicator } from '../scene/ShipMeshFactory.js';
import { applySlotGroupTransform } from '../scene/slotGroupUtils.js';
import { createItemMesh } from '../scene/itemMeshes/index.js';
import { getItem } from '../hangar/HangarSystem.js';
import { getAllShipDefs } from '../components/ships/ShipRegistry.js';
import { applySlotPanelLayout, PANEL_ANCHORS, pixelToFreePanel } from '../ui/shipSlotPanelLayout.js';

import allrounderSlots from '../data/shipSlots/allrounder.json';
import heavySlots from '../data/shipSlots/heavy.json';
import fighterSlots from '../data/shipSlots/fighter.json';

const SEED_DATA = {
  allrounder: allrounderSlots,
  heavy: heavySlots,
  fighter: fighterSlots,
};

const SLOT_TYPES = ['weapon', 'defense', 'utility'];
const SHAPES = ['box', 'circle'];
const CURRENCY_LIST = ['credits', 'scrapMetal', 'plasmaCrystals', 'bioEssence', 'darkMatter', 'stellarDust'];
const CURRENCY_ICONS = { credits: '⬡', scrapMetal: '⚙', plasmaCrystals: '◆', bioEssence: '✦', darkMatter: '◉', stellarDust: '★' };

const CSS = {
  panelBg:   'background:#0a0f1c;border:1px solid #223;',
  btn:       'background:#0e1826;border:1px solid #446;color:#9ab;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:3px;font-family:Courier New,monospace;',
  btnGreen:  'background:#0a2a10;border:1px solid #2a7a4a;color:#5fb;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:3px;font-family:Courier New,monospace;',
  btnRed:    'background:#1a0a0a;border:1px solid #7a2a2a;color:#f66;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:3px;font-family:Courier New,monospace;',
  secTitle:  'color:#7df;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid #223;',
  row:       'display:flex;align-items:center;gap:6px;margin-bottom:6px;',
  label:     'color:#8899aa;font-size:11px;min-width:80px;flex-shrink:0;',
  input:     'background:#050a14;border:1px solid #2a3648;color:#cde;font-size:11px;padding:3px 6px;border-radius:2px;font-family:Courier New,monospace;flex:1;min-width:0;',
  select:    'background:#050a14;border:1px solid #2a3648;color:#cde;font-size:11px;padding:3px 6px;border-radius:2px;font-family:Courier New,monospace;flex:1;min-width:0;',
  slotRow:   'display:flex;align-items:center;gap:4px;padding:5px 6px;border:1px solid #223;border-radius:3px;margin-bottom:3px;cursor:pointer;font-size:11px;background:#0a1020;',
  slotRowSel:'display:flex;align-items:center;gap:4px;padding:5px 6px;border:1px solid #3a7;border-radius:3px;margin-bottom:3px;cursor:pointer;font-size:11px;background:#0e2030;box-shadow:0 0 6px rgba(60,180,140,0.3);',
};

const STAGE_WIDTH_MIN = 320;

export class ShipSlotDesigner {
  constructor() {
    const ships = getAllShipDefs();
    this._ships = ships;
    this._currentShipId = ships[0]?.id || 'allrounder';
    this._workingByShip = Object.fromEntries(
      ships.map(s => [s.id, _deepClone(SEED_DATA[s.id] || { slots: [], defaultUnlockedSlots: [], defaultLoadout: {} })]),
    );
    this._dirty = {};
    this._selectedSlotId = null;

    this._root = null;
    this._stageEl = null;
    this._canvas = null;
    this._panelsLayer = null;
    this._inspectorEl = null;
    this._slotListEl = null;
    this._statusEl = null;

    this._three = null;   // { renderer, scene, camera, pivot, ship, slotNode }
    this._slotMeshes = new Map();
    this._viewYaw = 0.4;
    this._viewPitch = 0.25;
    this._zoom = 7.0;
    this._viewDragging = false;
    this._slotDrag = null;
  }

  open() {
    if (this._root) return;
    this._build();
    this._buildStage();
    this._loadCurrentShip();
    this._startLoop();
    window.addEventListener('resize', this._onResize = () => this._resize());
    this._resize();
  }

  // ─── DOM scaffolding ───────────────────────────────────────────────────

  _build() {
    const root = document.createElement('div');
    root.id = 'ship-slot-designer-root';
    root.style.cssText = `
      position: fixed; inset: 0; display: flex; flex-direction: column;
      background: #060018; color: #cde;
      font-family: 'Courier New', monospace;
    `;

    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display:flex; align-items:center; gap:10px; padding:10px 14px;
      border-bottom:1px solid #223; background:#090c1a; flex:0 0 auto;
    `;

    const title = document.createElement('div');
    title.textContent = 'SHIP SLOT DESIGNER';
    title.style.cssText = 'color:#7df; font-size:13px; letter-spacing:2px; font-weight:bold;';
    topBar.appendChild(title);

    const shipSelectLabel = document.createElement('span');
    shipSelectLabel.textContent = 'SHIP';
    shipSelectLabel.style.cssText = 'color:#8899aa; font-size:10px; margin-left:18px;';
    topBar.appendChild(shipSelectLabel);

    const shipSelect = document.createElement('select');
    shipSelect.style.cssText = CSS.select + 'flex:0 0 180px;';
    for (const s of this._ships) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.id})`;
      shipSelect.appendChild(opt);
    }
    shipSelect.value = this._currentShipId;
    shipSelect.addEventListener('change', () => {
      this._currentShipId = shipSelect.value;
      this._loadCurrentShip();
    });
    topBar.appendChild(shipSelect);
    this._shipSelect = shipSelect;

    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;';
    topBar.appendChild(spacer);

    const status = document.createElement('span');
    status.style.cssText = 'color:#9ab; font-size:11px; min-width:220px; text-align:right;';
    status.textContent = '';
    this._statusEl = status;
    topBar.appendChild(status);

    const saveBtn = _mkBtn('SAVE TO JSON', CSS.btnGreen);
    saveBtn.addEventListener('click', () => this._saveToDisk());
    topBar.appendChild(saveBtn);

    const copyBtn = _mkBtn('COPY JSON', CSS.btn);
    copyBtn.addEventListener('click', () => this._copyJson());
    topBar.appendChild(copyBtn);

    const revertBtn = _mkBtn('REVERT', CSS.btnRed);
    revertBtn.addEventListener('click', () => this._revertShip());
    topBar.appendChild(revertBtn);

    root.appendChild(topBar);

    const body = document.createElement('div');
    body.style.cssText = 'display:flex; flex:1 1 auto; min-height:0;';
    root.appendChild(body);

    // Left column: slot list
    const left = document.createElement('div');
    left.style.cssText = `
      flex:0 0 240px; overflow-y:auto; padding:10px;
      border-right:1px solid #223; background:#080c18;
    `;
    this._buildLeftColumn(left);
    body.appendChild(left);

    // Center stage
    const stage = document.createElement('div');
    stage.id = 'ssd-stage';
    stage.style.cssText = `
      flex:1 1 auto; position:relative; overflow:hidden; background:#02060f;
      min-width:${STAGE_WIDTH_MIN}px;
    `;
    this._stageEl = stage;
    body.appendChild(stage);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%; height:100%; display:block;';
    stage.appendChild(canvas);
    this._canvas = canvas;

    const panelsLayer = document.createElement('div');
    panelsLayer.style.cssText = `
      position:absolute; inset:0; pointer-events:none;
    `;
    stage.appendChild(panelsLayer);
    this._panelsLayer = panelsLayer;

    const hint = document.createElement('div');
    hint.style.cssText = `
      position:absolute; left:10px; bottom:10px; color:#567; font-size:10px;
      background:rgba(0,0,0,0.5); padding:5px 8px; border-radius:3px;
      pointer-events:none; line-height:1.5;
    `;
    hint.innerHTML = [
      'Drag a slot gizmo to move it in camera-plane (world XY-ish).',
      'Drag empty space to orbit the ship.',
      'Drag an HTML panel to reposition it (anchor → free%).',
      'Scroll to zoom.',
    ].join('<br>');
    stage.appendChild(hint);

    // Right column: inspector
    const right = document.createElement('div');
    right.style.cssText = `
      flex:0 0 320px; overflow-y:auto; padding:10px;
      border-left:1px solid #223; background:#080c18;
    `;
    this._inspectorEl = right;
    body.appendChild(right);

    document.body.appendChild(root);
    this._root = root;
  }

  _buildLeftColumn(container) {
    const title = document.createElement('div');
    title.textContent = 'SLOTS';
    title.style.cssText = CSS.secTitle;
    container.appendChild(title);

    const addBtn = _mkBtn('+ ADD SLOT', CSS.btnGreen);
    addBtn.style.cssText += 'width:100%; margin-bottom:8px;';
    addBtn.addEventListener('click', () => this._addSlot());
    container.appendChild(addBtn);

    const list = document.createElement('div');
    this._slotListEl = list;
    container.appendChild(list);

    const defaultsTitle = document.createElement('div');
    defaultsTitle.textContent = 'DEFAULTS';
    defaultsTitle.style.cssText = CSS.secTitle;
    container.appendChild(defaultsTitle);
    this._defaultsEl = document.createElement('div');
    container.appendChild(this._defaultsEl);
  }

  _renderSlotList() {
    if (!this._slotListEl) return;
    const data = this._working();
    this._slotListEl.innerHTML = '';
    data.slots.forEach((slot, idx) => {
      const row = document.createElement('div');
      row.style.cssText = (slot.id === this._selectedSlotId) ? CSS.slotRowSel : CSS.slotRow;

      const nameBlock = document.createElement('div');
      nameBlock.style.cssText = 'flex:1; min-width:0; overflow:hidden;';
      const typeColor = { weapon: '#ff4466', defense: '#4488ff', utility: '#ffcc44' }[slot.type] || '#888';
      nameBlock.innerHTML = `
        <div style="color:${typeColor};font-size:10px;letter-spacing:1px;">${(slot.type || '?').toUpperCase()}</div>
        <div style="color:#cde;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.label || '(no label)'}</div>
        <div style="color:#567;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${slot.id}</div>
      `;
      nameBlock.addEventListener('click', () => {
        this._selectedSlotId = slot.id;
        this._renderAll();
      });
      row.appendChild(nameBlock);

      const dupBtn = document.createElement('button');
      dupBtn.textContent = '⧉';
      dupBtn.title = 'Duplicate';
      dupBtn.style.cssText = CSS.btn + 'padding:2px 6px;';
      dupBtn.addEventListener('click', (e) => { e.stopPropagation(); this._duplicateSlot(idx); });
      row.appendChild(dupBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = 'Delete';
      delBtn.style.cssText = CSS.btnRed + 'padding:2px 6px;';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); this._deleteSlot(idx); });
      row.appendChild(delBtn);

      this._slotListEl.appendChild(row);
    });

    this._renderDefaults();
  }

  _renderDefaults() {
    const data = this._working();
    const el = this._defaultsEl;
    if (!el) return;
    el.innerHTML = '';

    const unlockedLabel = document.createElement('div');
    unlockedLabel.textContent = 'Default unlocked slots:';
    unlockedLabel.style.cssText = 'color:#8899aa; font-size:10px; margin:4px 0;';
    el.appendChild(unlockedLabel);

    for (const slot of data.slots) {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:10px; color:#9ab; cursor:pointer; padding:2px 0;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = data.defaultUnlockedSlots.includes(slot.id);
      cb.addEventListener('change', () => {
        const set = new Set(data.defaultUnlockedSlots);
        if (cb.checked) set.add(slot.id); else set.delete(slot.id);
        data.defaultUnlockedSlots = [...set];
        this._markDirty();
      });
      row.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = slot.id;
      row.appendChild(span);
      el.appendChild(row);
    }

    const loadoutTitle = document.createElement('div');
    loadoutTitle.textContent = 'Default loadout (slotId → itemId):';
    loadoutTitle.style.cssText = 'color:#8899aa; font-size:10px; margin:8px 0 4px;';
    el.appendChild(loadoutTitle);

    for (const slot of data.slots) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:5px; margin-bottom:3px;';
      const lab = document.createElement('span');
      lab.textContent = slot.id;
      lab.style.cssText = 'flex:0 0 90px; color:#9ab; font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = '(none)';
      inp.value = data.defaultLoadout[slot.id] || '';
      inp.style.cssText = CSS.input + 'flex:1;';
      inp.addEventListener('change', () => {
        const v = inp.value.trim();
        if (v) data.defaultLoadout[slot.id] = v;
        else delete data.defaultLoadout[slot.id];
        this._markDirty();
      });
      row.appendChild(lab);
      row.appendChild(inp);
      el.appendChild(row);
    }
  }

  // ─── Three.js stage ────────────────────────────────────────────────────

  _buildStage() {
    const renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    scene.background = null;

    scene.add(new THREE.HemisphereLight(0xaaccff, 0x221133, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 5, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff66ff, 0.4);
    fill.position.set(-3, -1, -2);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0, this._zoom);

    const pivot = new THREE.Group();
    scene.add(pivot);

    this._three = { renderer, scene, camera, pivot, ship: null, slotNode: null };

    this._initInput();
  }

  _initInput() {
    const canvas = this._canvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);

      const hit = this._pickSlotAt(e);
      if (hit) {
        this._selectedSlotId = hit.slotId;
        this._renderAll();
        this._slotDrag = this._beginSlotDrag(hit.slotId, e);
      } else {
        this._viewDragging = { lastX: e.clientX, lastY: e.clientY };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this._slotDrag) {
        this._updateSlotDrag(e);
      } else if (this._viewDragging) {
        const dx = e.clientX - this._viewDragging.lastX;
        const dy = e.clientY - this._viewDragging.lastY;
        this._viewDragging.lastX = e.clientX;
        this._viewDragging.lastY = e.clientY;
        this._viewYaw += dx * 0.008;
        this._viewPitch = Math.max(-1.0, Math.min(1.0, this._viewPitch + dy * 0.006));
      }
    });

    const endDrag = (e) => {
      if (this._slotDrag) {
        this._slotDrag = null;
        this._markDirty();
        this._renderInspector();
      }
      this._viewDragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.001);
      this._zoom = Math.max(2.5, Math.min(14, this._zoom * factor));
    }, { passive: false });
  }

  _pickSlotAt(e) {
    const rect = this._canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.12 };
    raycaster.setFromCamera({ x: nx, y: ny }, this._three.camera);

    let best = null;
    for (const [slotId, entry] of this._slotMeshes) {
      const hits = raycaster.intersectObject(entry.hitbox, true);
      if (hits.length && (!best || hits[0].distance < best.distance)) {
        best = { slotId, distance: hits[0].distance };
      }
    }
    return best;
  }

  _beginSlotDrag(slotId, e) {
    const slot = this._getSlot(slotId);
    if (!slot) return null;

    const rect = this._canvas.getBoundingClientRect();
    const { camera, pivot } = this._three;

    // World position of slot at drag start.
    const localStart = new THREE.Vector3().fromArray(slot.position);
    const worldStart = localStart.clone().applyMatrix4(pivot.matrixWorld);

    // Drag plane: perpendicular to camera view direction, passing through slot.
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir.clone(), worldStart);

    const raycaster = new THREE.Raycaster();
    const ndc = (clientX, clientY) => ({
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    });
    const n0 = ndc(e.clientX, e.clientY);
    raycaster.setFromCamera(n0, camera);
    const initialHit = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, initialHit);

    return {
      slotId,
      rect,
      plane,
      raycaster,
      ndc,
      localStart,
      worldStart,
      initialHit: initialHit.clone(),
      invPivot: pivot.matrixWorld.clone().invert(),
    };
  }

  _updateSlotDrag(e) {
    const d = this._slotDrag;
    if (!d) return;
    const slot = this._getSlot(d.slotId);
    if (!slot) return;

    const n = d.ndc(e.clientX, e.clientY);
    d.raycaster.setFromCamera(n, this._three.camera);
    const hit = new THREE.Vector3();
    if (!d.raycaster.ray.intersectPlane(d.plane, hit)) return;

    const worldDelta = hit.clone().sub(d.initialHit);
    const worldEnd = d.worldStart.clone().add(worldDelta);
    // Back into pivot-local space.
    const localEnd = worldEnd.clone().applyMatrix4(d.invPivot);

    slot.position = [
      _round(localEnd.x, 3),
      _round(localEnd.y, 3),
      _round(localEnd.z, 3),
    ];

    // Move the slot mesh live without rebuilding.
    const entry = this._slotMeshes.get(d.slotId);
    if (entry) applySlotGroupTransform(entry.group, slot);
  }

  _buildShipMesh() {
    const t = this._three;
    if (t.ship) {
      t.pivot.remove(t.ship);
      t.ship.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) Array.isArray(o.material)
          ? o.material.forEach(m => m.dispose?.())
          : o.material.dispose?.();
      });
    }
    const def = this._ships.find(s => s.id === this._currentShipId);
    const variant = def?.meshVariant || this._currentShipId;
    t.ship = buildShipHull({ variant, withLights: false });
    t.pivot.add(t.ship);

    t.slotNode = new THREE.Group();
    t.ship.add(t.slotNode);
  }

  _rebuildSlotMeshes() {
    const t = this._three;
    if (!t.slotNode) return;
    for (const e of this._slotMeshes.values()) e.itemMesh?.dispose();
    while (t.slotNode.children.length) {
      const c = t.slotNode.children[0];
      t.slotNode.remove(c);
      c.traverse?.(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) Array.isArray(o.material)
          ? o.material.forEach(m => m.dispose?.())
          : o.material.dispose?.();
      });
    }
    this._slotMeshes.clear();

    const data = this._working();
    for (const slot of data.slots) {
      const group = new THREE.Group();
      applySlotGroupTransform(group, slot);

      const selected = slot.id === this._selectedSlotId;
      const color = selected ? 0x39ff14 : ({ weapon: 0xff4466, defense: 0x4488ff, utility: 0xffcc44 }[slot.type] || 0xaaaaaa);
      const indicator = buildSlotIndicator(slot, { color, opacity: selected ? 1.0 : 0.75 });
      group.add(indicator);

      let itemMesh = null;
      const previewId = data.defaultLoadout?.[slot.id];
      if (typeof previewId === 'string' && previewId) {
        const pItem = getItem(previewId);
        if (pItem) {
          itemMesh = createItemMesh(pItem, slot, { phase: 'hangar' });
          itemMesh.phase = 'hangar';
          group.add(itemMesh.root);
        }
      }

      // Invisible hitbox for reliable raycasting regardless of zoom/angle.
      const hitSize = Math.max(0.35, (slot.size ?? 0.35) * 1.3);
      const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(hitSize * 0.5, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      group.add(hitbox);

      t.slotNode.add(group);
      this._slotMeshes.set(slot.id, { group, indicator, hitbox, itemMesh });
    }
  }

  _rebuildSlotPanels() {
    const layer = this._panelsLayer;
    if (!layer) return;
    layer.innerHTML = '';

    const stageRect = this._stageEl.getBoundingClientRect();

    for (const slot of this._working().slots) {
      const panel = document.createElement('div');
      panel.style.cssText = `
        position:absolute; width:200px; background:rgba(10,16,32,0.92);
        border:1px solid rgba(0,245,255,0.35); border-radius:4px;
        padding:6px 8px; color:#cde; font-size:10px; line-height:1.4;
        pointer-events:auto; cursor:grab;
        box-shadow:0 0 10px rgba(0,245,255,0.2);
      `;
      if (slot.id === this._selectedSlotId) {
        panel.style.borderColor = 'rgba(57,255,20,0.8)';
        panel.style.boxShadow = '0 0 12px rgba(57,255,20,0.35)';
      }
      const typeColor = { weapon: '#ff4466', defense: '#4488ff', utility: '#ffcc44' }[slot.type] || '#888';
      panel.innerHTML = `
        <div style="color:${typeColor};font-size:9px;letter-spacing:1px;">${(slot.type || '?').toUpperCase()}</div>
        <div style="color:#cde;font-weight:bold;">${slot.label || '(no label)'}</div>
        <div style="color:#789;font-size:9px;">${slot.id}</div>
        <div style="color:#567;font-size:9px;margin-top:4px;">${slot.description || ''}</div>
      `;
      applySlotPanelLayout(panel, slot.panel);

      panel.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this._selectedSlotId = slot.id;
        this._renderAll();
        this._beginPanelDrag(panel, slot, e, stageRect);
      });

      layer.appendChild(panel);
    }
  }

  _beginPanelDrag(panel, slot, e, stageRect0) {
    panel.setPointerCapture(e.pointerId);
    panel.style.cursor = 'grabbing';
    const stageRect = this._stageEl.getBoundingClientRect();

    const onMove = (ev) => {
      const cfg = pixelToFreePanel(stageRect, ev.clientX, ev.clientY);
      slot.panel = cfg;
      applySlotPanelLayout(panel, cfg);
      this._renderInspector();
    };

    const onUp = (ev) => {
      panel.removeEventListener('pointermove', onMove);
      panel.removeEventListener('pointerup', onUp);
      panel.removeEventListener('pointercancel', onUp);
      try { panel.releasePointerCapture(ev.pointerId); } catch {}
      panel.style.cursor = 'grab';
      this._markDirty();
    };

    panel.addEventListener('pointermove', onMove);
    panel.addEventListener('pointerup', onUp);
    panel.addEventListener('pointercancel', onUp);
  }

  _resize() {
    if (!this._canvas || !this._three) return;
    const rect = this._stageEl.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this._three.renderer.setSize(w, h, false);
    this._three.camera.aspect = w / h;
    this._three.camera.updateProjectionMatrix();
  }

  _startLoop() {
    let last = performance.now();
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = this._three;
      if (!t) return;
      t.pivot.rotation.x = this._viewPitch;
      t.pivot.rotation.y = this._viewYaw;
      const curZ = t.camera.position.z;
      t.camera.position.z = curZ + (this._zoom - curZ) * 0.15;
      t.camera.lookAt(0, 0, 0);
      for (const e of this._slotMeshes.values()) e.itemMesh?.update(dt, { phase: 'hangar' });
      t.renderer.render(t.scene, t.camera);
    };
    tick();
  }

  // ─── Data operations ───────────────────────────────────────────────────

  _working() {
    return this._workingByShip[this._currentShipId];
  }

  _getSlot(slotId) {
    return this._working().slots.find(s => s.id === slotId);
  }

  _loadCurrentShip() {
    this._selectedSlotId = this._working().slots[0]?.id || null;
    this._buildShipMesh();
    this._renderAll();
  }

  _revertShip() {
    const id = this._currentShipId;
    this._workingByShip[id] = _deepClone(SEED_DATA[id] || { slots: [], defaultUnlockedSlots: [], defaultLoadout: {} });
    delete this._dirty[id];
    this._selectedSlotId = this._working().slots[0]?.id || null;
    this._renderAll();
    this._showStatus(`↩ Reverted ${id} to seed`, '#9ab');
  }

  _renderAll() {
    this._rebuildSlotMeshes();
    this._rebuildSlotPanels();
    this._renderSlotList();
    this._renderInspector();
    this._updateStatusLine();
  }

  _markDirty() {
    this._dirty[this._currentShipId] = true;
    this._updateStatusLine();
  }

  _updateStatusLine() {
    const dirtyIds = Object.keys(this._dirty);
    if (!dirtyIds.length) {
      this._showStatus('No unsaved changes', '#567');
    } else {
      this._showStatus(`● Unsaved: ${dirtyIds.join(', ')}`, '#fa6');
    }
  }

  _addSlot() {
    const data = this._working();
    let i = 1;
    while (data.slots.some(s => s.id === `new_slot_${i}`)) i++;
    const id = `new_slot_${i}`;
    data.slots.push({
      id,
      type: 'weapon',
      shape: 'box',
      size: 0.35,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      unlockCost: { credits: 100 },
      label: 'NEW',
      description: '',
      panel: { anchor: 'center', offsetX: 0, offsetY: 0 },
    });
    this._selectedSlotId = id;
    this._markDirty();
    this._renderAll();
  }

  _duplicateSlot(idx) {
    const data = this._working();
    const src = data.slots[idx];
    if (!src) return;
    let i = 2;
    while (data.slots.some(s => s.id === `${src.id}_${i}`)) i++;
    const clone = _deepClone(src);
    clone.id = `${src.id}_${i}`;
    clone.label = `${src.label || ''} ${i}`.trim();
    data.slots.splice(idx + 1, 0, clone);
    this._selectedSlotId = clone.id;
    this._markDirty();
    this._renderAll();
  }

  _deleteSlot(idx) {
    const data = this._working();
    const slot = data.slots[idx];
    if (!slot) return;
    if (!confirm(`Delete slot "${slot.id}"?`)) return;
    data.slots.splice(idx, 1);
    data.defaultUnlockedSlots = data.defaultUnlockedSlots.filter(id => id !== slot.id);
    delete data.defaultLoadout[slot.id];
    if (this._selectedSlotId === slot.id) this._selectedSlotId = data.slots[0]?.id || null;
    this._markDirty();
    this._renderAll();
  }

  // ─── Inspector form ────────────────────────────────────────────────────

  _renderInspector() {
    const el = this._inspectorEl;
    if (!el) return;
    el.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'INSPECTOR';
    title.style.cssText = CSS.secTitle;
    el.appendChild(title);

    const slot = this._selectedSlotId ? this._getSlot(this._selectedSlotId) : null;
    if (!slot) {
      const hint = document.createElement('div');
      hint.textContent = 'Select a slot from the list or click one in the preview.';
      hint.style.cssText = 'color:#567; font-size:11px;';
      el.appendChild(hint);
      return;
    }

    this._insRow(el, 'ID', 'text', slot.id, (v) => {
      const newId = String(v).trim();
      if (!newId || newId === slot.id) return;
      if (this._working().slots.some(s => s.id === newId)) {
        this._showStatus(`✗ id "${newId}" already in use`, '#f66');
        return;
      }
      const data = this._working();
      const oldId = slot.id;
      slot.id = newId;
      data.defaultUnlockedSlots = data.defaultUnlockedSlots.map(id => id === oldId ? newId : id);
      if (oldId in data.defaultLoadout) {
        data.defaultLoadout[newId] = data.defaultLoadout[oldId];
        delete data.defaultLoadout[oldId];
      }
      this._selectedSlotId = newId;
      this._markDirty();
      this._renderAll();
    });

    this._insRow(el, 'Label', 'text', slot.label || '', (v) => {
      slot.label = v;
      this._markDirty();
      this._rebuildSlotPanels();
      this._renderSlotList();
    });

    this._insSelect(el, 'Type', SLOT_TYPES, slot.type || 'weapon', (v) => {
      slot.type = v;
      this._markDirty();
      this._rebuildSlotMeshes();
      this._rebuildSlotPanels();
      this._renderSlotList();
    });

    this._insSelect(el, 'Shape', SHAPES, slot.shape || 'box', (v) => {
      slot.shape = v;
      this._markDirty();
      this._rebuildSlotMeshes();
    });

    this._insRow(el, 'Size', 'number', slot.size ?? 0.35, (v) => {
      slot.size = parseFloat(v);
      this._markDirty();
      this._rebuildSlotMeshes();
    }, { step: 0.01 });

    const posTitle = document.createElement('div');
    posTitle.textContent = 'POSITION';
    posTitle.style.cssText = CSS.secTitle;
    el.appendChild(posTitle);

    const pos = slot.position || [0, 0, 0];
    ['X', 'Y', 'Z'].forEach((axis, i) => {
      this._insRow(el, axis, 'number', pos[i] ?? 0, (v) => {
        const arr = [...(slot.position || [0, 0, 0])];
        arr[i] = parseFloat(v);
        slot.position = arr;
        this._markDirty();
        const entry = this._slotMeshes.get(slot.id);
        if (entry) applySlotGroupTransform(entry.group, slot);
      }, { step: 0.05 });
    });

    const rotTitle = document.createElement('div');
    rotTitle.textContent = 'ROTATION (radians, XYZ)';
    rotTitle.style.cssText = CSS.secTitle;
    el.appendChild(rotTitle);

    const rot = Array.isArray(slot.rotation) && slot.rotation.length >= 3
      ? slot.rotation : [0, 0, 0];
    ['X', 'Y', 'Z'].forEach((axis, i) => {
      this._insRow(el, `R${axis}`, 'number', rot[i] ?? 0, (v) => {
        const arr = [...(Array.isArray(slot.rotation) && slot.rotation.length >= 3 ? slot.rotation : [0, 0, 0])];
        arr[i] = parseFloat(v);
        slot.rotation = arr;
        this._markDirty();
        const entry = this._slotMeshes.get(slot.id);
        if (entry) applySlotGroupTransform(entry.group, slot);
      }, { step: 0.05 });
    });

    const descTitle = document.createElement('div');
    descTitle.textContent = 'DESCRIPTION';
    descTitle.style.cssText = CSS.secTitle;
    el.appendChild(descTitle);

    const ta = document.createElement('textarea');
    ta.style.cssText = CSS.input + 'width:100%; min-height:54px; resize:vertical;';
    ta.value = slot.description || '';
    ta.addEventListener('change', () => {
      slot.description = ta.value;
      this._markDirty();
      this._rebuildSlotPanels();
    });
    el.appendChild(ta);

    // Unlock
    const unlockTitle = document.createElement('div');
    unlockTitle.textContent = 'UNLOCK';
    unlockTitle.style.cssText = CSS.secTitle;
    el.appendChild(unlockTitle);

    const unlockMode = slot.unlockCondition === 'always' ? 'always' : 'cost';
    this._insSelect(el, 'Mode', ['always', 'cost'], unlockMode, (v) => {
      if (v === 'always') {
        slot.unlockCondition = 'always';
        delete slot.unlockCost;
      } else {
        delete slot.unlockCondition;
        if (!slot.unlockCost) slot.unlockCost = { credits: 100 };
      }
      this._markDirty();
      this._renderInspector();
    });

    if (unlockMode === 'cost') {
      const cost = slot.unlockCost || {};
      for (const cur of CURRENCY_LIST) {
        const row = document.createElement('div');
        row.style.cssText = CSS.row;
        const lab = document.createElement('span');
        lab.textContent = `${CURRENCY_ICONS[cur]} ${cur}`;
        lab.style.cssText = CSS.label;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = cost[cur] ?? '';
        inp.placeholder = '0';
        inp.style.cssText = CSS.input;
        inp.addEventListener('change', () => {
          const v = parseInt(inp.value, 10);
          if (!slot.unlockCost) slot.unlockCost = {};
          if (Number.isFinite(v) && v > 0) slot.unlockCost[cur] = v;
          else delete slot.unlockCost[cur];
          this._markDirty();
        });
        row.appendChild(lab);
        row.appendChild(inp);
        el.appendChild(row);
      }
    }

    // Panel layout
    const panelTitle = document.createElement('div');
    panelTitle.textContent = 'PANEL LAYOUT';
    panelTitle.style.cssText = CSS.secTitle;
    el.appendChild(panelTitle);

    const panelCfg = slot.panel || { anchor: 'center', offsetX: 0, offsetY: 0 };
    this._insSelect(el, 'Anchor', PANEL_ANCHORS, panelCfg.anchor || 'center', (v) => {
      slot.panel = { ...(slot.panel || {}), anchor: v, offsetX: panelCfg.offsetX ?? 0, offsetY: panelCfg.offsetY ?? 0 };
      if (v === 'free') {
        slot.panel.offsetX = 50;
        slot.panel.offsetY = 50;
      } else {
        if ((slot.panel.offsetX ?? 0) > 100) slot.panel.offsetX = 10;
        if ((slot.panel.offsetY ?? 0) > 100) slot.panel.offsetY = 10;
      }
      this._markDirty();
      this._rebuildSlotPanels();
      this._renderInspector();
    });

    const oxLabel = panelCfg.anchor === 'free' ? 'Offset X (%)' : 'Offset X (px)';
    const oyLabel = panelCfg.anchor === 'free' ? 'Offset Y (%)' : 'Offset Y (px)';
    this._insRow(el, oxLabel, 'number', panelCfg.offsetX ?? 0, (v) => {
      slot.panel = { ...(slot.panel || { anchor: 'center' }), offsetX: parseFloat(v) };
      this._markDirty();
      this._rebuildSlotPanels();
    }, { step: panelCfg.anchor === 'free' ? 0.1 : 1 });
    this._insRow(el, oyLabel, 'number', panelCfg.offsetY ?? 0, (v) => {
      slot.panel = { ...(slot.panel || { anchor: 'center' }), offsetY: parseFloat(v) };
      this._markDirty();
      this._rebuildSlotPanels();
    }, { step: panelCfg.anchor === 'free' ? 0.1 : 1 });

    const hint = document.createElement('div');
    hint.style.cssText = 'color:#567; font-size:10px; margin-top:6px; line-height:1.4;';
    hint.innerHTML = 'Drag the HTML panel in the preview to snap to <b>free %</b> mode.';
    el.appendChild(hint);
  }

  _insRow(parent, label, type, value, onChange, opts = {}) {
    const row = document.createElement('div');
    row.style.cssText = CSS.row;
    const lab = document.createElement('span');
    lab.textContent = label;
    lab.style.cssText = CSS.label;
    const inp = document.createElement('input');
    inp.type = type;
    inp.value = value;
    inp.style.cssText = CSS.input;
    if (opts.step != null) inp.step = String(opts.step);
    inp.addEventListener('change', () => onChange(inp.value));
    if (type === 'number') inp.addEventListener('input', () => onChange(inp.value));
    row.appendChild(lab);
    row.appendChild(inp);
    parent.appendChild(row);
    return inp;
  }

  _insSelect(parent, label, options, value, onChange) {
    const row = document.createElement('div');
    row.style.cssText = CSS.row;
    const lab = document.createElement('span');
    lab.textContent = label;
    lab.style.cssText = CSS.label;
    const sel = document.createElement('select');
    sel.style.cssText = CSS.select;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    }
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    row.appendChild(lab);
    row.appendChild(sel);
    parent.appendChild(row);
    return sel;
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  async _saveToDisk() {
    const shipId = this._currentShipId;
    const data = this._working();
    this._showStatus('Saving…', '#fa6');
    try {
      const res = await fetch('/dev/save-ship-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId, data }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        delete this._dirty[shipId];
        this._showStatus(`✓ Saved src/data/shipSlots/${shipId}.json`, '#4fa');
      } else {
        this._showStatus(`✗ ${json.error || 'Server error'}`, '#f66');
      }
    } catch (e) {
      this._showStatus(`✗ Could not reach dev server: ${e.message}`, '#f66');
    }
  }

  _copyJson() {
    const payload = JSON.stringify(this._working(), null, 2);
    navigator.clipboard.writeText(payload)
      .then(() => this._showStatus('✓ Copied JSON to clipboard', '#4fa'))
      .catch(() => this._showStatus('✗ Clipboard access denied', '#f66'));
  }

  _showStatus(text, color = '#9ab') {
    if (!this._statusEl) return;
    this._statusEl.textContent = text;
    this._statusEl.style.color = color;
  }
}

function _deepClone(v) { return JSON.parse(JSON.stringify(v)); }
function _round(v, p) { const k = Math.pow(10, p); return Math.round(v * k) / k; }
function _mkBtn(text, style) {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = style;
  return b;
}
