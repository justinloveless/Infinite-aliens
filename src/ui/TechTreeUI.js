import { TECH_TREE, CURRENCIES } from '../constants.js';
import { CATEGORY_META } from '../techtree/TechNodeTemplates.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

const NODE_W = TECH_TREE.NODE_W;
const NODE_H = TECH_TREE.NODE_H;
const CORNER_R = 8;

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
      const newZoom = Math.max(0.4, Math.min(2.5, this._camera.zoom * zoomDelta));

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
    const frontierTier = this._tree.frontier;
    const targetY = -(TECH_TREE.GRID_OFFSET_Y + frontierTier * (TECH_TREE.NODE_H + TECH_TREE.NODE_PADDING_Y)) + this._canvas.height * 0.4;
    const targetX = this._canvas.width / 2 - 200;
    this._camera.x = targetX;
    this._camera.y = targetY;
  }

  _screenToWorld(sx, sy) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (sx - rect.left - this._camera.x) / this._camera.zoom,
      y: (sy - rect.top - this._camera.y) / this._camera.zoom,
    };
  }

  _hitTest(wx, wy) {
    for (const node of this._tree.getVisibleNodes()) {
      const { x, y } = node.position;
      if (wx >= x && wx <= x + NODE_W && wy >= y && wy <= y + NODE_H) {
        return node;
      }
    }
    return null;
  }

  _purchaseNode(node) {
    const success = this._tree.purchase(node.id, this._currency);
    if (success) {
      if (this._audio) this._audio.play('upgrade');
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

    const nodes = this._tree.getVisibleNodes();
    const nodesMap = {};
    for (const n of nodes) nodesMap[n.id] = n;

    // Draw connections first
    for (const node of nodes) {
      for (const prereqId of node.prerequisites) {
        const prereq = nodesMap[prereqId];
        if (!prereq) continue;
        this._drawConnection(ctx, prereq, node);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      this._drawNode(ctx, node);
    }

    ctx.restore();
  }

  _drawConnection(ctx, from, to) {
    const fx = from.position.x + NODE_W / 2;
    const fy = from.position.y + NODE_H;
    const tx = to.position.x + NODE_W / 2;
    const ty = to.position.y;

    const bothUnlocked = from.isUnlocked && to.isUnlocked;
    const fromUnlocked = from.isUnlocked;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.bezierCurveTo(fx, fy + 30, tx, ty - 30, tx, ty);

    if (bothUnlocked) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.7)';
      ctx.lineWidth = 2;
    } else if (fromUnlocked) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawNode(ctx, node) {
    const { x, y } = node.position;
    const meta = CATEGORY_META[node.category] || CATEGORY_META.weapon;
    const isHovered = this._hoveredNode?.id === node.id;
    const isAvailable = this._tree.isAvailable(node.id);
    const canAfford = isAvailable && this._currency.canAfford(node.getCostForNextLevel());
    const isUnlocked = node.isUnlocked;
    const isMaxed = node.isMaxed;

    // Node background
    this._roundRect(ctx, x, y, NODE_W, NODE_H, CORNER_R);

    if (isMaxed) {
      ctx.fillStyle = `${meta.color}33`;
    } else if (isUnlocked) {
      ctx.fillStyle = `${meta.color}22`;
    } else if (canAfford) {
      ctx.fillStyle = isHovered ? `${meta.color}22` : `${meta.color}11`;
    } else {
      ctx.fillStyle = 'rgba(20, 10, 40, 0.8)';
    }
    ctx.fill();

    // Border
    this._roundRect(ctx, x, y, NODE_W, NODE_H, CORNER_R);
    if (isMaxed) {
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.5;
    } else if (canAfford) {
      const pulse = Math.sin(Date.now() / 400) * 0.5 + 0.5;
      const alpha = (0.5 + pulse * 0.5).toFixed(2);
      ctx.strokeStyle = `${meta.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = isHovered ? 2.5 : 1.8;
    } else if (isUnlocked) {
      ctx.strokeStyle = `${meta.color}88`;
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // Icon
    ctx.font = `14px 'Share Tech Mono', monospace`;
    ctx.fillStyle = isUnlocked || canAfford ? meta.color : 'rgba(255,255,255,0.3)';
    ctx.fillText(node.icon || '', x + 10, y + 18);

    // Name
    ctx.font = `bold 10px 'Orbitron', monospace`;
    ctx.fillStyle = isUnlocked || canAfford ? '#ffffff' : 'rgba(255,255,255,0.3)';
    const shortName = node.name.length > 14 ? node.name.slice(0, 13) + '…' : node.name;
    ctx.fillText(shortName, x + 28, y + 18);

    // Category label
    ctx.font = `8px 'Share Tech Mono', monospace`;
    ctx.fillStyle = isUnlocked || canAfford ? meta.color : 'rgba(255,255,255,0.2)';
    ctx.fillText(meta.label.toUpperCase(), x + 28, y + 29);

    // Level dots
    if (node.maxLevel > 1) {
      const dotR = 3;
      const dotSpacing = 8;
      const totalDots = Math.min(node.maxLevel, 8);
      const startX = x + NODE_W / 2 - (totalDots * dotSpacing) / 2 + dotR;
      for (let i = 0; i < totalDots; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotSpacing, y + NODE_H - 10, dotR, 0, Math.PI * 2);
        if (i < node.currentLevel) {
          ctx.fillStyle = meta.color;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
        }
        ctx.fill();
      }
    }

    // Maxed checkmark
    if (isMaxed) {
      ctx.font = `bold 12px sans-serif`;
      ctx.fillStyle = meta.color;
      ctx.fillText('✓', x + NODE_W - 18, y + 18);
    }

    // Locked indicator
    if (!isAvailable && !isUnlocked) {
      ctx.font = `12px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('🔒', x + NODE_W - 20, y + NODE_H - 8);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _showTooltip(node, screenX, screenY) {
    const el = this._tooltip;
    const isAvailable = this._tree.isAvailable(node.id);
    const canAfford = isAvailable && this._currency.canAfford(node.getCostForNextLevel());
    const meta = CATEGORY_META[node.category] || {};

    let html = `<div class="tooltip-name" style="color:${meta.color}">${node.icon || ''} ${node.name}</div>`;
    html += `<div class="tooltip-desc">${node.description}</div>`;

    if (node.currentLevel > 0) {
      html += `<div class="tooltip-level">Level ${node.currentLevel} / ${node.maxLevel}</div>`;
    }

    if (!node.isMaxed) {
      html += `<div class="tooltip-effect">→ ${node.getNextLevelDescription()}</div>`;

      const cost = node.getCostForNextLevel();
      html += `<div class="tooltip-cost">`;
      for (const [type, amount] of Object.entries(cost)) {
        const currMeta = CURRENCIES[type];
        const have = this._currency.get(type);
        const color = have >= amount ? '#00f5ff' : '#ff2244';
        html += `<span class="tooltip-cost-item" style="border-color:${color};color:${color}">${currMeta?.icon || ''} ${Math.ceil(amount)}</span>`;
      }
      html += `</div>`;

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
