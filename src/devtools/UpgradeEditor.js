/**
 * In-game upgrade node editor (DEV only).
 * Opens with Ctrl+Shift+U. Lets you compose a new node, preview it as JSON,
 * add it to the live tree immediately, and persist it to upgrades.json via
 * the Vite dev server plugin at POST /dev/save-upgrades.
 *
 * References to TechTreeState and TechTreeUI are passed as getter functions
 * so the editor stays valid across new-game resets.
 */

import upgradesData from '../data/upgrades.json';

const CURRENCY_LIST  = ['scrapMetal', 'plasmaCrystals', 'bioEssence', 'darkMatter', 'stellarDust'];
const CURRENCY_ICONS = { scrapMetal: '⚙', plasmaCrystals: '◆', bioEssence: '✦', darkMatter: '◉', stellarDust: '★' };
const CATEGORIES     = ['weapon', 'defense', 'utility', 'passive', 'special'];
const MAIN_CATS      = ['weapon', 'defense', 'utility', 'passive'];
const RARITIES       = ['', 'common', 'uncommon', 'rare', 'epic', 'legendary'];
const EFFECT_TYPES   = ['multiply', 'add', 'add_flat', 'add_weapon', 'special', 'set', 'toggle', 'min', 'max'];
const TARGETS        = ['', 'enemy', 'currency', 'round'];
const SCALE_MODES    = ['', 'exponential', 'linear', 'fixed', 'diminishing'];
const ENEMY_TYPES    = ['all', 'scout', 'tank', 'swarm', 'sniper', 'boss'];
const ENEMY_FIELDS   = ['hpMult', 'damageMult', 'speedMult', 'damageReceivedMult'];

const PLAYER_STATS = [
  'maxHp', 'damage', 'attackSpeed', 'projectileCount', 'projectileSpeed',
  'critChance', 'critMultiplier', 'maxShieldHp', 'shieldRegen', 'hpRegen',
  'armor', 'speed', 'magnetRange', 'lootMultiplier', 'stellarDustRate',
  'projectileType', 'hasDrone', 'hasAutoFire', 'hasVampire', 'hasDamageReflect', 'hasOvercharge', 'isHoming',
  'manualTargetFocusEnabled',
  'manualGunHeatPerShotMult',
  'manualGunOverheatDurationMult',
];
const ROUND_STATS = ['spawnInterval', 'maxConcurrent'];

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

  // Restore previous selection if still valid
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

// ── Inline style tokens ──────────────────────────────────────────────────────

const CSS = {
  overlay:    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;font-family:Courier New,monospace;',
  panel:      'background:#0d0d1a;border:1px solid #334;border-radius:8px;display:flex;flex-direction:column;width:940px;max-width:96vw;max-height:92vh;overflow:hidden;',
  header:     'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111827;border-bottom:1px solid #334;flex-shrink:0;',
  title:      'color:#7df;font-size:13px;font-weight:bold;letter-spacing:2px;',
  closeBtn:   'background:none;border:1px solid #556;color:#aaa;cursor:pointer;font-size:18px;width:28px;height:28px;border-radius:4px;line-height:1;padding:0;',
  body:       'display:flex;flex:1;overflow:hidden;',
  left:       'flex:1;overflow-y:auto;padding:16px;border-right:1px solid #223;',
  right:      'width:300px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;',
  secTitle:   'color:#7df;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #223;',
  row:        'display:flex;align-items:center;gap:6px;margin-bottom:6px;',
  label:      'color:#8899aa;font-size:11px;min-width:76px;flex-shrink:0;',
  input:      'background:#060610;border:1px solid #334;border-radius:3px;color:#cde;font-size:12px;padding:4px 7px;flex:1;font-family:inherit;',
  select:     'background:#060610;border:1px solid #334;border-radius:3px;color:#cde;font-size:12px;padding:3px 5px;flex:1;',
  textarea:   'background:#060610;border:1px solid #334;border-radius:3px;color:#cde;font-size:12px;padding:5px 7px;flex:1;font-family:inherit;resize:vertical;min-height:52px;',
  smallBtn:   'background:#0e1826;border:1px solid #446;color:#9ab;cursor:pointer;font-size:11px;padding:3px 8px;border-radius:3px;font-family:inherit;',
  addBtn:     'background:#0a2a10;border:1px solid #2a7a4a;color:#5fb;cursor:pointer;font-size:13px;padding:9px;border-radius:4px;font-family:inherit;font-weight:bold;width:100%;margin-top:10px;',
  effectBox:  'background:#070712;border:1px solid #223;border-radius:4px;padding:8px;margin-bottom:6px;',
  prereqBox:  'background:#050510;border:1px solid #223;border-radius:3px;max-height:110px;overflow-y:auto;padding:4px;',
  prereqItem: 'display:flex;align-items:center;gap:6px;padding:2px 4px;',
  preview:    'background:#040408;border:1px solid #223;border-radius:3px;color:#6ad;font-size:10px;padding:8px;white-space:pre;overflow:auto;max-height:300px;flex-shrink:0;font-family:Courier New,monospace;',
  chip:       'display:inline-block;background:#111827;border:1px solid #446;border-radius:3px;color:#9ab;font-size:10px;padding:2px 6px;margin:2px;',
  errMsg:     'color:#f66;font-size:11px;margin-top:4px;min-height:16px;',
  okMsg:      'color:#4fa;font-size:11px;margin-top:4px;min-height:16px;',
  hint:       'color:#556;font-size:10px;',
};

// ── Helper: create DOM element ───────────────────────────────────────────────

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

function row(parent, labelText, inputEl) {
  const r = el('div', { style: CSS.row });
  if (labelText) r.appendChild(el('span', { style: CSS.label, textContent: labelText }));
  r.appendChild(inputEl);
  parent.appendChild(r);
  return inputEl;
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

// ── Main class ───────────────────────────────────────────────────────────────

export class UpgradeEditor {
  /**
   * @param {()=>import('../techtree/TechTreeState.js').TechTreeState} getTree
   * @param {()=>import('../ui/TechTreeUI.js').TechTreeUI} getUI
   * @param {()=>void} onRebuildComputed
   */
  constructor(getTree, getUI, onRebuildComputed) {
    this._getTree = getTree;
    this._getUI   = getUI;
    this._onRebuildComputed = onRebuildComputed;

    this._isOpen = false;
    this._editingId = null; // null = new node; string = editing existing
    this._selectedPrereqs = new Set();
    this._effectDataList  = []; // [{type, stat, value, statLabel, target, scaleMode}] per effect row
    this._addedThisSession = [];

    this._overlay = this._buildDOM();
    document.body.appendChild(this._overlay);
  }

  toggle() { this._isOpen ? this.close() : this.open(); }

  open() {
    this._isOpen = true;
    this._overlay.style.display = 'flex';
    this._refreshNodeSelect();
    this._refreshPrereqList();
    this._updatePreview();
  }

  close() {
    this._isOpen = false;
    this._overlay.style.display = 'none';
  }

  // ── DOM construction ───────────────────────────────────────────────────────

  _buildDOM() {
    const overlay = el('div', { style: CSS.overlay });
    overlay.style.display = 'none';
    // Click outside panel = close
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });

    const panel = el('div', { style: CSS.panel });
    overlay.appendChild(panel);

    // Header
    const header = el('div', { style: CSS.header });
    header.appendChild(el('span', { style: CSS.title, textContent: '⬡ UPGRADE EDITOR  [DEV]' }));
    const hint = el('span', { style: CSS.hint, textContent: 'Ctrl+Shift+U to toggle' });
    header.appendChild(hint);
    const closeBtn = el('button', { style: CSS.closeBtn, textContent: '×' });
    closeBtn.onclick = () => this.close();
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body
    const body = el('div', { style: CSS.body });
    panel.appendChild(body);
    body.appendChild(this._buildLeft());
    body.appendChild(this._buildRight());

    return overlay;
  }

  _buildLeft() {
    const left = el('div', { style: CSS.left });

    // ── Node selector ───────────────────────────────────────────────────────
    left.appendChild(secTitle('Select Node'));
    const selRow = el('div', { style: CSS.row });
    this._nodeSelect = el('select', { style: CSS.select });
    this._nodeSelect.onchange = () => this._onNodeSelectChange();
    selRow.appendChild(this._nodeSelect);
    const newBtn = el('button', { style: CSS.smallBtn, textContent: '+ New' });
    newBtn.onclick = () => { this._nodeSelect.value = ''; this._clearForm(); };
    selRow.appendChild(newBtn);
    left.appendChild(selRow);

    // ── Basic info ──────────────────────────────────────────────────────────
    left.appendChild(secTitle('Basic Info'));

    this._idInput = row(left, 'ID', inputEl('text', 'e.g. power_cell'));
    this._idInput.oninput = () => {
      // Auto-format: lowercase, spaces→underscores
      const pos = this._idInput.selectionStart;
      this._idInput.value = this._idInput.value.toLowerCase().replace(/\s+/g, '_');
      this._idInput.setSelectionRange(pos, pos);
      this._validateId();
      this._updatePreview();
    };
    this._idError = el('div', { style: CSS.errMsg });
    left.appendChild(this._idError);

    this._catSelect = row(left, 'Category', selectEl(CATEGORIES));
    this._nameInput = row(left, 'Name', inputEl('text', 'Display name'));
    this._descInput = row(left, 'Description', el('textarea', { style: CSS.textarea, placeholder: 'Node description...' }));
    this._iconInput = row(left, 'Icon', inputEl('text', '⬡'));
    this._iconInput.style.maxWidth = '70px';
    this._maxLvlInput = row(left, 'Max Level', inputEl('number', '1', '1'));
    this._maxLvlInput.style.maxWidth = '70px';
    this._maxLvlInput.min = '1';

    // betweenCategories — only visible for specials
    left.appendChild(secTitle('Diagonal (special only)'));
    this._btwnRow = el('div', { style: CSS.row });
    this._btwnA = selectEl(MAIN_CATS);
    this._btwnB = selectEl(MAIN_CATS);
    this._btwnB.value = 'defense';
    this._btwnRow.appendChild(el('span', { style: CSS.label, textContent: 'Between' }));
    this._btwnRow.appendChild(this._btwnA);
    this._btwnRow.appendChild(el('span', { style: 'color:#556;padding:0 4px;font-size:11px;', textContent: '|' }));
    this._btwnRow.appendChild(this._btwnB);
    left.appendChild(this._btwnRow);
    this._btwnRow.style.display = 'none';

    this._catSelect.onchange = () => {
      this._btwnRow.style.display = this._catSelect.value === 'special' ? '' : 'none';
      this._updatePreview();
    };

    // ── Prerequisites ───────────────────────────────────────────────────────
    left.appendChild(secTitle('Prerequisites'));
    this._prereqBox = el('div', { style: CSS.prereqBox });
    left.appendChild(this._prereqBox);

    // ── Base cost ───────────────────────────────────────────────────────────
    left.appendChild(secTitle('Base Cost'));
    this._costContainer = el('div');
    left.appendChild(this._costContainer);
    const addCostBtn = el('button', { style: CSS.smallBtn, textContent: '+ Add Currency' });
    addCostBtn.onclick = () => this._addCostRow();
    left.appendChild(addCostBtn);

    // ── Effects ─────────────────────────────────────────────────────────────
    left.appendChild(secTitle('Effects'));
    this._effectContainer = el('div');
    left.appendChild(this._effectContainer);
    const addFxBtn = el('button', { style: CSS.smallBtn, textContent: '+ Add Effect' });
    addFxBtn.onclick = () => this._addEffectRow();
    left.appendChild(addFxBtn);

    // ── Presentation ────────────────────────────────────────────────────────
    left.appendChild(secTitle('Presentation (optional)'));
    this._raritySelect = row(left, 'Rarity', selectEl(RARITIES));
    this._badgeInput   = row(left, 'Badge', inputEl('text', 'e.g. DMG'));
    this._badgeInput.style.maxWidth = '70px';
    this._flavorInput  = row(left, 'Flavor', el('textarea', { style: CSS.textarea, placeholder: 'Flavor text...' }));

    // ── Submit ──────────────────────────────────────────────────────────────
    this._statusMsg = el('div', { style: CSS.errMsg });
    left.appendChild(this._statusMsg);
    this._submitBtn = el('button', { style: CSS.addBtn, textContent: '＋  Add Node to Tree & Save' });
    this._submitBtn.onclick = () => this._submit();
    left.appendChild(this._submitBtn);

    // Live preview on all basic fields
    [this._catSelect, this._nameInput, this._descInput, this._iconInput,
     this._maxLvlInput, this._raritySelect, this._badgeInput, this._flavorInput,
     this._btwnA, this._btwnB,
    ].forEach(inp => {
      inp.addEventListener('input',  () => this._updatePreview());
      inp.addEventListener('change', () => this._updatePreview());
    });

    // Default: one effect row
    this._addEffectRow();

    return left;
  }

  _buildRight() {
    const right = el('div', { style: CSS.right });

    right.appendChild(secTitle('Node Preview'));
    this._preview = el('pre', { style: CSS.preview, textContent: '{}' });
    right.appendChild(this._preview);

    right.appendChild(secTitle('Added This Session'));
    this._sessionList = el('div', { style: 'min-height:24px;' });
    this._sessionList.appendChild(el('span', { style: CSS.hint, textContent: 'None yet.' }));
    right.appendChild(this._sessionList);

    this._saveStatus = el('div', { style: CSS.hint });
    right.appendChild(this._saveStatus);

    return right;
  }

  // ── Dynamic rows ───────────────────────────────────────────────────────────

  _addCostRow(currency = '', amount = '') {
    const r = el('div', { style: CSS.row });

    const sel = selectEl(CURRENCY_LIST.map(c => `${CURRENCY_ICONS[c] || ''} ${c}`));
    // Store raw currency key in value
    sel.innerHTML = '';
    CURRENCY_LIST.forEach(c => sel.appendChild(el('option', { value: c, textContent: `${CURRENCY_ICONS[c] || ''} ${c}` })));
    if (currency) sel.value = currency;
    sel.style.flex = '0 0 140px';

    const num = inputEl('number', 'Amount', amount);
    num.min = '1';
    num.style.flex = '0 0 80px';

    const rem = el('button', { style: CSS.smallBtn, textContent: '✕' });
    rem.onclick = () => { r.remove(); this._updatePreview(); };

    r.appendChild(sel);
    r.appendChild(num);
    r.appendChild(rem);

    sel.onchange = () => this._updatePreview();
    num.oninput  = () => this._updatePreview();

    this._costContainer.appendChild(r);
    this._updatePreview();
  }

  _addEffectRow(effect = {}) {
    const refs = {};
    const wrap = el('div', { style: CSS.effectBox });

    // Row 1: type + remove
    const r1 = el('div', { style: CSS.row });
    r1.appendChild(el('span', { style: CSS.label, textContent: 'Type' }));
    refs.type = selectEl(EFFECT_TYPES);
    if (effect.type) refs.type.value = effect.type;
    r1.appendChild(refs.type);
    const rem = el('button', { style: `${CSS.smallBtn}flex:0;`, textContent: '✕' });
    rem.onclick = () => {
      wrap.remove();
      const i = this._effectDataList.indexOf(refs);
      if (i !== -1) this._effectDataList.splice(i, 1);
      this._updatePreview();
    };
    r1.appendChild(rem);
    wrap.appendChild(r1);

    // Row 2: stat
    const r2 = el('div', { style: CSS.row });
    r2.appendChild(el('span', { style: CSS.label, textContent: 'Stat' }));
    refs.stat = el('select', { style: CSS.select });
    populateStatSelect(refs.stat, effect.target || '');
    if (effect.stat) refs.stat.value = effect.stat;
    r2.appendChild(refs.stat);
    wrap.appendChild(r2);

    // Row 3: value + label
    const r3 = el('div', { style: CSS.row });
    r3.appendChild(el('span', { style: CSS.label, textContent: 'Value' }));
    refs.value = inputEl('text', '1.15 or laser', effect.value != null ? String(effect.value) : '');
    refs.value.style.flex = '0 0 90px';
    r3.appendChild(refs.value);
    r3.appendChild(el('span', { style: `${CSS.label}margin-left:8px;min-width:48px;`, textContent: 'Label' }));
    refs.statLabel = inputEl('text', 'Display label', effect.statLabel || '');
    r3.appendChild(refs.statLabel);
    wrap.appendChild(r3);

    // Row 4: target + scaleMode
    const r4 = el('div', { style: CSS.row });
    r4.appendChild(el('span', { style: CSS.label, textContent: 'Target' }));
    refs.target = selectEl(TARGETS);
    if (effect.target) refs.target.value = effect.target;
    refs.target.addEventListener('change', () => {
      populateStatSelect(refs.stat, refs.target.value);
      this._updatePreview();
    });
    r4.appendChild(refs.target);
    r4.appendChild(el('span', { style: `${CSS.label}margin-left:8px;min-width:48px;`, textContent: 'Scale' }));
    refs.scaleMode = selectEl(SCALE_MODES);
    if (effect.scaleMode) refs.scaleMode.value = effect.scaleMode;
    r4.appendChild(refs.scaleMode);
    wrap.appendChild(r4);

    Object.values(refs).forEach(inp => {
      inp.addEventListener('input',  () => this._updatePreview());
      inp.addEventListener('change', () => this._updatePreview());
    });

    this._effectDataList.push(refs);
    this._effectContainer.appendChild(wrap);
    this._updatePreview();
  }

  // ── Prereq list ─────────────────────────────────────────────────────────────

  _refreshPrereqList() {
    this._prereqBox.innerHTML = '';
    const tree = this._getTree();
    const allNodes = tree
      ? [...upgradesData.nodes, ...(tree.devExtraNodes || [])]
      : upgradesData.nodes;

    // Group by category
    const byCategory = {};
    for (const n of allNodes) {
      (byCategory[n.category] = byCategory[n.category] || []).push(n);
    }

    for (const cat of CATEGORIES) {
      const nodes = byCategory[cat];
      if (!nodes?.length) continue;

      this._prereqBox.appendChild(
        el('div', { style: 'color:#445;font-size:9px;text-transform:uppercase;padding:3px 4px;letter-spacing:1px;', textContent: cat })
      );
      for (const n of nodes) {
        const item = el('div', { style: CSS.prereqItem });
        const cb = el('input', { type: 'checkbox', value: n.id });
        cb.checked = this._selectedPrereqs.has(n.id);
        cb.onchange = () => {
          cb.checked ? this._selectedPrereqs.add(n.id) : this._selectedPrereqs.delete(n.id);
          this._updatePreview();
        };
        const lbl = el('label', { style: 'color:#8ab;font-size:11px;cursor:pointer;flex:1;', textContent: n.id });
        lbl.onclick = () => { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); };
        const nameLbl = el('span', { style: 'color:#445;font-size:10px;', textContent: n.name });
        item.appendChild(cb);
        item.appendChild(lbl);
        item.appendChild(nameLbl);
        this._prereqBox.appendChild(item);
      }
    }
  }

  // ── Node selector helpers ──────────────────────────────────────────────────

  _allNodeData() {
    const tree = this._getTree();
    const devIds = new Set((tree?.devExtraNodes || []).map(n => n.id));
    // Base nodes (not overridden) + dev extras
    const base = upgradesData.nodes.filter(n => !devIds.has(n.id));
    return [...base, ...(tree?.devExtraNodes || [])];
  }

  _refreshNodeSelect() {
    const current = this._nodeSelect.value;
    this._nodeSelect.innerHTML = '';
    this._nodeSelect.appendChild(el('option', { value: '', textContent: '— new node —' }));

    const byCategory = {};
    for (const n of this._allNodeData()) {
      (byCategory[n.category] = byCategory[n.category] || []).push(n);
    }
    for (const cat of CATEGORIES) {
      const nodes = byCategory[cat];
      if (!nodes?.length) continue;
      const g = document.createElement('optgroup');
      g.label = cat;
      nodes.forEach(n => g.appendChild(el('option', { value: n.id, textContent: `${n.id}  —  ${n.name}` })));
      this._nodeSelect.appendChild(g);
    }

    // Restore selection if still valid
    if (current && [...this._nodeSelect.options].some(o => o.value === current)) {
      this._nodeSelect.value = current;
    }
  }

  _onNodeSelectChange() {
    const id = this._nodeSelect.value;
    if (!id) { this._clearForm(); return; }
    const nodeData = this._allNodeData().find(n => n.id === id);
    if (nodeData) this._loadNode(nodeData);
  }

  _loadNode(nodeData) {
    this._editingId = nodeData.id;

    this._idInput.value      = nodeData.id;
    this._idInput.readOnly   = true;
    this._idInput.style.opacity = '0.5';
    this._catSelect.value    = nodeData.category;
    this._nameInput.value    = nodeData.name || '';
    this._descInput.value    = nodeData.description || '';
    this._iconInput.value    = nodeData.icon || '';
    this._maxLvlInput.value  = nodeData.maxLevel ?? 1;

    // betweenCategories
    if (nodeData.category === 'special') {
      this._btwnRow.style.display = '';
      if (nodeData.betweenCategories?.length === 2) {
        this._btwnA.value = nodeData.betweenCategories[0];
        this._btwnB.value = nodeData.betweenCategories[1];
      }
    } else {
      this._btwnRow.style.display = 'none';
    }

    // Prereqs
    this._selectedPrereqs = new Set(nodeData.prereqs || []);
    this._refreshPrereqList();

    // Base cost
    this._costContainer.innerHTML = '';
    for (const [currency, amount] of Object.entries(nodeData.baseCost || {})) {
      this._addCostRow(currency, String(amount));
    }

    // Effects
    this._effectContainer.innerHTML = '';
    this._effectDataList = [];
    for (const effect of (nodeData.effects || [])) {
      this._addEffectRow(effect);
    }
    if (!nodeData.effects?.length) this._addEffectRow();

    // Presentation
    this._raritySelect.value   = nodeData.presentation?.rarity || '';
    this._badgeInput.value     = nodeData.presentation?.badge || '';
    this._flavorInput.value    = nodeData.presentation?.flavorText || '';

    this._submitBtn.textContent = '✎  Update Node & Save';
    this._idError.textContent = '';
    this._statusMsg.textContent = '';
    this._updatePreview();
  }

  _clearForm() {
    this._editingId = null;
    this._idInput.value     = '';
    this._idInput.readOnly  = false;
    this._idInput.style.opacity = '1';
    this._nameInput.value   = '';
    this._descInput.value   = '';
    this._iconInput.value   = '';
    this._maxLvlInput.value = '1';
    this._catSelect.value   = 'weapon';
    this._btwnRow.style.display = 'none';
    this._selectedPrereqs.clear();
    this._refreshPrereqList();
    this._costContainer.innerHTML = '';
    this._effectContainer.innerHTML = '';
    this._effectDataList = [];
    this._addEffectRow();
    this._raritySelect.value  = '';
    this._badgeInput.value    = '';
    this._flavorInput.value   = '';
    this._submitBtn.textContent = '＋  Add Node to Tree & Save';
    this._idError.textContent = '';
    this._statusMsg.textContent = '';
    this._updatePreview();
  }

  // ── Build node object from form ────────────────────────────────────────────

  _buildNode() {
    const id       = this._idInput.value.trim();
    const category = this._catSelect.value;
    const name     = this._nameInput.value.trim();
    const desc     = this._descInput.value.trim();
    const icon     = this._iconInput.value.trim() || '⬡';
    const maxLevel = Math.max(1, parseInt(this._maxLvlInput.value, 10) || 1);
    const prereqs  = [...this._selectedPrereqs];

    // Base cost
    const baseCost = {};
    for (const r of this._costContainer.children) {
      const sel = r.querySelector('select');
      const num = r.querySelector('input[type="number"]');
      if (sel && num) {
        const amt = parseInt(num.value, 10);
        if (amt > 0) baseCost[sel.value] = amt;
      }
    }

    // Effects
    const effects = [];
    for (const refs of this._effectDataList) {
      const typeV = refs.type.value;
      const statV = refs.stat.value.trim();
      const valRaw = refs.value.value.trim();

      // Parse value appropriately per type
      let value;
      if (typeV === 'add_weapon') {
        value = valRaw || 'laser';
      } else if (typeV === 'special') {
        value = valRaw === 'false' ? false : valRaw === 'true' ? true : (valRaw || true);
      } else if (typeV === 'toggle') {
        value = true;
      } else {
        value = parseFloat(valRaw);
        if (isNaN(value)) continue; // skip incomplete rows
      }

      if (!typeV || (!statV && typeV !== 'add_weapon')) continue;

      const effect = { type: typeV, stat: statV, value };
      if (refs.statLabel.value.trim()) effect.statLabel = refs.statLabel.value.trim();
      if (refs.target.value)          effect.target = refs.target.value;
      if (refs.scaleMode.value)       effect.scaleMode = refs.scaleMode.value;
      effects.push(effect);
    }

    const node = { id, category, name, description: desc, icon, maxLevel, baseCost, effects };
    if (prereqs.length) node.prereqs = prereqs;
    if (category === 'special') node.betweenCategories = [this._btwnA.value, this._btwnB.value];

    const pres = {};
    if (this._raritySelect.value) pres.rarity = this._raritySelect.value;
    if (this._badgeInput.value.trim()) pres.badge = this._badgeInput.value.trim();
    if (this._flavorInput.value.trim()) pres.flavorText = this._flavorInput.value.trim();
    if (Object.keys(pres).length) node.presentation = pres;

    return node;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  _validateId() {
    const id = this._idInput.value.trim();
    if (!id) { this._idError.textContent = ''; return null; }
    // In edit mode the ID is locked — uniqueness check is irrelevant
    if (this._editingId === id) { this._idError.textContent = ''; return null; }
    if (this._allNodeData().find(n => n.id === id)) {
      this._idError.textContent = `✗ ID "${id}" already exists`;
      return `ID "${id}" already exists.`;
    }
    this._idError.textContent = '';
    return null;
  }

  _validate(node) {
    if (!node.id)               return 'ID is required.';
    const idErr = this._validateId();
    if (idErr)                  return idErr;
    if (!node.name)             return 'Name is required.';
    if (!node.effects.length)   return 'At least one complete effect is required.';
    return null;
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  _updatePreview() {
    if (!this._preview) return;
    try {
      const node = this._buildNode();
      this._preview.textContent = JSON.stringify(node, null, 2);
    } catch {
      this._preview.textContent = '(invalid form state)';
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async _submit() {
    const node = this._buildNode();
    const err  = this._validate(node);
    if (err) {
      this._statusMsg.style.cssText = CSS.errMsg;
      this._statusMsg.textContent = '✗ ' + err;
      return;
    }

    const isEditing = !!this._editingId;
    this._statusMsg.style.cssText = CSS.errMsg;
    this._statusMsg.style.color = '#fa6';
    this._statusMsg.textContent = isEditing ? 'Updating node...' : 'Adding node...';

    // Apply to live tree
    const tree = this._getTree();
    if (tree) {
      if (isEditing) {
        tree.updateDevNode(this._editingId, node);
      } else {
        tree.addDevNode(node);
      }
      this._onRebuildComputed();
      this._getUI()?.render();
    }

    if (!isEditing) {
      this._addedThisSession.push(node.id);
      this._renderSessionList();
    }

    // Refresh node selector and prereq list
    this._refreshNodeSelect();
    this._refreshPrereqList();

    // Save to disk
    await this._saveToDisk(tree);

    if (!isEditing) {
      // Clear transient fields after adding a new node (keep category/rarity for rapid iteration)
      this._nodeSelect.value = '';
      this._clearForm();
    } else {
      // Keep form loaded with updated node; re-select it in the dropdown
      this._nodeSelect.value = node.id;
      this._statusMsg.style.color = '#4fa';
    }
  }

  async _saveToDisk(tree) {
    const devIds = new Set((tree?.devExtraNodes || []).map(n => n.id));
    const allNodes = [
      ...upgradesData.nodes.filter(n => !devIds.has(n.id)),
      ...((tree?.devExtraNodes) || []),
    ];
    const payload = JSON.stringify(
      { categories: upgradesData.categories, nodes: allNodes },
      null, 2
    );

    try {
      const res = await fetch('/dev/save-upgrades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.ok) {
        this._statusMsg.style.color = '#4fa';
        this._statusMsg.textContent = '✓ Saved to src/data/upgrades.json';
        this._saveStatus.textContent = `Last save: ${new Date().toLocaleTimeString()}`;
      } else {
        this._statusMsg.style.color = '#f66';
        this._statusMsg.textContent = '✗ Server returned error — check Vite console';
      }
    } catch {
      this._statusMsg.style.color = '#f66';
      this._statusMsg.textContent = '✗ Could not reach dev server endpoint';
    }
  }

  _renderSessionList() {
    this._sessionList.innerHTML = '';
    if (!this._addedThisSession.length) {
      this._sessionList.appendChild(el('span', { style: CSS.hint, textContent: 'None yet.' }));
      return;
    }
    for (const id of this._addedThisSession) {
      this._sessionList.appendChild(el('span', { style: CSS.chip, textContent: id }));
    }
  }
}
