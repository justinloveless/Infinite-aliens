import * as THREE from 'three';

const _tmpNdc = new THREE.Vector3();

const INDICATOR_MARGIN = 56; // px inside viewport edge
const INDICATOR_ICON = {
  boss: '\u2694',
  alien_gate: '\u2726',
  player_gate: '\u25C9',
};

/**
 * HUD overlay shown only during the boss arena phase. Renders objective list
 * + a leave-prompt and projects off-screen indicators for the boss, alien
 * gates, and player warp gate.
 */
export class ArenaHUD {
  constructor() {
    this._root           = document.getElementById('arena-hud');
    this._objBoss        = document.getElementById('aobj-boss');
    this._objBossStatus  = document.getElementById('aobj-boss-status');
    this._objGates       = document.getElementById('aobj-gates');
    this._objGatesStatus = document.getElementById('aobj-gates-status');
    this._objGatesCount  = document.getElementById('aobj-gates-count');
    this._objBuild       = document.getElementById('aobj-build');
    this._objBuildStatus = document.getElementById('aobj-build-status');
    this._buildFill      = document.getElementById('arena-build-fill');
    this._leavePrompt    = document.getElementById('arena-leave-prompt');
    this._indicators     = document.getElementById('arena-indicators');
    this._mapCanvas      = document.getElementById('arena-minimap');
    this._mapCtx         = this._mapCanvas?.getContext('2d') ?? null;

    this._indicatorEls = new Map(); // id -> element
  }

  show() { this._root?.classList.remove('hidden'); }
  hide() {
    this._root?.classList.add('hidden');
    this._clearIndicators();
    if (this._mapCtx && this._mapCanvas) {
      this._mapCtx.clearRect(0, 0, this._mapCanvas.width, this._mapCanvas.height);
    }
  }

  /**
   * @param {object} bossArena - state.bossArena
   * @param {{ bossAlive?: boolean }} opts
   */
  update(bossArena, opts = {}) {
    if (!bossArena) return;
    const { subPhase, bossDefeated, gatesClosed, gatesTotal, buildProgress } = bossArena;

    // Boss objective (optional)
    if (bossDefeated) {
      this._objBoss.classList.add('done');
      this._objBossStatus.textContent = 'DEFEATED';
    } else {
      this._objBoss.classList.remove('done');
      this._objBossStatus.textContent = opts.bossAlive === false ? '—' : 'ACTIVE';
    }

    // Gates objective (always unlocked now)
    this._objGates.classList.remove('arena-obj-locked');
    this._objGatesCount.textContent = gatesClosed;
    if (gatesClosed >= gatesTotal) {
      this._objGates.classList.add('done');
      this._objGatesStatus.textContent = 'DONE';
    } else {
      this._objGates.classList.remove('done');
      this._objGatesStatus.textContent = `${gatesClosed}/${gatesTotal}`;
    }

    // Build objective
    const buildLocked = subPhase !== 'building_gate' && subPhase !== 'complete';
    this._objBuild.classList.toggle('arena-obj-locked', buildLocked);
    if (subPhase === 'complete') {
      this._objBuild.classList.add('done');
      this._objBuildStatus.textContent = 'DONE';
      this._buildFill.style.width = '100%';
    } else if (!buildLocked) {
      this._objBuild.classList.remove('done');
      this._objBuildStatus.textContent = `${Math.floor((buildProgress || 0) * 100)}%`;
      this._buildFill.style.width = `${(buildProgress || 0) * 100}%`;
    } else {
      this._objBuildStatus.textContent = 'LOCKED';
      this._buildFill.style.width = '0%';
    }

    // Leave prompt: as soon as the warp gate is built, nudge the player
    // that flying through it is how they leave.
    if (subPhase === 'complete') {
      this._leavePrompt.classList.remove('hidden');
    } else {
      this._leavePrompt.classList.add('hidden');
    }
  }

  /**
   * @param {THREE.Vector3 & {_yaw?:number}} playerPos
   * @param {Array<{id, kind, worldPos:THREE.Vector3}>} targets
   */
  updateMinimap(playerPos, targets) {
    const canvas = this._mapCanvas;
    const ctx    = this._mapCtx;
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width  = canvas.offsetWidth  * dpr;
    const H = canvas.height = canvas.offsetHeight * dpr;

    const wx = x => ((x + 300) / 600) * W;
    const wz = z => ((z + 300) / 600) * H;

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0, 245, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);

    const dot = (x, z, color, r) => {
      ctx.beginPath();
      ctx.arc(wx(x), wz(z), r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = r * 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    for (const t of targets) {
      if (!t?.worldPos) continue;
      switch (t.kind) {
        case 'boss':        dot(t.worldPos.x, t.worldPos.z, '#ff3355', 4 * dpr);   break;
        case 'alien_gate':  dot(t.worldPos.x, t.worldPos.z, '#c066ff', 3.5 * dpr); break;
        case 'player_gate': dot(t.worldPos.x, t.worldPos.z, '#39ff14', 3.5 * dpr); break;
      }
    }

    if (playerPos) {
      const px   = wx(playerPos.x);
      const pz   = wz(playerPos.z);
      const yaw  = playerPos._yaw ?? 0;
      const size = 5 * dpr;
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(-yaw);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo( size * 0.6,  size * 0.7);
      ctx.lineTo(-size * 0.6,  size * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Update off-screen indicators for the given targets.
   * @param {Array<{id:string|number, worldPos:THREE.Vector3, kind:'boss'|'alien_gate'|'player_gate', label?:string}>} targets
   * @param {THREE.Camera} camera
   * @param {HTMLElement} canvas — renderer DOM element used for viewport size
   */
  updateIndicators(targets, camera, canvas) {
    if (!this._indicators || !camera || !canvas) {
      this._clearIndicators();
      return;
    }

    const vw = canvas.clientWidth || window.innerWidth;
    const vh = canvas.clientHeight || window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    const maxX = vw - INDICATOR_MARGIN;
    const maxY = vh - INDICATOR_MARGIN;
    const minX = INDICATOR_MARGIN;
    const minY = INDICATOR_MARGIN;

    const seen = new Set();

    for (const target of targets) {
      if (!target || !target.worldPos) continue;
      seen.add(target.id);

      _tmpNdc.copy(target.worldPos).project(camera);
      const behind = _tmpNdc.z > 1;
      const nx = _tmpNdc.x;
      const ny = _tmpNdc.y;
      const onScreen = !behind && nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;

      const el = this._ensureIndicator(target.id, target.kind);

      if (onScreen) {
        el.style.display = 'none';
        continue;
      }

      // Direction from screen centre toward the (possibly clamped) NDC point.
      let dirX = nx;
      let dirY = -ny;
      if (behind) {
        dirX = -dirX;
        dirY = -dirY;
      }
      const mag = Math.hypot(dirX, dirY) || 1;
      dirX /= mag;
      dirY /= mag;

      // Scale so the indicator sits on the rectangular viewport border.
      const halfW = (vw / 2) - INDICATOR_MARGIN;
      const halfH = (vh / 2) - INDICATOR_MARGIN;
      const scale = Math.min(
        halfW / Math.max(1e-3, Math.abs(dirX)),
        halfH / Math.max(1e-3, Math.abs(dirY)),
      );
      let sx = cx + dirX * scale;
      let sy = cy + dirY * scale;
      if (sx < minX) sx = minX;
      if (sx > maxX) sx = maxX;
      if (sy < minY) sy = minY;
      if (sy > maxY) sy = maxY;

      const angleRad = Math.atan2(dirY, dirX);
      el.style.display = 'flex';
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      const arrow = el._arrowEl;
      if (arrow) arrow.style.transform = `rotate(${angleRad}rad)`;
    }

    for (const [id, el] of this._indicatorEls) {
      if (!seen.has(id)) {
        el.remove();
        this._indicatorEls.delete(id);
      }
    }
  }

  _ensureIndicator(id, kind) {
    let el = this._indicatorEls.get(id);
    if (el) return el;
    el = document.createElement('div');
    el.className = `arena-indicator arena-indicator-${kind}`;

    const arrow = document.createElement('div');
    arrow.className = 'arena-indicator-arrow';
    el.appendChild(arrow);
    el._arrowEl = arrow;

    const icon = document.createElement('span');
    icon.className = 'arena-indicator-icon';
    icon.textContent = INDICATOR_ICON[kind] || '\u25B6';
    el.appendChild(icon);

    this._indicators.appendChild(el);
    this._indicatorEls.set(id, el);
    return el;
  }

  _clearIndicators() {
    for (const [, el] of this._indicatorEls) el.remove();
    this._indicatorEls.clear();
  }
}
