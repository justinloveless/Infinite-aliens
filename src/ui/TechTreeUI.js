import { TECH_TREE, CURRENCIES, RARITY_META } from '../constants.js';

const SELL_RATIO = TECH_TREE.SELL_REFUND_FRACTION;
import { eventBus, EVENTS } from '../core/EventBus.js';

const NODE_W = TECH_TREE.NODE_W;
const NODE_H = TECH_TREE.NODE_H;
/** Layout keeps NODE_W×NODE_H cells; nodes render as circles centered in each cell. */
const NODE_CX = NODE_W / 2;
const NODE_CY = NODE_H / 2;
const NODE_MAIN_R = 22;
const NODE_LEVEL_ARC_R = 29;
const NODE_LEVEL_ARC_W = 3.25;
const NODE_LEVEL_GAP_RAD = 0.11;
const NODE_HIT_R = 34;

export class TechTreeUI {
  constructor(techTreeState, currencySystem, audioManager) {
    this._tree = techTreeState;
    this._currency = currencySystem;
    this._audio = audioManager;

    this._canvas = document.getElementById('tech-tree-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._tooltip = document.getElementById('node-tooltip');

    this._camera = { x: 0, y: 0, zoom: 1 };
    this._isDragging = false;
    this._dragStart = { x: 0, y: 0 };
    /** Mousedown position (client) for click vs drag; node under press (null = empty). */
    this._pressStart = { x: 0, y: 0 };
    this._pressHitNode = null;
    this._hoveredNode = null;
    /** Last pointer position over the canvas (viewport coords); kept in sync each frame so hover/tooltip survive layout reflow. */
    this._lastClientX = null;
    this._lastClientY = null;
    this._animTime = 0;
    this._visible = false;

    this._setupCanvas();
    this._setupInteraction();

    // Refresh on upgrade purchase
    eventBus.on(EVENTS.UPGRADE_PURCHASED, () => this.render());
    eventBus.on(EVENTS.UPGRADE_SOLD, () => this.render());
    eventBus.on(EVENTS.CURRENCY_CHANGED, () => {
      if (this._visible) this.render();
    });
    eventBus.on(EVENTS.STATS_UPDATED, computed => {
      if (this._visible) this._renderPlayerStats(computed);
    });
  }

  _setupCanvas() {
    const resize = () => {
      const container = document.getElementById('tech-tree-screen');
      const headerH = document.getElementById('tech-tree-header').offsetHeight;
      const currencyH = document.getElementById('tech-tree-currencies').offsetHeight;
      const statsEl = document.getElementById('tech-tree-stats');
      const statsH = statsEl ? statsEl.offsetHeight : 0;
      this._canvas.width = container.offsetWidth;
      this._canvas.height = container.offsetHeight - headerH - currencyH - statsH;
    };
    window.addEventListener('resize', () => { if (this._visible) resize(); });
    this._resizeFn = resize;
  }

  _setupInteraction() {
    const canvas = this._canvas;

    canvas.addEventListener('mouseenter', e => {
      this._lastClientX = e.clientX;
      this._lastClientY = e.clientY;
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const world = this._screenToWorld(e.clientX, e.clientY);
      const hit = this._hitTest(world.x, world.y);
      this._pressStart = { x: e.clientX, y: e.clientY };
      this._pressHitNode = hit;
      this._isDragging = !hit;
      if (this._isDragging) {
        this._dragStart = { x: e.clientX - this._camera.x, y: e.clientY - this._camera.y };
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', e => {
      this._lastClientX = e.clientX;
      this._lastClientY = e.clientY;
      if (this._isDragging) {
        this._camera.x = e.clientX - this._dragStart.x;
        this._camera.y = e.clientY - this._dragStart.y;
        this.render();
      } else {
        const world = this._screenToWorld(e.clientX, e.clientY);
        const hit = this._hitTest(world.x, world.y);
        if (hit !== this._hoveredNode) {
          this._hoveredNode = hit;
          this.render();
          if (hit) {
            this._showTooltip(hit, e.clientX, e.clientY);
            if (this._audio) this._audio.play('hover');
          } else {
            this._hideTooltip();
          }
        } else if (hit) {
          this._moveTooltip(e.clientX, e.clientY);
        }
      }
    });

    canvas.addEventListener('mouseup', e => {
      if (e.button === 0) {
        const moved = Math.hypot(e.clientX - this._pressStart.x, e.clientY - this._pressStart.y);
        if (moved < 5) {
          const world = this._screenToWorld(e.clientX, e.clientY);
          const hit = this._hitTest(world.x, world.y);
          const startedOn = this._pressHitNode;
          if (hit && (!startedOn || hit.id === startedOn.id)) {
            this._purchaseNode(hit);
          }
        }
        this._isDragging = false;
        this._pressHitNode = null;
        canvas.style.cursor = 'grab';
      }
    });

    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (!this._visible) return;
      const world = this._screenToWorld(e.clientX, e.clientY);
      const hit = this._hitTest(world.x, world.y);
      if (hit) this._sellLevel(hit);
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this._lastClientX = e.clientX;
      this._lastClientY = e.clientY;
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.15, Math.min(2.5, this._camera.zoom * zoomDelta));

      // Zoom toward mouse position
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      this._camera.x = mx - (mx - this._camera.x) * (newZoom / this._camera.zoom);
      this._camera.y = my - (my - this._camera.y) * (newZoom / this._camera.zoom);
      this._camera.zoom = newZoom;
      this.render();
    }, { passive: false });

    canvas.addEventListener('mouseleave', e => {
      this._isDragging = false;
      const x = e.clientX;
      const y = e.clientY;
      requestAnimationFrame(() => {
        if (!this._visible) return;
        const r = canvas.getBoundingClientRect();
        if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) {
          return;
        }
        this._lastClientX = null;
        this._lastClientY = null;
        this._hoveredNode = null;
        this._hideTooltip();
      });
    });
  }

  open(state, computed) {
    this._visible = true;
    this._updateCurrencyBar(state);
    this._renderPlayerStats(computed, state);
    this._centerOnFrontier();
    this.render();
  }

  close() {
    this._visible = false;
    this._lastClientX = null;
    this._lastClientY = null;
    this._hideTooltip();
  }

  /** Swap tree state after a full game reset without creating a second UI instance. */
  setTree(techTreeState) {
    this._tree = techTreeState;
    if (this._visible) {
      this._centerOnFrontier();
      this.render();
    }
  }

  _updateCurrencyBar(state) {
    const container = document.getElementById('tech-tree-currencies');
    container.innerHTML = '';
    for (const [key, meta] of Object.entries(CURRENCIES)) {
      const amt = Math.floor(state?.currencies[key] || 0);
      const div = document.createElement('div');
      div.className = 'tree-currency';
      div.id = `tree-amt-${key}`;
      div.style.color = meta.color;
      div.innerHTML = `<span>${meta.icon}</span> <span>${meta.label}: <strong>${this._fmtNum(amt)}</strong></span>`;
      container.appendChild(div);
    }
  }

  updateCurrencyBar(state) {
    if (!this._visible) return;
    for (const [key, meta] of Object.entries(CURRENCIES)) {
      const el = document.getElementById(`tree-amt-${key}`);
      if (el) {
        const amt = Math.floor(state?.currencies[key] || 0);
        el.innerHTML = `<span>${meta.icon}</span> <span>${meta.label}: <strong>${this._fmtNum(amt)}</strong></span>`;
      }
    }
  }

  /**
   * @param {object|null|undefined} computed — from UpgradeSystem.compute
   * @param {object|null|undefined} state — game state (current HP/shield); optional if already stored
   */
  _renderPlayerStats(computed, state) {
    const el = document.getElementById('tech-tree-stats');
    if (!el) return;

    const p = state?.player;
    if (!computed && !p) {
      el.innerHTML = '';
      return;
    }

    const c = computed || {};
    const maxHp = c.maxHp ?? p?.maxHp ?? 0;
    const maxSh = c.maxShieldHp ?? p?.maxShieldHp ?? 0;
    const hpCur = p ? Math.round(p.hp) : Math.round(maxHp);
    const shCur = p ? Math.round(p.shieldHp) : Math.round(maxSh);

    const atkSp = c.attackSpeed > 0 ? c.attackSpeed : 0.6;
    const firePerSec = atkSp > 0 ? 1 / atkSp : 0;

    const rows = [];

    rows.push(['HP', `${hpCur} / ${Math.round(maxHp)}`]);
    if (maxSh > 0) {
      rows.push(['Shield', `${shCur} / ${Math.round(maxSh)}`]);
    }
    rows.push(['Damage', `${Math.round(c.damage ?? p?.damage ?? 0)}`]);
    rows.push(['Fire rate', `${firePerSec.toFixed(2)}/s`]);
    rows.push(['Crit', `${((c.critChance ?? 0) * 100).toFixed(1)}% ×${(c.critMultiplier ?? 2).toFixed(2)}`]);
    rows.push(['Projectiles', `${c.projectileCount ?? 1}`]);
    if ((c.projectilePierces ?? 0) > 0) {
      rows.push(['Pierce', `${c.projectilePierces}`]);
    }
    rows.push(['Proj. speed', `${(c.projectileSpeed ?? 0).toFixed(0)}`]);
    rows.push(['Armor', `${Math.round(c.armor ?? 0)}`]);
    rows.push(['Speed', `${(c.speed ?? 0).toFixed(2)}`]);
    rows.push(['Magnet', `${(c.magnetRange ?? 0).toFixed(1)}`]);
    rows.push(['Loot', `×${(c.lootMultiplier ?? 1).toFixed(2)}`]);
    if ((c.stellarDustRate ?? 0) > 0) {
      rows.push(['Stellar dust', `${(c.stellarDustRate).toFixed(2)}/s`]);
    }

    const pType = c.projectileType || p?.projectileType || 'laser';
    rows.push(['Weapon', `${pType}${c.isHoming ? ' (homing)' : ''}`]);

    const extras = c.extraWeapons?.length ? c.extraWeapons.join(', ') : '';
    if (extras) rows.push(['Extra', extras]);

    const flags = [];
    if (c.hasDrone) flags.push('Drone');
    if (c.hasAutoFire) flags.push('Auto turret');
    if (c.hasVampire) flags.push('Leech');
    if (c.hasDamageReflect) flags.push('Reflect');
    if (c.hasOvercharge) flags.push('Overcharge');
    if (c.manualTargetFocusEnabled) flags.push('Target lock');
    if (flags.length) rows.push(['Traits', flags.join(', ')]);

    if ((c.stellarNovaLevel ?? 0) > 0) {
      rows.push([
        'Stellar nova',
        `Lv${c.stellarNovaLevel} · ${(c.stellarNovaInterval ?? 0).toFixed(1)}s · ${Math.round(c.stellarNovaDamage ?? 0)} dmg`,
      ]);
    }
    if ((c.corrosiveAuraDps ?? 0) > 0) {
      rows.push(['Corrosive aura', `${(c.corrosiveAuraDps).toFixed(1)} DPS`]);
    }
    if ((c.interestRate ?? 0) > 0) {
      rows.push(['Scrap interest', `${((c.interestRate) * 100).toFixed(1)}%/launch`]);
    }

    el.innerHTML = rows
      .map(
        ([label, val]) =>
          `<div class="tree-stat"><span class="tree-stat-label">${label}</span><span class="tree-stat-value">${val}</span></div>`
      )
      .join('');

    if (this._visible && this._resizeFn) this._resizeFn();
  }

  _centerOnFrontier() {
    // Circular layout: place world origin (0,0) at canvas center and
    // auto-zoom so the player's current frontier ring is comfortably visible.
    this._camera.x = this._canvas.width / 2;
    this._camera.y = this._canvas.height / 2;
    const frontierRing = Math.max(1, this._tree.frontier);
    const viewRadius = TECH_TREE.CENTER_RADIUS + (frontierRing + 1) * TECH_TREE.RING_SPACING;
    const minDim = Math.min(this._canvas.width, this._canvas.height);
    this._camera.zoom = Math.max(0.2, Math.min(1.4, (minDim * 0.42) / viewRadius));
  }

  _screenToWorld(sx, sy) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (sx - rect.left - this._camera.x) / this._camera.zoom,
      y: (sy - rect.top - this._camera.y) / this._camera.zoom,
    };
  }

  _nodeCenter(node) {
    const { x, y } = node.position;
    return { cx: x + NODE_CX, cy: y + NODE_CY };
  }

  /** Ring-0 hub nodes (weapon/defense/utility/passive starters). */
  _isStarterNode(node) {
    return node?.tier === 0;
  }

  _hitTest(wx, wy) {
    for (const node of this._tree.getVisibleNodes()) {
      const { cx, cy } = this._nodeCenter(node);
      const dx = wx - cx;
      const dy = wy - cy;
      if (dx * dx + dy * dy <= NODE_HIT_R * NODE_HIT_R) return node;
    }
    return null;
  }

  _purchaseNode(node) {
    if (node.isMaxed) {
      // Attempt mastery purchase instead of regular level-up
      const success = this._tree.purchaseMastery(node.id, this._currency);
      if (success) {
        if (this._audio) this._audio.play('upgrade');
        this.render();
      }
      return;
    }
    const success = this._tree.purchase(node.id, this._currency);
    if (success) {
      if (this._audio) {
        if (node.templateId === 'drone') this._audio.play('droneSpawn');
        else this._audio.play('upgrade');
      }
      this.render();
    }
  }

  _sellLevel(node) {
    if (!node?.isUnlocked) return;
    const success = this._tree.sellOneLevel(node.id, this._currency);
    if (success && this._audio) this._audio.play('pickup');
  }

  /** Re-apply hover + tooltip from last pointer (handles reflow above canvas firing spurious mouseleave). */
  _syncPointerHover() {
    if (this._lastClientX == null || this._lastClientY == null) return;

    const x = this._lastClientX;
    const y = this._lastClientY;
    const r = this._canvas.getBoundingClientRect();
    if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) {
      if (this._hoveredNode) {
        this._hoveredNode = null;
        this._hideTooltip();
      }
      this._lastClientX = null;
      this._lastClientY = null;
      return;
    }

    const world = this._screenToWorld(x, y);
    const hit = this._hitTest(world.x, world.y);
    const hitId = hit?.id ?? null;
    const hoveredId = this._hoveredNode?.id ?? null;

    if (hitId !== hoveredId) {
      this._hoveredNode = hit;
      if (hit) this._showTooltip(hit, x, y);
      else this._hideTooltip();
    } else if (hit) {
      this._moveTooltip(x, y);
    }
  }

  render() {
    if (this._visible && !this._isDragging) {
      this._syncPointerHover();
    }

    const ctx = this._ctx;
    const { width, height } = this._canvas;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#060018';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(this._camera.x, this._camera.y);
    ctx.scale(this._camera.zoom, this._camera.zoom);

    // Center hub marker (anchors the eye on the starter ring)
    this._drawCenterHub(ctx);

    const nodes = this._tree.getVisibleNodes();
    const nodesMap = {};
    for (const n of nodes) nodesMap[n.id] = n;

    // Draw connections first, deduplicated (lateral links are bidirectional
    // so each edge appears in both endpoints' prerequisite lists).
    const drawnEdges = new Set();
    for (const node of nodes) {
      for (const prereqId of node.prerequisites) {
        const prereq = nodesMap[prereqId];
        if (!prereq) continue;
        if (this._isStarterNode(prereq) && this._isStarterNode(node)) continue;
        const key = node.id < prereq.id
          ? `${node.id}|${prereq.id}`
          : `${prereq.id}|${node.id}`;
        if (drawnEdges.has(key)) continue;
        drawnEdges.add(key);
        this._drawConnection(ctx, prereq, node);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      this._drawNode(ctx, node);
    }

    ctx.restore();
  }

  _drawCenterHub(ctx) {
    // Inner hub ring with gentle synthwave glow
    ctx.save();
    const r1 = TECH_TREE.CENTER_RADIUS - 42;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r1);
    grad.addColorStop(0, 'rgba(255, 0, 200, 0.18)');
    grad.addColorStop(0.6, 'rgba(0, 200, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 245, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, TECH_TREE.CENTER_RADIUS - 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawConnection(ctx, from, to) {
    const fc = this._nodeCenter(from);
    const tc = this._nodeCenter(to);
    const fx = fc.cx;
    const fy = fc.cy;
    const tx = tc.cx;
    const ty = tc.cy;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);

    // `from` is the prerequisite node, `to` is the dependent.
    if (from.isUnlocked && to.isUnlocked) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.75)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([]);
    } else if (from.isUnlocked) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 4]);
    } else {
      ctx.strokeStyle = 'rgba(130, 130, 140, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawNodeLevelArcs(ctx, cx, cy, node, nodeColor) {
    const max = node.maxLevel;
    if (max <= 1) return;

    const totalGap = NODE_LEVEL_GAP_RAD * max;
    const segArc = (Math.PI * 2 - totalGap) / max;
    let a = -Math.PI / 2 + NODE_LEVEL_GAP_RAD / 2;

    ctx.lineWidth = NODE_LEVEL_ARC_W;
    ctx.lineCap = 'round';
    for (let i = 0; i < max; i++) {
      const a0 = a;
      const a1 = a + segArc;
      ctx.beginPath();
      ctx.arc(cx, cy, NODE_LEVEL_ARC_R, a0, a1);
      if (i < node.currentLevel) {
        ctx.strokeStyle = nodeColor;
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.globalAlpha = 0.95;
      }
      ctx.stroke();
      a = a1 + NODE_LEVEL_GAP_RAD;
    }
    ctx.globalAlpha = 1;
  }

  _drawNode(ctx, node) {
    const { cx, cy } = this._nodeCenter(node);
    const CATEGORY_META = this._tree.generator.categoryMeta;
    const catMeta = CATEGORY_META[node.category] || CATEGORY_META.weapon;
    const pres = node.presentation || {};
    const rarityMeta = pres.rarity ? (RARITY_META[pres.rarity] || {}) : {};

    const nodeColor = pres.color || rarityMeta.color || catMeta.color;

    const isHovered = this._hoveredNode?.id === node.id;
    const isAvailable = this._tree.isAvailable(node.id);
    const canAfford = isAvailable && this._currency.canAfford(node.getCostForNextLevel());
    const isUnlocked = node.isUnlocked;
    const isMaxed = node.isMaxed;

    ctx.beginPath();
    ctx.arc(cx, cy, NODE_MAIN_R, 0, Math.PI * 2);

    if (isMaxed) {
      ctx.fillStyle = `${nodeColor}55`;
    } else if (isUnlocked) {
      ctx.fillStyle = `${nodeColor}44`;
    } else if (canAfford) {
      ctx.fillStyle = isHovered ? `${nodeColor}38` : `${nodeColor}28`;
    } else {
      ctx.fillStyle = 'rgba(20, 10, 40, 0.92)';
    }
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, NODE_MAIN_R, 0, Math.PI * 2);
    const anim = pres.borderAnim || (canAfford ? 'pulse' : rarityMeta.borderAnim || 'none');

    if (isMaxed) {
      ctx.strokeStyle = nodeColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
    } else if (anim === 'rainbow') {
      const hue = (this._animTime * 60) % 360;
      ctx.strokeStyle = `hsl(${hue}, 100%, 65%)`;
      ctx.lineWidth = isHovered ? 2.5 : 1.8;
      ctx.setLineDash([]);
    } else if (anim === 'rotate') {
      ctx.strokeStyle = nodeColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -(this._animTime * 18);
    } else if (anim === 'pulse' || canAfford) {
      const pulse = Math.sin(this._animTime * 2.5) * 0.5 + 0.5;
      const alpha = Math.floor((0.5 + pulse * 0.5) * 255).toString(16).padStart(2, '0');
      ctx.strokeStyle = `${nodeColor}${alpha}`;
      ctx.lineWidth = isHovered ? 2.5 : 1.8;
      ctx.setLineDash([]);
    } else if (isUnlocked) {
      ctx.strokeStyle = `${nodeColor}aa`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    this._drawNodeLevelArcs(ctx, cx, cy, node, nodeColor);

    const iconBright = isUnlocked || canAfford;
    ctx.font = `${Math.round(NODE_MAIN_R * 0.95)}px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = iconBright ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';
    ctx.fillText(node.icon || '', cx, cy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (isMaxed) {
      ctx.font = `bold 11px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (node.masteryLevel > 0) {
        // Mastery star: purple glow
        ctx.fillStyle = '#cc00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 6;
        ctx.fillText('★', cx + NODE_MAIN_R - 7, cy - NODE_MAIN_R + 8);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText('✓', cx + NODE_MAIN_R - 7, cy - NODE_MAIN_R + 8);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (!isAvailable && !isUnlocked) {
      ctx.font = `11px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('🔒', cx, cy + NODE_MAIN_R + 10);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (pres.badge) {
      const bx = cx + NODE_MAIN_R * 0.62;
      const by = cy - NODE_MAIN_R * 0.62;
      const bColor = pres.badgeColor || nodeColor;
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fillStyle = bColor + 'cc';
      ctx.fill();
      ctx.font = `bold 7px 'Orbitron', monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pres.badge.slice(0, 3), bx, by);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  _isTemplateUnlocked(templateId) {
    for (const n of this._tree.getVisibleNodes()) {
      if ((n.templateId || n.id) === templateId && n.isUnlocked) return true;
    }
    return false;
  }

  _showTooltip(node, screenX, screenY) {
    const el = this._tooltip;
    const isAvailable = this._tree.isAvailable(node.id);
    const meta = this._tree.generator.categoryMeta[node.category] || {};
    const pres = node.presentation || {};
    const rarityMeta = pres.rarity ? (RARITY_META[pres.rarity] || {}) : null;
    const nodeColor = pres.color || rarityMeta?.color || meta.color;

    let html = `<div class="tooltip-name" style="color:${nodeColor}">${node.icon || ''} ${node.name}</div>`;
    html += `<div class="tooltip-category" style="color:${nodeColor}">${(meta.label || node.category || '').toUpperCase()}</div>`;
    html += `<div class="tooltip-ring" style="font-size:10px;color:#7a8a9e;margin:2px 0 3px">Ring ${node.tier ?? 0}</div>`;

    // Rarity label
    if (pres.rarity) {
      const rColor = rarityMeta?.color || '#aaaaaa';
      html += `<div class="tooltip-rarity" style="color:${rColor};font-style:italic;font-size:10px;margin-bottom:4px">${pres.rarity.toUpperCase()}</div>`;
    }

    html += `<div class="tooltip-desc">${node.description}</div>`;

    if (node.currentLevel > 0) {
      html += `<div class="tooltip-level">Level ${node.currentLevel} / ${node.maxLevel}</div>`;
      const canSell = this._tree.canSellOneLevel(node.id);
      const paid = node.getHistoricalCostForLevel(node.currentLevel);
      const pct = Math.round(SELL_RATIO * 100);
      if (canSell && Object.keys(paid).length) {
        html += `<div class="tooltip-sell" style="margin-top:6px;font-size:10px;color:#ffb347;border-top:1px solid rgba(255,255,255,0.12);padding-top:4px">`;
        html += `Sell 1 level (${pct}% refund): `;
        const parts = Object.entries(paid).map(([type, amount]) => {
          const cm = CURRENCIES[type];
          const r = Math.floor(amount * SELL_RATIO);
          return `<span style="color:#7dffb3">${cm?.icon || ''} ${r}</span>`;
        });
        html += parts.join(' ');
        html += `<div style="color:#888;margin-top:3px">Right-click node to sell</div>`;
        html += `</div>`;
      } else if (!canSell) {
        html += `<div style="margin-top:6px;font-size:9px;color:#aa6666">Cannot sell — other upgrades need this path</div>`;
      }
    }

    if (!node.isMaxed) {
      html += `<div class="tooltip-effect">→ ${node.getNextLevelDescription()}</div>`;

      // Cost display
      const cost = node.getCostForNextLevel();
      html += `<div class="tooltip-cost">`;
      for (const [type, amount] of Object.entries(cost)) {
        const currMeta = CURRENCIES[type];
        const have = this._currency.get(type);
        const color = have >= amount ? '#00f5ff' : '#ff2244';
        html += `<span class="tooltip-cost-item" style="border-color:${color};color:${color}">${currMeta?.icon || ''} ${Math.ceil(amount)}</span>`;
      }
      html += `</div>`;

      // Alternative cost hint
      const altMod = node.costModifiers?.find(m => m.type === 'alternative');
      if (altMod?.altCost && altMod?.altLabel) {
        const altParts = Object.entries(altMod.altCost).map(([t, v]) => {
          const cm = CURRENCIES[t];
          return `${cm?.icon || ''} ${v} ${cm?.label || t}`;
        }).join(' + ');
        html += `<div style="font-size:9px;color:#aaa;margin-top:2px">Alt: ${altParts} (${altMod.altLabel})</div>`;
      }

      if (!isAvailable) {
        const prereqNames = node.prerequisites.map(id => {
          const n = this._tree.generator.getNode(id);
          return n ? n.name : id;
        });
        html += `<div class="tooltip-locked">Requires: ${prereqNames.join(', ')}</div>`;
      }
    } else {
      if (node.masteryLevel > 0) {
        html += `<div class="tooltip-level" style="color:#cc00ff">★ MASTERY LV ${node.masteryLevel}</div>`;
      } else {
        html += `<div class="tooltip-level" style="color:#39ff14">MAXED OUT ✓</div>`;
      }
      // Mastery purchase
      const masteryCost = node.getMasteryCost();
      html += `<div class="tooltip-cost" style="border-color:#cc00ff44;margin-top:4px">`;
      html += `<span style="color:#cc00ff;font-size:9px">★ MASTERY:</span> `;
      for (const [type, amount] of Object.entries(masteryCost)) {
        const currMeta = CURRENCIES[type];
        const have = this._currency.get(type);
        const color = have >= amount ? '#cc00ff' : '#ff2244';
        html += `<span class="tooltip-cost-item" style="border-color:${color};color:${color}">${currMeta?.icon || ''} ${Math.ceil(amount)}</span>`;
      }
      html += `</div>`;
      html += `<div style="font-size:9px;color:#aa88ff;margin-top:2px">+1% per effect per mastery level · Click to buy</div>`;
    }

    // Synergy section
    if (node.synergies?.length) {
      html += `<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.15);padding-top:4px;font-size:9px">`;
      for (const syn of node.synergies) {
        const allMet = syn.requires?.every(id => this._isTemplateUnlocked(id));
        const check = allMet ? '<span style="color:#39ff14">✓</span>' : '<span style="color:#888">○</span>';
        html += `<div style="margin-bottom:2px">${check} <span style="color:#ccc">${syn.label}</span></div>`;
        if (!allMet && syn.requires) {
          const missing = syn.requires.filter(id => !this._isTemplateUnlocked(id));
          const missingNames = missing.map(id => {
            const n = this._tree.generator.getNode(id);
            return n ? n.name : id;
          });
          html += `<div style="color:#666;margin-left:12px;font-size:8px">Needs: ${missingNames.join(', ')}</div>`;
        }
      }
      html += `</div>`;
    }

    // Synergy hints from presentation (nodes this one has synergy with)
    if (pres.synergyHints?.length) {
      const unlockedHints = pres.synergyHints.filter(id => this._isTemplateUnlocked(id));
      const lockedHints   = pres.synergyHints.filter(id => !this._isTemplateUnlocked(id));
      if (pres.synergyHints.length > 0) {
        html += `<div style="font-size:9px;color:#888;margin-top:4px">Synergizes with: `;
        html += pres.synergyHints.map(id => {
          const n = this._tree.generator.getNode(id);
          const name = n ? n.name : id;
          const active = this._isTemplateUnlocked(id);
          return `<span style="color:${active ? '#39ff14' : '#666'}">${name}</span>`;
        }).join(', ');
        html += `</div>`;
      }
    }

    // Flavor text
    if (pres.flavorText) {
      html += `<div style="font-style:italic;color:#888;font-size:9px;margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px">"${pres.flavorText}"</div>`;
    }

    el.innerHTML = html;
    this._moveTooltip(screenX, screenY);
    el.classList.remove('hidden');
  }

  _moveTooltip(screenX, screenY) {
    const el = this._tooltip;
    const W = el.offsetWidth || 220;
    const H = el.offsetHeight || 120;
    const x = Math.min(screenX + 14, window.innerWidth - W - 10);
    const y = Math.min(screenY - 10, window.innerHeight - H - 10);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  _hideTooltip() {
    this._tooltip.classList.add('hidden');
  }

  _fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  tick(delta) {
    this._animTime += delta;
    if (this._visible) this.render();
  }
}
