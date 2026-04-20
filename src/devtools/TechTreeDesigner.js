/**
 * Tech Tree Designer — standalone dev-only page at /dev/techtreedesigner
 *
 * Renders the tech tree on a canvas (force-directed layout) with full edit capabilities:
 * - Click a node → edit its properties in the right panel
 * - Drag to move nodes; Shift+drag for prerequisites; Alt+drag to reorder JSON node order
 * - Alt+click a dashed edge to remove that prerequisite
 * - Green + at graph center adds a new node (default weapon branch; edit in panel)
 * - Save directly to src/data/upgrades.json via the Vite dev server plugin
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';
import upgradesData from '../data/upgrades.json';
import { TechTreeGenerator } from '../techtree/TechTreeGenerator.js';
import { TECH_TREE } from '../constants.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_LIST  = ['credits', 'scrapMetal', 'plasmaCrystals', 'bioEssence', 'darkMatter', 'stellarDust'];
const CURRENCY_ICONS = { credits: '⬡', scrapMetal: '⚙', plasmaCrystals: '◆', bioEssence: '✦', darkMatter: '◉', stellarDust: '★' };
const CATEGORIES     = ['weapon', 'defense', 'utility', 'passive', 'special'];
const MAIN_CATS      = ['weapon', 'defense', 'utility', 'passive'];
const RARITIES       = ['', 'common', 'uncommon', 'rare', 'epic', 'legendary'];
const EFFECT_TYPES   = ['multiply', 'add', 'add_flat', 'add_weapon', 'special', 'set', 'toggle', 'min', 'max'];
const TARGETS        = ['', 'enemy', 'currency', 'round'];
const SCALE_MODES    = ['', 'exponential', 'linear', 'fixed', 'diminishing'];
const ENEMY_TYPES    = ['all', 'scout', 'tank', 'swarm', 'sniper', 'boss'];
const ENEMY_FIELDS   = ['hpMult', 'damageMult', 'speedMult', 'damageReceivedMult'];
const PLAYER_STATS   = [
  'maxHp', 'damage', 'attackSpeed', 'projectileCount', 'projectileSpeed',
  'critChance', 'critMultiplier', 'maxShieldHp', 'shieldRegen', 'hpRegen',
  'armor', 'speed', 'magnetRange', 'lootMultiplier', 'stellarDustRate',
  'projectileType', 'hasDrone', 'hasAutoFire', 'hasVampire', 'hasDamageReflect', 'hasOvercharge',
  'isHoming', 'manualTargetFocusEnabled', 'manualGunHeatPerShotMult', 'manualGunOverheatDurationMult',
  'visionRange', 'targetingRange',
];
const ROUND_STATS    = ['spawnInterval', 'maxConcurrent'];

const CAT_COLORS = {
  weapon:  '#ff4444',
  defense: '#4488ff',
  utility: '#ffcc00',
  passive: '#44ff88',
  special: '#cc44ff',
};

const NODE_W        = TECH_TREE.NODE_W;
const NODE_H        = TECH_TREE.NODE_H;
const NODE_MAIN_R   = 22;
const NODE_HIT_R    = 34;
/** World-space + control at graph origin */
const CENTER_NEW_NODE_BTN_R = 16;
const CENTER_RADIUS = TECH_TREE.CENTER_RADIUS;
const RING_SPACING  = TECH_TREE.RING_SPACING;
const BRANCH_SLICE_RAD = TECH_TREE.BRANCH_SLICE_RAD;

/** Pinned hub radius for starter_* nodes in the force simulation */
const FORCE_STARTER_PIN_R = CENTER_RADIUS * 0.35;
const FORCE_ALPHA_MIN       = 1e-3;
/** Total simulation.tick() calls allowed per layout run (safety cap). */
const FORCE_TICK_BUDGET_MAX = 6000;
/** Max distance (world) from a prereq edge segment to count as a click hit */
const EDGE_HIT_DIST = 14;

const TECH_DESIGNER_CAMERA_KEY = 'infiniteAliens_techDesigner_camera';

// Inline style tokens (same palette as UpgradeEditor)
const CSS = {
  btn:       'background:#0e1826;border:1px solid #446;color:#9ab;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:3px;font-family:Courier New,monospace;',
  btnGreen:  'background:#0a2a10;border:1px solid #2a7a4a;color:#5fb;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:3px;font-family:Courier New,monospace;',
  btnRed:    'background:#1a0a0a;border:1px solid #7a2a2a;color:#f66;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:3px;font-family:Courier New,monospace;',
  secTitle:  'color:#7df;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #223;',
  row:       'display:flex;align-items:center;gap:6px;margin-bottom:6px;',
  label:     'color:#8899aa;font-size:11px;min-width:76px;flex-shrink:0;',
  input:     'background:#060610;border:1px solid #334;border-radius:3px;color:#cde;font-size:12px;padding:4px 7px;flex:1;font-family:Courier New,monospace;',
  select:    'background:#060610;border:1px solid #334;border-radius:3px;color:#cde;font-size:12px;padding:3px 5px;flex:1;',
  textarea:  'background:#060610;border:1px solid #334;border-radius:3px;color:#cde;font-size:12px;padding:5px 7px;flex:1;font-family:Courier New,monospace;resize:vertical;min-height:52px;',
  effectBox: 'background:#070712;border:1px solid #223;border-radius:4px;padding:8px;margin-bottom:6px;',
  addBtn:    'background:#0a2a10;border:1px solid #2a7a4a;color:#5fb;cursor:pointer;font-size:13px;padding:9px;border-radius:4px;font-family:Courier New,monospace;font-weight:bold;width:100%;margin-top:10px;',
  hint:      'color:#445;font-size:10px;',
};

// ─── Module helpers ───────────────────────────────────────────────────────────

function el(tag, props = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'style') e.style.cssText = v;
    else e[k] = v;
  }
  return e;
}

function secTitle(text) {
  return el('div', { style: CSS.secTitle, textContent: text });
}

function inputEl(type, placeholder = '', value = '') {
  return el('input', { type, style: CSS.input, placeholder, value });
}

function selectEl(options) {
  const s = el('select', { style: CSS.select });
  options.forEach(o => {
    const opt = el('option', { value: o, textContent: o || '(none)' });
    s.appendChild(opt);
  });
  return s;
}

function rowEl(parent, labelText, input) {
  const r = el('div', { style: CSS.row });
  if (labelText) r.appendChild(el('span', { style: CSS.label, textContent: labelText }));
  r.appendChild(input);
  parent.appendChild(r);
  return input;
}

function populateStatSelect(sel, target) {
  const prev = sel.value;
  sel.innerHTML = '';
  const addGroup = (label, opts) => {
    const g = document.createElement('optgroup');
    g.label = label;
    opts.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      g.appendChild(o);
    });
    sel.appendChild(g);
  };
  if (!target || target === 'player') {
    addGroup('Player', PLAYER_STATS);
  } else if (target === 'enemy') {
    for (const type of ENEMY_TYPES) {
      addGroup(type, ENEMY_FIELDS.map(f => `${type}.${f}`));
    }
  } else if (target === 'currency') {
    addGroup('Loot Drop', CURRENCY_LIST.map(c => `loot.${c}`));
    addGroup('Passive Income', CURRENCY_LIST.map(c => `passive.${c}`));
  } else if (target === 'round') {
    addGroup('Round', ROUND_STATS);
  }
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

// Duplicated from TechTreeGenerator (module-private there)
const STARTER_ANCHORS_MAP = {
  weapon:  -Math.PI / 2,
  defense:  0,
  utility:  Math.PI / 2,
  passive:  Math.PI,
};
const DIAGONAL_KEYS = ['weapon|defense', 'defense|utility', 'utility|passive', 'passive|weapon'];

function areAdjacentCategories(a, b) {
  const pairs = new Set([
    'weapon|defense', 'defense|weapon', 'defense|utility', 'utility|defense',
    'utility|passive', 'passive|utility', 'passive|weapon', 'weapon|passive',
  ]);
  return pairs.has(`${a}|${b}`);
}

function canonicalDiagonalKey(catA, catB) {
  if (!catA || !catB || !areAdjacentCategories(catA, catB)) return null;
  const pair = `${catA}|${catB}`;
  const rev  = `${catB}|${catA}`;
  if (DIAGONAL_KEYS.includes(pair)) return pair;
  if (DIAGONAL_KEYS.includes(rev))  return rev;
  return null;
}

function angleMidpointBetweenCategories(catA, catB) {
  const ax = STARTER_ANCHORS_MAP[catA] ?? 0;
  const bx = STARTER_ANCHORS_MAP[catB] ?? 0;
  const vx = Math.cos(ax) + Math.cos(bx);
  const vy = Math.sin(ax) + Math.sin(bx);
  if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) return ax;
  return Math.atan2(vy, vx);
}

function anglesInBranchSlice(anchorAngle, count, sliceRad) {
  if (count <= 0) return [];
  if (count === 1) return [anchorAngle];
  const lo = anchorAngle - sliceRad / 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(lo + (i / (count - 1)) * sliceRad);
  }
  return out;
}

function normalizeAngleDiff(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return Math.abs(a);
}

function canonicalDiagonalAngle(key) {
  const [a, b] = key.split('|');
  return angleMidpointBetweenCategories(a, b);
}

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny);
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class TechTreeDesigner {
  constructor() {
    // Working data (deep clone of upgradesData, mutated freely)
    this._workingData    = null;
    this._layout         = new Map();   // nodeId → { cx, cy }
    this._generatedNodes = {};          // nodeId → TechNode (for tier/position metadata)
    this._generatorTiers = [];          // tiers[ring] = [nodeId, ...]
    this._dirty          = false;
    this._undoStack      = [];          // JSON string snapshots, max 20

    // Interaction state
    this._selectedNode   = null;        // node data object from _workingData.nodes
    this._hoveredNode    = null;
    this._mode           = 'idle';      // 'idle' | 'pan' | 'node-pressed' | 'node-move' | 'prereq-shift-drag' | 'ring-reorder' | 'edge-pressed'
    this._pressNode      = null;
    this._pressStart     = { x: 0, y: 0 };
    this._mouseClient    = { x: 0, y: 0 };
    this._dragTargetNode = null;

    // Camera
    this._camera         = { x: 0, y: 0, zoom: 1 };
    this._panStart       = null;

    // DOM references (populated by _buildDOM)
    this._canvas         = null;
    this._ctx            = null;
    this._propPanel      = null;
    this._propPanelHint  = null;
    this._dirtyIndicator = null;
    this._statusEl       = null;
    this._statusTimer    = null;

    /** When true, next force layout ignores prior canvas positions (toolbar reset). */
    this._forceLayoutColdStart = false;
    this._forceSimulation = null;
    this._forceSimRaf      = null;
    this._forceTickBudget  = 0;

    /** nodeId → { cx, cy } pinned in the force sim (user-dragged positions) */
    this._manualPositions = new Map();
    /** World offset from pointer to node center while moving a node */
    this._dragNodeOffset   = { x: 0, y: 0 };
    /** Layout snapshot at start of node-move (revert on mouseleave without commit path) */
    this._nodeDragStartPos = null;
    /** { dependentId, prereqId } while waiting for edge click mouseup */
    this._pressedEdge      = null;
    /** When set, this node follows the pointer and stays fixed in the force sim while others keep simulating */
    this._forceDragNodeId  = null;

    this._buildDOM();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  open() {
    this._initWorkingData();
    this._resizeCanvas();
    if (!this._restoreCameraFromSession()) this._centerCamera();
    this._render();
    window.addEventListener('resize', this._onResize = () => {
      this._resizeCanvas();
      this._render();
    });
    window.addEventListener('keydown', this._onKeyDown = e => {
      if (e.ctrlKey && !e.shiftKey && e.code === 'KeyZ') {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        this._undo();
      }
    });
  }

  _initWorkingData() {
    this._workingData = JSON.parse(JSON.stringify(upgradesData));
    this._dirty       = false;
    this._undoStack   = [];
    this._selectedNode = null;
    this._manualPositions.clear();
    this._rebuildLayout();
    this._updateDirtyIndicator();
  }

  _stopForceLayoutLoop() {
    if (this._forceSimRaf != null) {
      cancelAnimationFrame(this._forceSimRaf);
      this._forceSimRaf = null;
    }
    if (this._forceSimulation) {
      this._forceSimulation.stop();
      this._forceSimulation = null;
    }
  }

  _rebuildLayout() {
    this._stopForceLayoutLoop();
    if (this._forceLayoutColdStart) this._manualPositions.clear();
    const gen = new TechTreeGenerator(null, this._workingData.nodes);
    gen.generateUpToTier(999);
    this._generatedNodes = gen.nodes;
    this._generatorTiers = gen.tiers;
    const prevLayout = this._forceLayoutColdStart ? null : new Map(this._layout);
    this._forceTickBudget = 0;
    this._layout = new Map();
    const simulation = this._createForceSimulation(gen, prevLayout);
    this._forceLayoutColdStart = false;
    if (!simulation) return;

    this._forceSimulation = simulation;
    this._syncLayoutFromForceSimulation();
    this._render();
    this._forceSimRaf = requestAnimationFrame(() => this._onForceLayoutFrame());
  }

  /**
   * Builds a d3-force simulation (not ticked). Caller runs `_onForceLayoutFrame`.
   * @param {{ nodes: object }} gen  TechTreeGenerator instance after generateUpToTier
   * @param {Map<string, {cx:number,cy:number}>|null} prevLayout  warm-start positions, or null for polar+jitter seed
   */
  _createForceSimulation(gen, prevLayout) {
    const nodeMap = gen.nodes;
    const ids = Object.keys(nodeMap);
    if (!ids.length) return null;

    const idSet = new Set(ids);
    const jitter = () => (Math.random() - 0.5) * 14;

    const simNodes = ids.map((id) => {
      const techNode = nodeMap[id];
      let x;
      let y;
      if (this._manualPositions.has(id)) {
        const mp = this._manualPositions.get(id);
        x = mp.cx;
        y = mp.cy;
      } else if (prevLayout?.has(id)) {
        const p = prevLayout.get(id);
        x = p.cx;
        y = p.cy;
      } else {
        x = techNode.position.x + NODE_W / 2 + jitter();
        y = techNode.position.y + NODE_H / 2 + jitter();
      }

      const n = { id, x, y, vx: 0, vy: 0 };

      if (id.startsWith('starter_')) {
        const cat = id.slice('starter_'.length);
        const angle = STARTER_ANCHORS_MAP[cat];
        if (angle !== undefined) {
          n.fx = Math.cos(angle) * FORCE_STARTER_PIN_R;
          n.fy = Math.sin(angle) * FORCE_STARTER_PIN_R;
          n.x = n.fx;
          n.y = n.fy;
        }
      } else if (this._manualPositions.has(id)) {
        n.fx = n.x;
        n.fy = n.y;
      }
      return n;
    });

    const links = [];
    for (const nodeData of this._workingData.nodes) {
      const tid = nodeData.id;
      if (!idSet.has(tid)) continue;
      for (const prereqId of nodeData.prereqs || []) {
        if (prereqId === tid) continue;
        if (!idSet.has(prereqId)) continue;
        links.push({ source: prereqId, target: tid });
      }
    }

    return forceSimulation(simNodes)
      .force(
        'link',
        forceLink(links)
          .id((d) => d.id)
          .distance(RING_SPACING * 1.25)
          .strength(0.55),
      )
      .force('charge', forceManyBody().strength(-520))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide(NODE_HIT_R + 6))
      .alphaTarget(0)
      .alpha(1);
  }

  _syncLayoutFromForceSimulation() {
    if (!this._forceSimulation) return;
    for (const n of this._forceSimulation.nodes()) {
      let p = this._layout.get(n.id);
      if (!p) {
        p = {};
        this._layout.set(n.id, p);
      }
      p.cx = n.x;
      p.cy = n.y;
    }
  }

  _pinSimulationNode(id, cx, cy) {
    if (!this._forceSimulation) return;
    const n = this._forceSimulation.nodes().find((d) => d.id === id);
    if (!n) return;
    n.fx = cx;
    n.fy = cy;
    n.x = cx;
    n.y = cy;
    n.vx = 0;
    n.vy = 0;
  }

  _unpinSimulationNode(id) {
    if (!this._forceSimulation) return;
    const n = this._forceSimulation.nodes().find((d) => d.id === id);
    if (!n) return;
    delete n.fx;
    delete n.fy;
    n.vx = 0;
    n.vy = 0;
  }

  /** (Re)start the force sim if it was stopped; warm alpha while interacting. */
  _ensureForceSimulationRunning() {
    if (this._forceSimulation) {
      const sim = this._forceSimulation;
      sim.alpha(Math.max(sim.alpha(), 0.22));
      sim.alphaTarget(0.12);
      if (this._forceSimRaf == null) {
        this._forceSimRaf = requestAnimationFrame(() => this._onForceLayoutFrame());
      }
      return;
    }
    const gen = new TechTreeGenerator(null, this._workingData.nodes);
    gen.generateUpToTier(999);
    this._generatedNodes = gen.nodes;
    this._generatorTiers = gen.tiers;
    this._forceTickBudget = 0;
    const simulation = this._createForceSimulation(gen, new Map(this._layout));
    if (!simulation) return;
    this._forceSimulation = simulation;
    simulation.alphaTarget(0.12);
    this._syncLayoutFromForceSimulation();
    if (this._forceSimRaf == null) {
      this._forceSimRaf = requestAnimationFrame(() => this._onForceLayoutFrame());
    }
  }

  _onForceLayoutFrame() {
    this._forceSimRaf = null;
    const sim = this._forceSimulation;
    if (!sim) return;

    const dragging = this._forceDragNodeId != null;
    if (dragging) {
      const pos = this._layout.get(this._forceDragNodeId);
      if (pos) this._pinSimulationNode(this._forceDragNodeId, pos.cx, pos.cy);
      sim.alphaTarget(0.12);
    } else {
      sim.alphaTarget(0);
    }

    const alpha = sim.alpha();
    const steps = alpha > 0.35 ? 2 : 1;
    for (let s = 0; s < steps; s++) {
      sim.tick();
      if (!dragging) this._forceTickBudget++;
      if (!dragging && sim.alpha() < FORCE_ALPHA_MIN) break;
      if (!dragging && this._forceTickBudget >= FORCE_TICK_BUDGET_MAX) break;
    }

    this._syncLayoutFromForceSimulation();
    this._render();

    const settled = !dragging
      && (sim.alpha() < FORCE_ALPHA_MIN || this._forceTickBudget >= FORCE_TICK_BUDGET_MAX);
    if (settled) {
      sim.stop();
      sim.alphaTarget(0);
      this._forceSimulation = null;
      this._render();
      return;
    }

    this._forceSimRaf = requestAnimationFrame(() => this._onForceLayoutFrame());
  }

  _resizeCanvas() {
    if (!this._canvas) return;
    const wrap = this._canvas.parentElement;
    this._canvas.width  = wrap.offsetWidth;
    this._canvas.height = wrap.offsetHeight;
  }

  _centerCamera() {
    let maxRadius = CENTER_RADIUS;
    for (const pos of this._layout.values()) {
      const r = Math.sqrt(pos.cx * pos.cx + pos.cy * pos.cy);
      if (r > maxRadius) maxRadius = r;
    }
    maxRadius += RING_SPACING * 1.5;
    this._camera.x    = this._canvas.width  / 2;
    this._camera.y    = this._canvas.height / 2;
    const minDim      = Math.min(this._canvas.width, this._canvas.height);
    this._camera.zoom = Math.max(0.1, Math.min(1.2, (minDim * 0.42) / maxRadius));
    this._saveCameraToSession();
  }

  _saveCameraToSession() {
    if (!this._canvas) return;
    try {
      sessionStorage.setItem(
        TECH_DESIGNER_CAMERA_KEY,
        JSON.stringify({
          zoom: this._camera.zoom,
          x:    this._camera.x,
          y:    this._camera.y,
        }),
      );
    } catch {
      /* ignore quota / private mode */
    }
  }

  /** @returns {boolean} true if restored */
  _restoreCameraFromSession() {
    if (!this._canvas) return false;
    try {
      const raw = sessionStorage.getItem(TECH_DESIGNER_CAMERA_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (typeof o.zoom !== 'number' || typeof o.x !== 'number' || typeof o.y !== 'number') return false;
      this._camera.zoom = Math.max(0.05, Math.min(4, o.zoom));
      this._camera.x = o.x;
      this._camera.y = o.y;
      return true;
    } catch {
      return false;
    }
  }

  // ── DOM construction ─────────────────────────────────────────────────────────

  _buildDOM() {
    document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;background:#060018;';

    const root = el('div', {
      style: 'position:fixed;inset:0;display:flex;flex-direction:column;font-family:Courier New,monospace;',
    });

    this._buildToolbar(root);

    const body = el('div', { style: 'display:flex;flex:1;overflow:hidden;' });
    root.appendChild(body);

    this._buildCanvasArea(body);
    this._buildPropertiesPanel(body);

    document.body.appendChild(root);
  }

  _buildToolbar(parent) {
    const bar = el('div', {
      style: 'display:flex;align-items:center;gap:8px;padding:8px 16px;background:#0d0d1a;border-bottom:1px solid #334;flex-shrink:0;height:48px;',
    });

    bar.appendChild(el('span', {
      style: 'color:#7df;font-size:13px;font-weight:bold;letter-spacing:2px;',
      textContent: '⬡ TECH DESIGNER  [DEV]',
    }));

    this._dirtyIndicator = el('span', {
      style: 'color:#fa6;font-size:11px;min-width:110px;',
      textContent: '',
    });
    bar.appendChild(this._dirtyIndicator);

    this._statusEl = el('span', { style: 'font-size:11px;min-width:220px;', textContent: '' });
    bar.appendChild(this._statusEl);

    bar.appendChild(el('div', { style: 'flex:1;' })); // spacer

    const gameLink = el('a', {
      href: '/',
      style: 'color:#556;font-size:11px;text-decoration:none;border:1px solid #334;padding:4px 10px;border-radius:3px;',
      textContent: '← game',
    });
    bar.appendChild(gameLink);

    this._undoBtn = el('button', { style: CSS.btn, textContent: '↩ Undo', title: 'Ctrl+Z' });
    this._undoBtn.onclick = () => this._undo();
    bar.appendChild(this._undoBtn);

    const resetLayoutBtn = el('button', {
      style: CSS.btn,
      textContent: '⟲ Reset layout',
      title: 'Re-seed positions from the radial generator and re-run the force simulation',
    });
    resetLayoutBtn.onclick = () => {
      try {
        sessionStorage.removeItem(TECH_DESIGNER_CAMERA_KEY);
      } catch {
        /* ignore */
      }
      this._forceLayoutColdStart = true;
      this._rebuildLayout();
      this._centerCamera();
      this._render();
      this._showStatusMsg('Layout reset', '#9ab');
    };
    bar.appendChild(resetLayoutBtn);

    this._saveBtn = el('button', { style: CSS.btnGreen, textContent: '💾 Save' });
    this._saveBtn.onclick = () => this._saveToDisk();
    bar.appendChild(this._saveBtn);

    const copyBtn = el('button', { style: CSS.btn, textContent: '[ ] Copy JSON' });
    copyBtn.onclick = () => this._copyJSON();
    bar.appendChild(copyBtn);

    parent.appendChild(bar);
  }

  _buildCanvasArea(parent) {
    const wrap = el('div', {
      style: 'flex:0 0 70%;position:relative;overflow:hidden;background:#060018;',
    });

    this._canvas = el('canvas', { style: 'display:block;cursor:grab;' });
    this._ctx    = this._canvas.getContext('2d');
    wrap.appendChild(this._canvas);

    // Hover tooltip for node names
    this._hoverTooltip = el('div', {
      style: 'position:absolute;pointer-events:none;background:#0d0d1a;border:1px solid #334;color:#cde;font-size:11px;padding:4px 8px;border-radius:3px;display:none;white-space:nowrap;z-index:10;',
    });
    wrap.appendChild(this._hoverTooltip);

    parent.appendChild(wrap);
    this._setupInteraction();
  }

  _buildPropertiesPanel(parent) {
    const panel = el('div', {
      style: 'flex:0 0 30%;overflow-y:auto;background:#0d0d1a;border-left:1px solid #334;display:flex;flex-direction:column;',
    });

    this._propPanel     = el('div', { style: 'flex:1;padding:16px;' });
    this._propPanelHint = el('div', {
      style: 'color:#445;font-size:12px;margin-top:40px;text-align:center;line-height:1.8;',
      innerHTML: 'Click a node to edit its properties.<br><span style="font-size:10px;color:#334;">Drag a node to move it<br>Shift+drag onto another node, release with Shift: add that node as a prereq<br>Alt+click a dashed edge to remove that prereq<br>Alt+drag: reorder <code style="color:#556;">nodes</code> array (in-game radial slot order; not visible in this force view)<br>Green + at graph center adds a node (default weapon; change category in the panel)</span>',
    });
    this._propPanel.appendChild(this._propPanelHint);
    panel.appendChild(this._propPanel);

    parent.appendChild(panel);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────────

  _render() {
    const ctx  = this._ctx;
    const { width, height } = this._canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#060018';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(this._camera.x, this._camera.y);
    ctx.scale(this._camera.zoom, this._camera.zoom);

    this._drawCenterHub(ctx);
    this._drawConnections(ctx);
    this._drawNodes(ctx);
    this._drawCenterNewNodeButton(ctx);

    if (this._mode === 'prereq-shift-drag' || this._mode === 'ring-reorder') {
      this._drawDragLine(ctx);
    }

    ctx.restore();
  }

  _drawCenterHub(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0020';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,245,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  _drawConnections(ctx) {
    const drawn = new Set();
    for (const nodeData of this._workingData.nodes) {
      const to = this._layout.get(nodeData.id);
      if (!to) continue;
      for (const prereqId of (nodeData.prereqs || [])) {
        const from = this._layout.get(prereqId);
        if (!from) continue;
        const key = nodeData.id < prereqId
          ? `${nodeData.id}|${prereqId}`
          : `${prereqId}|${nodeData.id}`;
        if (drawn.has(key)) continue;
        drawn.add(key);

        const isRelatedToSelected = this._selectedNode &&
          (nodeData.id === this._selectedNode.id || prereqId === this._selectedNode.id);

        ctx.beginPath();
        ctx.moveTo(from.cx, from.cy);
        ctx.lineTo(to.cx, to.cy);
        ctx.strokeStyle = isRelatedToSelected ? 'rgba(0,245,255,0.8)' : 'rgba(0,245,255,0.25)';
        ctx.lineWidth   = isRelatedToSelected ? 2 : 1.4;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        this._drawArrowhead(ctx, from.cx, from.cy, to.cx, to.cy,
          isRelatedToSelected ? 'rgba(0,245,255,0.9)' : 'rgba(0,245,255,0.4)');
      }
    }
  }

  _drawArrowhead(ctx, fx, fy, tx, ty, color = 'rgba(0,245,255,0.5)') {
    const angle = Math.atan2(ty - fy, tx - fx);
    const tip   = NODE_MAIN_R + 2;
    const ax    = tx - Math.cos(angle) * tip;
    const ay    = ty - Math.sin(angle) * tip;
    const size  = 7;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - size * Math.cos(angle - 0.4), ay - size * Math.sin(angle - 0.4));
    ctx.lineTo(ax - size * Math.cos(angle + 0.4), ay - size * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  _drawNodes(ctx) {
    for (const nodeData of this._workingData.nodes) {
      const pos = this._layout.get(nodeData.id);
      if (!pos) continue;
      this._drawSingleNode(ctx, nodeData, pos);
    }
  }

  _drawSingleNode(ctx, nodeData, pos) {
    const { cx, cy } = pos;
    const color       = CAT_COLORS[nodeData.category] || '#888888';
    const isSelected  = this._selectedNode?.id  === nodeData.id;
    const isTarget    = this._dragTargetNode?.id === nodeData.id;
    const isOrigin    = this._pressNode?.id      === nodeData.id &&
                        (this._mode === 'node-move' || this._mode === 'prereq-shift-drag');

    // Fill
    ctx.beginPath();
    ctx.arc(cx, cy, NODE_MAIN_R, 0, Math.PI * 2);
    ctx.fillStyle = isTarget   ? 'rgba(0,255,100,0.22)'
                  : isSelected ? `${color}33`
                  : 'rgba(20,10,40,0.9)';
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(cx, cy, NODE_MAIN_R, 0, Math.PI * 2);
    ctx.strokeStyle = isTarget   ? '#00ff64'
                    : isSelected ? '#ffffff'
                    : isOrigin   ? `${color}88`
                    : color;
    ctx.lineWidth   = isSelected ? 3 : isTarget ? 2.5 : 1.5;
    ctx.stroke();

    // Icon
    const iconSize = Math.round(NODE_MAIN_R * 0.9);
    ctx.font         = `${iconSize}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = isOrigin ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)';
    ctx.fillText(nodeData.icon || '?', cx, cy);

    // Tier badge (tiny ring number in corner)
    const tier = this._generatedNodes[nodeData.id]?.tier;
    if (tier !== undefined) {
      ctx.font = '8px Courier New,monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`r${tier}`, cx, cy - NODE_MAIN_R - 3);
    }

    // Name label below
    const label = (nodeData.name || nodeData.id || '').slice(0, 18);
    ctx.font      = '9px Courier New,monospace';
    ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, cx, cy + NODE_MAIN_R + 13);

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawCenterNewNodeButton(ctx) {
    const cx = 0;
    const cy = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER_NEW_NODE_BTN_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8, 24, 16, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,220,100,0.65)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font         = 'bold 17px monospace';
    ctx.fillStyle    = 'rgba(100,220,100,0.9)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', cx, cy);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _drawDragLine(ctx) {
    if (!this._pressNode) return;
    const from = this._layout.get(this._pressNode.id);
    if (!from) return;
    const mouse = this._screenToWorld(this._mouseClient.x, this._mouseClient.y);
    ctx.beginPath();
    ctx.moveTo(from.cx, from.cy);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = this._mode === 'prereq-shift-drag' ? '#00ff88'
                    : this._mode === 'ring-reorder'      ? '#aa88ff'
                    : 'rgba(255,200,0,0.6)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Camera ────────────────────────────────────────────────────────────────────

  _screenToWorld(sx, sy) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (sx - rect.left  - this._camera.x) / this._camera.zoom,
      y: (sy - rect.top   - this._camera.y) / this._camera.zoom,
    };
  }

  // ── Interaction ───────────────────────────────────────────────────────────────

  _setupInteraction() {
    const canvas = this._canvas;

    canvas.addEventListener('mousedown',  e => this._onMouseDown(e));
    canvas.addEventListener('mousemove',  e => this._onMouseMove(e));
    canvas.addEventListener('mouseup',    e => this._onMouseUp(e));
    canvas.addEventListener('mouseleave', () => {
      if (this._mode === 'node-move' && this._pressNode && this._nodeDragStartPos) {
        const id = this._pressNode.id;
        const p = this._layout.get(id);
        if (p) {
          p.cx = this._nodeDragStartPos.cx;
          p.cy = this._nodeDragStartPos.cy;
        }
        if (this._forceSimulation) {
          this._unpinSimulationNode(id);
          const sn = this._forceSimulation.nodes().find((d) => d.id === id);
          if (sn) {
            sn.x = this._nodeDragStartPos.cx;
            sn.y = this._nodeDragStartPos.cy;
            sn.vx = 0;
            sn.vy = 0;
          }
          this._forceSimulation.alphaTarget(0);
        }
        this._forceDragNodeId = null;
        if (this._forceSimulation && this._forceSimRaf == null) {
          this._forceSimRaf = requestAnimationFrame(() => this._onForceLayoutFrame());
        }
      }
      this._hoveredNode = null;
      this._updateHoverTooltip(null, 0, 0);
      if (this._mode === 'pan') {
        this._mode = 'idle';
        canvas.style.cursor = 'grab';
      } else if (
        this._mode === 'node-move'
        || this._mode === 'prereq-shift-drag'
        || this._mode === 'ring-reorder'
        || this._mode === 'edge-pressed'
        || this._mode === 'node-pressed'
      ) {
        this._mode = 'idle';
        this._pressNode = null;
        this._dragTargetNode = null;
        this._pressedEdge = null;
        this._nodeDragStartPos = null;
        canvas.style.cursor = 'grab';
        this._render();
      }
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zd  = e.deltaY > 0 ? 0.9 : 1.1;
      const nz  = Math.max(0.05, Math.min(4, this._camera.zoom * zd));
      const rect = canvas.getBoundingClientRect();
      const mx  = e.clientX - rect.left;
      const my  = e.clientY - rect.top;
      this._camera.x = mx - (mx - this._camera.x) * (nz / this._camera.zoom);
      this._camera.y = my - (my - this._camera.y) * (nz / this._camera.zoom);
      this._camera.zoom = nz;
      this._saveCameraToSession();
      this._render();
    }, { passive: false });
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this._pressStart  = { x: e.clientX, y: e.clientY };
    this._mouseClient = { x: e.clientX, y: e.clientY };

    const world = this._screenToWorld(e.clientX, e.clientY);

    // Nodes first (so a node on top of the hub wins over the center +)
    const nodeHit = this._hitTestNode(world.x, world.y);
    if (nodeHit) {
      this._mode      = 'node-pressed';
      this._pressNode = nodeHit;
      this._canvas.style.cursor = nodeHit.id.startsWith('starter_') ? 'crosshair' : 'grab';
      return;
    }

    if (this._hitTestCenterNewNodeBtn(world.x, world.y)) {
      this._addNewNode();
      return;
    }

    if (e.altKey) {
      const edgeHit = this._hitTestEdge(world.x, world.y);
      if (edgeHit) {
        this._mode        = 'edge-pressed';
        this._pressedEdge = edgeHit;
        this._canvas.style.cursor = 'pointer';
        return;
      }
    }

    // Empty space → pan
    this._mode     = 'pan';
    this._panStart = { x: e.clientX - this._camera.x, y: e.clientY - this._camera.y };
    this._canvas.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    this._mouseClient = { x: e.clientX, y: e.clientY };

    if (this._mode === 'pan') {
      this._camera.x = e.clientX - this._panStart.x;
      this._camera.y = e.clientY - this._panStart.y;
      this._render();
      return;
    }

    if (this._mode === 'node-pressed') {
      const moved = Math.hypot(e.clientX - this._pressStart.x, e.clientY - this._pressStart.y);
      if (moved > 5) {
        if (e.altKey) {
          this._mode = 'ring-reorder';
        } else if (e.shiftKey) {
          this._mode = 'prereq-shift-drag';
        } else if (this._pressNode && !this._pressNode.id.startsWith('starter_')) {
          this._mode = 'node-move';
          this._forceDragNodeId = this._pressNode.id;
          this._ensureForceSimulationRunning();
          const w0 = this._screenToWorld(this._pressStart.x, this._pressStart.y);
          const pos = this._layout.get(this._pressNode.id);
          if (pos) {
            this._dragNodeOffset = { x: w0.x - pos.cx, y: w0.y - pos.cy };
            this._nodeDragStartPos = { cx: pos.cx, cy: pos.cy };
          }
        } else {
          this._mode = 'pan';
          this._panStart = { x: e.clientX - this._camera.x, y: e.clientY - this._camera.y };
          this._pressNode = null;
          this._canvas.style.cursor = 'grabbing';
        }
      }
    }

    if (this._mode === 'node-move' && this._pressNode) {
      if (!this._forceSimulation) this._ensureForceSimulationRunning();
      const world = this._screenToWorld(e.clientX, e.clientY);
      const pos = this._layout.get(this._pressNode.id);
      if (pos) {
        pos.cx = world.x - this._dragNodeOffset.x;
        pos.cy = world.y - this._dragNodeOffset.y;
        this._pinSimulationNode(this._pressNode.id, pos.cx, pos.cy);
      }
      this._updateHoverTooltip(null, 0, 0);
      this._render();
      return;
    }

    if (this._mode === 'prereq-shift-drag' || this._mode === 'ring-reorder') {
      const world = this._screenToWorld(e.clientX, e.clientY);
      const hit   = this._hitTestNode(world.x, world.y);
      // Don't highlight a drop target during ring-reorder (position is determined by drop angle, not target node)
      this._dragTargetNode = (this._mode !== 'ring-reorder' && hit && hit.id !== this._pressNode?.id) ? hit : null;
      this._updateHoverTooltip(null, 0, 0);
      this._render();
      return;
    }

    // Idle hover — update tooltip
    const world = this._screenToWorld(e.clientX, e.clientY);
    const hit   = this._hitTestNode(world.x, world.y);
    if (hit !== this._hoveredNode) {
      this._hoveredNode = hit;
      if (hit) {
        const rect = this._canvas.getBoundingClientRect();
        this._updateHoverTooltip(hit, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        this._updateHoverTooltip(null, 0, 0);
      }
    }
  }

  _onMouseUp(e) {
    if (e.button !== 0) return;
    const wasPan = this._mode === 'pan';
    const moved  = Math.hypot(e.clientX - this._pressStart.x, e.clientY - this._pressStart.y);
    const world  = this._screenToWorld(e.clientX, e.clientY);
    const target = this._dragTargetNode;
    const origin = this._pressNode;

    if (this._mode === 'edge-pressed' && this._pressedEdge) {
      if (moved < 5 && e.altKey) this._removePrereqEdge(this._pressedEdge);
    } else if (this._mode === 'node-pressed' && moved < 5) {
      if (origin) this._selectNode(origin);
      else        this._clearSelection();
    } else if (this._mode === 'prereq-shift-drag' && target && origin && e.shiftKey) {
      this._addPrereq(origin, target);
    } else if (this._mode === 'ring-reorder') {
      this._reorderInRing(origin, world.x, world.y);
    } else if (this._mode === 'node-move' && origin) {
      const pos = this._layout.get(origin.id);
      if (pos) this._manualPositions.set(origin.id, { cx: pos.cx, cy: pos.cy });
      if (this._forceSimulation) this._forceSimulation.alphaTarget(0);
    }

    this._mode           = 'idle';
    this._forceDragNodeId = null;
    this._pressNode      = null;
    this._dragTargetNode = null;
    this._pressedEdge    = null;
    this._nodeDragStartPos = null;
    this._canvas.style.cursor = 'grab';
    if (wasPan) this._saveCameraToSession();
    this._render();
  }

  _hitTestNode(wx, wy) {
    // Iterate in reverse so topmost-rendered nodes get priority
    for (let i = this._workingData.nodes.length - 1; i >= 0; i--) {
      const nd  = this._workingData.nodes[i];
      const pos = this._layout.get(nd.id);
      if (!pos) continue;
      const dx = wx - pos.cx;
      const dy = wy - pos.cy;
      if (dx * dx + dy * dy <= NODE_HIT_R * NODE_HIT_R) return nd;
    }
    return null;
  }

  _hitTestCenterNewNodeBtn(wx, wy) {
    const dx = wx;
    const dy = wy;
    return dx * dx + dy * dy <= CENTER_NEW_NODE_BTN_R * CENTER_NEW_NODE_BTN_R;
  }

  /** Closest prereq edge within hit tolerance (world, scales with zoom); prereq → dependent. */
  _hitTestEdge(wx, wy) {
    const maxD = EDGE_HIT_DIST / Math.max(0.12, this._camera.zoom);
    let best = null;
    let bestD = maxD + 1;
    for (const nodeData of this._workingData.nodes) {
      const to = this._layout.get(nodeData.id);
      if (!to) continue;
      for (const prereqId of nodeData.prereqs || []) {
        const from = this._layout.get(prereqId);
        if (!from) continue;
        const d = distPointToSegment(wx, wy, from.cx, from.cy, to.cx, to.cy);
        if (d < bestD && d <= maxD) {
          bestD = d;
          best = { dependentId: nodeData.id, prereqId };
        }
      }
    }
    return best;
  }

  _updateHoverTooltip(node, canvasX, canvasY) {
    if (!node) {
      this._hoverTooltip.style.display = 'none';
      return;
    }
    const tier = this._generatedNodes[node.id]?.tier ?? '?';
    this._hoverTooltip.textContent = `${node.icon || ''} ${node.name || node.id}  [${node.category} r${tier}]`;
    this._hoverTooltip.style.display  = 'block';
    this._hoverTooltip.style.left     = `${canvasX + 12}px`;
    this._hoverTooltip.style.top      = `${canvasY + 12}px`;
  }

  _getBranchAnchorAngle(nodeData) {
    if (nodeData.category !== 'special') {
      return STARTER_ANCHORS_MAP[nodeData.category] ?? 0;
    }
    return angleMidpointBetweenCategories(
      nodeData.betweenCategories?.[0],
      nodeData.betweenCategories?.[1],
    );
  }

  // ── Selection ─────────────────────────────────────────────────────────────────

  _selectNode(nodeData) {
    this._selectedNode = nodeData;
    this._populatePropertiesPanel(nodeData);
    this._render();
  }

  _clearSelection() {
    this._selectedNode = null;
    this._clearPropertiesPanel();
    this._render();
  }

  // ── Properties panel ──────────────────────────────────────────────────────────

  _clearPropertiesPanel() {
    this._propPanel.innerHTML = '';
    this._propPanel.appendChild(this._propPanelHint);
  }

  _populatePropertiesPanel(nodeData) {
    const panel = this._propPanel;
    panel.innerHTML = '';

    const refs = {
      effectRows:    [],   // array of effect ref objects
      costRows:      [],   // array of { currencySelect, amtInput }
      prereqSet:     new Set(nodeData.prereqs || []),
      prereqChipsEl: null,
    };

    // ── Node identity ─────────────────────────────────────────────────────────
    panel.appendChild(secTitle('Identity'));

    refs.idInput = rowEl(panel, 'ID', inputEl('text', 'node_id', nodeData.id || ''));
    refs.idInput.oninput = () => {
      const pos = refs.idInput.selectionStart;
      refs.idInput.value = refs.idInput.value.toLowerCase().replace(/\s+/g, '_');
      refs.idInput.setSelectionRange(pos, pos);
    };

    refs.nameInput  = rowEl(panel, 'Name',    inputEl('text', 'Display name', nodeData.name || ''));
    refs.iconInput  = rowEl(panel, 'Icon',    inputEl('text', '⬡', nodeData.icon || ''));
    refs.iconInput.style.maxWidth = '60px';

    const lvlRow = el('div', { style: CSS.row });
    lvlRow.appendChild(el('span', { style: CSS.label, textContent: 'Max Level' }));
    refs.maxLvlInput = inputEl('number', '1', String(nodeData.maxLevel ?? 1));
    refs.maxLvlInput.min = '1';
    refs.maxLvlInput.style.maxWidth = '60px';
    lvlRow.appendChild(refs.maxLvlInput);
    panel.appendChild(lvlRow);

    refs.catSelect = rowEl(panel, 'Category', selectEl(CATEGORIES));
    refs.catSelect.value = nodeData.category || 'weapon';

    // betweenCategories for specials
    const btwnRow = el('div', { style: CSS.row });
    btwnRow.appendChild(el('span', { style: CSS.label, textContent: 'Between' }));
    refs.btwnA = selectEl(MAIN_CATS);
    refs.btwnB = selectEl(MAIN_CATS);
    refs.btwnB.value = 'defense';
    if (nodeData.betweenCategories?.length === 2) {
      refs.btwnA.value = nodeData.betweenCategories[0];
      refs.btwnB.value = nodeData.betweenCategories[1];
    }
    btwnRow.appendChild(refs.btwnA);
    btwnRow.appendChild(el('span', { style: 'color:#445;padding:0 4px;font-size:11px;', textContent: '|' }));
    btwnRow.appendChild(refs.btwnB);
    panel.appendChild(btwnRow);

    const toggleBtwnRow = () => {
      btwnRow.style.display = refs.catSelect.value === 'special' ? '' : 'none';
    };
    refs.catSelect.onchange = toggleBtwnRow;
    toggleBtwnRow();

    // ── Description ───────────────────────────────────────────────────────────
    panel.appendChild(secTitle('Description'));
    refs.descInput = rowEl(panel, null, el('textarea', {
      style: CSS.textarea,
      placeholder: 'Node description...',
    }));
    refs.descInput.value = nodeData.description || '';

    // ── Prerequisites ─────────────────────────────────────────────────────────
    panel.appendChild(secTitle('Prerequisites'));
    const prereqNote = el('div', {
      style: 'color:#445;font-size:10px;margin-bottom:6px;',
      textContent: 'Shift+drag onto another node and release with Shift to add a prereq; Alt+click a dashed edge to remove one; or edit chips below.',
    });
    panel.appendChild(prereqNote);

    refs.prereqChipsEl = el('div', { style: 'display:flex;flex-wrap:wrap;min-height:28px;margin-bottom:6px;' });
    panel.appendChild(refs.prereqChipsEl);

    const refreshPrereqChips = () => {
      refs.prereqChipsEl.innerHTML = '';
      for (const pid of refs.prereqSet) {
        const chip = el('span', {
          style: 'display:inline-flex;align-items:center;gap:3px;background:#111827;border:1px solid #446;border-radius:3px;color:#9ab;font-size:10px;padding:2px 5px;margin:2px;cursor:default;',
        });
        chip.appendChild(el('span', { textContent: pid }));
        const x = el('button', {
          style: 'background:none;border:none;color:#f66;cursor:pointer;font-size:12px;padding:0 2px;line-height:1;',
          textContent: '✕',
        });
        x.onclick = () => { refs.prereqSet.delete(pid); refreshPrereqChips(); };
        chip.appendChild(x);
        refs.prereqChipsEl.appendChild(chip);
      }
      if (refs.prereqSet.size === 0) {
        refs.prereqChipsEl.appendChild(el('span', { style: 'color:#334;font-size:10px;', textContent: 'none' }));
      }
    };
    refreshPrereqChips();
    refs._refreshPrereqChips = refreshPrereqChips;

    // ── Base cost ─────────────────────────────────────────────────────────────
    panel.appendChild(secTitle('Base Cost'));
    refs.costContainer = el('div');
    panel.appendChild(refs.costContainer);

    const addCostRow = (currency = '', amount = '') => {
      const r   = el('div', { style: CSS.row });
      const sel = el('select', { style: CSS.select + 'flex:0 0 140px;' });
      sel.innerHTML = '';
      CURRENCY_LIST.forEach(c => {
        sel.appendChild(el('option', { value: c, textContent: `${CURRENCY_ICONS[c] || ''} ${c}` }));
      });
      if (currency) sel.value = currency;

      const num = inputEl('number', 'Amount', amount);
      num.min   = '1';
      num.style.flex = '0 0 80px';

      const rem = el('button', { style: CSS.btn + 'padding:3px 6px;', textContent: '✕' });
      rem.onclick = () => {
        r.remove();
        refs.costRows.splice(refs.costRows.indexOf(costRef), 1);
      };

      r.appendChild(sel);
      r.appendChild(num);
      r.appendChild(rem);
      refs.costContainer.appendChild(r);

      const costRef = { currencySelect: sel, amtInput: num };
      refs.costRows.push(costRef);
    };

    for (const [currency, amount] of Object.entries(nodeData.baseCost || {})) {
      addCostRow(currency, String(amount));
    }

    const addCostBtn = el('button', { style: CSS.btn + 'margin-top:4px;', textContent: '+ Add Currency' });
    addCostBtn.onclick = () => addCostRow();
    panel.appendChild(addCostBtn);

    // ── Effects ───────────────────────────────────────────────────────────────
    panel.appendChild(secTitle('Effects'));
    refs.effectContainer = el('div');
    panel.appendChild(refs.effectContainer);

    const addEffect = (effect = {}) => {
      this._buildEffectRow(refs.effectContainer, refs.effectRows, effect);
    };

    for (const effect of (nodeData.effects || [])) {
      addEffect(effect);
    }
    if (!nodeData.effects?.length) addEffect();

    const addFxBtn = el('button', { style: CSS.btn + 'margin-top:4px;', textContent: '+ Add Effect' });
    addFxBtn.onclick = () => addEffect();
    panel.appendChild(addFxBtn);

    // ── Presentation ──────────────────────────────────────────────────────────
    panel.appendChild(secTitle('Presentation (optional)'));
    refs.raritySelect = rowEl(panel, 'Rarity', selectEl(RARITIES));
    refs.raritySelect.value = nodeData.presentation?.rarity || '';

    refs.badgeInput = rowEl(panel, 'Badge', inputEl('text', 'e.g. DMG', nodeData.presentation?.badge || ''));
    refs.badgeInput.style.maxWidth = '70px';

    refs.flavorInput = rowEl(panel, 'Flavor', el('textarea', {
      style: CSS.textarea,
      placeholder: 'Flavor text...',
    }));
    refs.flavorInput.value = nodeData.presentation?.flavorText || '';

    // ── Actions ───────────────────────────────────────────────────────────────
    panel.appendChild(el('div', { style: 'height:8px;' }));

    const applyBtn = el('button', { style: CSS.addBtn, textContent: '✓ Apply Changes' });
    applyBtn.onclick = () => this._applyPanelChanges(nodeData, refs);
    panel.appendChild(applyBtn);

    const deleteBtn = el('button', { style: CSS.btnRed + 'margin-top:6px;width:100%;', textContent: '✕ Delete Node' });
    deleteBtn.onclick = () => this._deleteNode(nodeData);
    panel.appendChild(deleteBtn);

    panel.appendChild(el('div', { style: 'height:24px;' }));
  }

  _buildEffectRow(container, rowsList, effect = {}) {
    const refs = {};
    const wrap = el('div', { style: CSS.effectBox });

    const r1 = el('div', { style: CSS.row });
    r1.appendChild(el('span', { style: CSS.label, textContent: 'Type' }));
    refs.type = selectEl(EFFECT_TYPES);
    if (effect.type) refs.type.value = effect.type;
    r1.appendChild(refs.type);
    const rem = el('button', { style: CSS.btn + 'flex:0;padding:3px 6px;', textContent: '✕' });
    rem.onclick = () => {
      wrap.remove();
      const i = rowsList.indexOf(refs);
      if (i !== -1) rowsList.splice(i, 1);
    };
    r1.appendChild(rem);
    wrap.appendChild(r1);

    const r2 = el('div', { style: CSS.row });
    r2.appendChild(el('span', { style: CSS.label, textContent: 'Stat' }));
    refs.stat = el('select', { style: CSS.select });
    populateStatSelect(refs.stat, effect.target || '');
    if (effect.stat) refs.stat.value = effect.stat;
    r2.appendChild(refs.stat);
    wrap.appendChild(r2);

    const r3 = el('div', { style: CSS.row });
    r3.appendChild(el('span', { style: CSS.label, textContent: 'Value' }));
    refs.value = inputEl('text', '1.15 or laser', effect.value != null ? String(effect.value) : '');
    refs.value.style.flex = '0 0 90px';
    r3.appendChild(refs.value);
    r3.appendChild(el('span', { style: CSS.label + 'margin-left:8px;min-width:48px;', textContent: 'Label' }));
    refs.statLabel = inputEl('text', 'Display label', effect.statLabel || '');
    r3.appendChild(refs.statLabel);
    wrap.appendChild(r3);

    const r4 = el('div', { style: CSS.row });
    r4.appendChild(el('span', { style: CSS.label, textContent: 'Target' }));
    refs.target = selectEl(TARGETS);
    if (effect.target) refs.target.value = effect.target;
    refs.target.addEventListener('change', () => populateStatSelect(refs.stat, refs.target.value));
    r4.appendChild(refs.target);
    r4.appendChild(el('span', { style: CSS.label + 'margin-left:8px;min-width:48px;', textContent: 'Scale' }));
    refs.scaleMode = selectEl(SCALE_MODES);
    if (effect.scaleMode) refs.scaleMode.value = effect.scaleMode;
    r4.appendChild(refs.scaleMode);
    wrap.appendChild(r4);

    rowsList.push(refs);
    container.appendChild(wrap);
  }

  _applyPanelChanges(nodeData, refs) {
    const oldId = nodeData.id;
    const newId = refs.idInput.value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!newId) { this._showStatusMsg('✗ ID cannot be empty', '#f66'); return; }

    // Check ID uniqueness (allow same as current node)
    if (newId !== oldId && this._workingData.nodes.some(n => n.id === newId)) {
      this._showStatusMsg(`✗ ID "${newId}" already in use`, '#f66');
      return;
    }

    this._pushHistory();

    // Find the node in working data
    const nd = this._workingData.nodes.find(n => n.id === oldId);
    if (!nd) { this._showStatusMsg('✗ Node not found', '#f66'); return; }

    // Update ID references in other nodes' prereqs
    if (newId !== oldId) {
      for (const other of this._workingData.nodes) {
        if (other.prereqs) {
          other.prereqs = other.prereqs.map(p => p === oldId ? newId : p);
        }
      }
      nd.id = newId;
    }

    nd.name        = refs.nameInput.value.trim();
    nd.description = refs.descInput.value.trim();
    nd.icon        = refs.iconInput.value.trim() || '⬡';
    nd.maxLevel    = Math.max(1, parseInt(refs.maxLvlInput.value, 10) || 1);
    nd.category    = refs.catSelect.value;

    if (nd.category === 'special') {
      nd.betweenCategories = [refs.btwnA.value, refs.btwnB.value];
    } else {
      delete nd.betweenCategories;
    }

    nd.prereqs = [...refs.prereqSet];

    nd.baseCost = {};
    for (const row of refs.costRows) {
      const amt = parseInt(row.amtInput.value, 10);
      if (amt > 0) nd.baseCost[row.currencySelect.value] = amt;
    }

    nd.effects = [];
    for (const eRefs of refs.effectRows) {
      const typeV  = eRefs.type.value;
      const statV  = eRefs.stat.value.trim();
      const valRaw = eRefs.value.value.trim();

      let value;
      if (typeV === 'add_weapon') {
        value = valRaw || 'laser';
      } else if (typeV === 'special') {
        value = valRaw === 'false' ? false : valRaw === 'true' ? true : (valRaw || true);
      } else if (typeV === 'toggle') {
        value = true;
      } else {
        value = parseFloat(valRaw);
        if (isNaN(value)) continue;
      }

      if (!typeV || (!statV && typeV !== 'add_weapon')) continue;

      const effect = { type: typeV, stat: statV, value };
      if (eRefs.statLabel.value.trim()) effect.statLabel = eRefs.statLabel.value.trim();
      if (eRefs.target.value)           effect.target     = eRefs.target.value;
      if (eRefs.scaleMode.value)        effect.scaleMode  = eRefs.scaleMode.value;
      nd.effects.push(effect);
    }

    const pres = {};
    if (refs.raritySelect.value)          pres.rarity     = refs.raritySelect.value;
    if (refs.badgeInput.value.trim())     pres.badge      = refs.badgeInput.value.trim();
    if (refs.flavorInput.value.trim())    pres.flavorText = refs.flavorInput.value.trim();
    nd.presentation = Object.keys(pres).length ? pres : undefined;

    this._markDirty();
    this._rebuildLayout();

    // Re-select using updated ID
    this._selectedNode = this._workingData.nodes.find(n => n.id === nd.id) || null;
    if (this._selectedNode) {
      this._populatePropertiesPanel(this._selectedNode);
    } else {
      this._clearPropertiesPanel();
    }

    this._render();
    this._showStatusMsg('✓ Changes applied', '#4fa');
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  _pushHistory() {
    this._undoStack.push(JSON.stringify(this._workingData.nodes));
    if (this._undoStack.length > 20) this._undoStack.shift();
  }

  _undo() {
    if (!this._undoStack.length) {
      this._showStatusMsg('Nothing to undo', '#556');
      return;
    }
    this._workingData.nodes = JSON.parse(this._undoStack.pop());
    this._dirty       = true;
    this._selectedNode = null;
    this._rebuildLayout();
    this._clearPropertiesPanel();
    this._updateDirtyIndicator();
    this._render();
    this._showStatusMsg('↩ Undone', '#9ab');
  }

  _addPrereq(originNode, targetNode) {
    if (!originNode || !targetNode || originNode.id === targetNode.id) return;
    this._pushHistory();
    const nd = this._workingData.nodes.find(n => n.id === originNode.id);
    if (!nd) return;
    nd.prereqs = nd.prereqs || [];
    if (!nd.prereqs.includes(targetNode.id)) nd.prereqs.push(targetNode.id);
    this._markDirty();
    this._rebuildLayout();
    if (this._selectedNode?.id === nd.id) {
      this._populatePropertiesPanel(nd);
    }
    this._render();
    this._showStatusMsg(`Prereq added: ${originNode.id} ← ${targetNode.id}`, '#4fa');
  }

  _removePrereqEdge({ dependentId, prereqId }) {
    const nd = this._workingData.nodes.find((n) => n.id === dependentId);
    if (!nd?.prereqs?.length || !nd.prereqs.includes(prereqId)) return;
    this._pushHistory();
    nd.prereqs = nd.prereqs.filter((p) => p !== prereqId);
    this._markDirty();
    this._rebuildLayout();
    if (this._selectedNode?.id === nd.id) {
      this._populatePropertiesPanel(nd);
    }
    this._render();
    this._showStatusMsg(`Removed prereq: ${dependentId} ← ${prereqId}`, '#9ab');
  }

  _reorderInRing(nodeData, dropWx, dropWy) {
    if (!nodeData) return;
    const genNode = this._generatedNodes[nodeData.id];
    if (!genNode) return;
    const targetRing   = genNode.tier;
    const anchorAngle  = this._getBranchAnchorAngle(nodeData);

    // Determine the diagonal key for specials (for same-diagonal grouping)
    const nodeDiagKey = nodeData.category === 'special'
      ? canonicalDiagonalKey(nodeData.betweenCategories?.[0], nodeData.betweenCategories?.[1])
      : null;

    const isSameBranch = (n) => {
      const gn = this._generatedNodes[n.id];
      if (!gn || gn.tier !== targetRing || n.category !== nodeData.category) return false;
      if (nodeData.category === 'special') {
        return canonicalDiagonalKey(n.betweenCategories?.[0], n.betweenCategories?.[1]) === nodeDiagKey;
      }
      return true;
    };

    const ringMates = this._workingData.nodes.filter(isSameBranch);
    if (ringMates.length <= 1) return;

    // Compute desired slot from drop angle
    const dropAngle  = Math.atan2(dropWy, dropWx);
    const slotAngles = anglesInBranchSlice(anchorAngle, ringMates.length, BRANCH_SLICE_RAD);

    let bestSlot = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < slotAngles.length; i++) {
      const diff = normalizeAngleDiff(dropAngle - slotAngles[i]);
      if (diff < bestDiff) { bestDiff = diff; bestSlot = i; }
    }

    const curSlot = ringMates.findIndex(n => n.id === nodeData.id);
    if (curSlot === bestSlot) return;

    this._pushHistory();

    const globalArr = this._workingData.nodes;
    const dragIdx   = globalArr.findIndex(n => n.id === nodeData.id);
    const [dragged] = globalArr.splice(dragIdx, 1);

    // Find remaining ring-mates after splice
    const remainingMates = globalArr.filter(isSameBranch);

    let insertAt;
    if (bestSlot >= remainingMates.length) {
      // After last ring-mate
      const lastMate  = remainingMates[remainingMates.length - 1];
      const lastIdx   = globalArr.lastIndexOf(lastMate);
      insertAt = lastIdx + 1;
    } else {
      insertAt = globalArr.indexOf(remainingMates[bestSlot]);
    }

    globalArr.splice(insertAt, 0, dragged);

    this._markDirty();
    this._rebuildLayout();
    this._render();
  }

  _addNewNode() {
    const category = 'weapon';
    const newNode = {
      id:          `new_${category}_${Date.now()}`,
      category,
      name:        'New Node',
      description: '',
      icon:        '⬡',
      maxLevel:    1,
      baseCost:    {},
      effects:     [],
      prereqs:     [],
    };

    this._pushHistory();
    this._workingData.nodes.push(newNode);
    this._markDirty();
    this._rebuildLayout();
    const fresh = this._workingData.nodes.find((n) => n.id === newNode.id);
    if (fresh) this._selectNode(fresh);
    this._render();
    this._showStatusMsg('New node added (weapon); change branch in the panel if needed', '#4fa');
  }

  _deleteNode(nodeData) {
    if (!confirm(`Delete node "${nodeData.id}"?\nThis will also remove it from other nodes' prerequisite lists.`)) return;
    this._pushHistory();
    this._workingData.nodes = this._workingData.nodes.filter(n => n.id !== nodeData.id);
    for (const n of this._workingData.nodes) {
      if (n.prereqs) n.prereqs = n.prereqs.filter(p => p !== nodeData.id);
    }
    this._markDirty();
    this._rebuildLayout();
    this._clearSelection();
    this._render();
    this._showStatusMsg(`Deleted: ${nodeData.id}`, '#fa6');
  }

  // ── Save / dirty ──────────────────────────────────────────────────────────────

  _markDirty() {
    this._dirty = true;
    this._updateDirtyIndicator();
  }

  _updateDirtyIndicator() {
    if (this._dirtyIndicator) {
      this._dirtyIndicator.textContent = this._dirty ? '● Unsaved changes' : '';
    }
  }

  _showStatusMsg(text, color = '#9ab') {
    if (!this._statusEl) return;
    this._statusEl.textContent    = text;
    this._statusEl.style.color    = color;
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      if (this._statusEl) this._statusEl.textContent = '';
    }, 3000);
  }

  async _saveToDisk() {
    const payload = JSON.stringify(this._workingData, null, 2);
    this._showStatusMsg('Saving…', '#fa6');
    try {
      const res = await fetch('/dev/save-upgrades', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    payload,
      });
      if (res.ok) {
        this._dirty = false;
        this._updateDirtyIndicator();
        this._showStatusMsg('✓ Saved to src/data/upgrades.json', '#4fa');
      } else {
        this._showStatusMsg('✗ Server error — check Vite console', '#f66');
      }
    } catch {
      this._showStatusMsg('✗ Could not reach dev server', '#f66');
    }
  }

  _copyJSON() {
    const payload = JSON.stringify(this._workingData, null, 2);
    navigator.clipboard.writeText(payload)
      .then(() => this._showStatusMsg('✓ Copied to clipboard', '#4fa'))
      .catch(() => this._showStatusMsg('✗ Clipboard access denied', '#f66'));
  }
}
