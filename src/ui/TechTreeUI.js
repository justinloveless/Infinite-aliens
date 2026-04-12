import { TECH_TREE, CURRENCIES, RARITY_META } from '../constants.js';
import { CATEGORY_META } from '../techtree/TechNodeTemplates.js';
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
    this._hoveredNode = null;
    this._animTime = 0;
    this._visible = false;

    this._setupCanvas();
    this._setupInteraction();

    // Refresh on upgrade purchase
    eventBus.on(EVENTS.UPGRADE_PURCHASED, () => this.render());
    eventBus.on(EVENTS.CURRENCY_CHANGED, () => {
      if (this._visible) this.render();
    });
  }

  _setupCanvas() {
    const resize = () => {
      const container = document.getElementById('tech-tree-screen');
      const headerH = document.getElementById('tech-tree-header').offsetHeight;
      const currencyH = document.getElementById('tech-tree-currencies').offsetHeight;
      const footerH = document.getElementById('tech-tree-footer').offsetHeight;
      this._canvas.width = container.offsetWidth;
      this._canvas.height = container.offsetHeight - headerH - currencyH - footerH;
    };
    window.addEventListener('resize', () => { if (this._visible) resize(); });
    this._resizeFn = resize;
  }

  _setupInteraction() {
    const canvas = this._canvas;

    canvas.addEventListener('mousedown', e => {
      this._isDragging = true;
      this._dragStart = { x: e.clientX - this._camera.x, y: e.clientY - this._camera.y };
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', e => {
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
      if (this._isDragging) {
        const dx = e.clientX - this._dragStart.x - this._camera.x;
        const dy = e.clientY - this._dragStart.y - this._camera.y;
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (moved < 5) {
          const world = this._screenToWorld(e.clientX, e.clientY);
          const hit = this._hitTest(world.x, world.y);
          if (hit) this._purchaseNode(hit);
        }
      }
      this._isDragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('click', e => {
      const world = this._screenToWorld(e.clientX, e.clientY);
      const hit = this._hitTest(world.x, world.y);
      if (hit) this._purchaseNode(hit);
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
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

    canvas.addEventListener('mouseleave', () => {
      this._isDragging = false;
      this._hoveredNode = null;
      this._hideTooltip();
    });
  }

  open(state) {
    this._visible = true;
    this._resizeFn();
    this._updateCurrencyBar(state);
    this._centerOnFrontier();
    this.render();
  }

  close() {
    this._visible = false;
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
    const success = this._tree.purchase(node.id, this._currency);
    if (success) {
      if (this._audio) {
        if (node.id === 'drone') this._audio.play('droneSpawn');
        else this._audio.play('upgrade');
      }
      // Flash animation via re-render
      this.render();
    } else {
      // Visual shake would go here
    }
  }

  render() {
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

    const bothUnlocked = from.isUnlocked && to.isUnlocked;
    const eitherUnlocked = from.isUnlocked || to.isUnlocked;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);

    if (bothUnlocked) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.75)';
      ctx.lineWidth = 2.2;
    } else if (eitherUnlocked) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 4]);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
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
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', cx + NODE_MAIN_R - 7, cy - NODE_MAIN_R + 8);
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
    const meta = CATEGORY_META[node.category] || {};
    const pres = node.presentation || {};
    const rarityMeta = pres.rarity ? (RARITY_META[pres.rarity] || {}) : null;
    const nodeColor = pres.color || rarityMeta?.color || meta.color;

    let html = `<div class="tooltip-name" style="color:${nodeColor}">${node.icon || ''} ${node.name}</div>`;
    html += `<div class="tooltip-category" style="color:${nodeColor}">${(meta.label || node.category || '').toUpperCase()}</div>`;

    // Rarity label
    if (pres.rarity) {
      const rColor = rarityMeta?.color || '#aaaaaa';
      html += `<div class="tooltip-rarity" style="color:${rColor};font-style:italic;font-size:10px;margin-bottom:4px">${pres.rarity.toUpperCase()}</div>`;
    }

    html += `<div class="tooltip-desc">${node.description}</div>`;

    if (node.currentLevel > 0) {
      html += `<div class="tooltip-level">Level ${node.currentLevel} / ${node.maxLevel}</div>`;
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
      html += `<div class="tooltip-level" style="color:#39ff14">MAXED OUT ✓</div>`;
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
