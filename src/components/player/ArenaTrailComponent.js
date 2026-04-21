import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

// Trail samples the ship's world position along a ring buffer, draws it as a
// fading additive line in the effects group, and modulates length + opacity by
// the current arena speed ratio. Because it records actual travelled positions
// (not the nose direction), the trail visibly peels off the hull during hard
// turns — a free velocity-direction read for the player.

const MAX_POINTS = 60;
const MIN_SAMPLE_DIST = 0.25;   // world units between samples
const BASE_COLOR = new THREE.Color(0x66d9ff);

export class ArenaTrailComponent extends Component {
  constructor() {
    super();
    this._scene = null;
    this._line = null;
    this._geo = null;
    this._mat = null;
    this._positions = null;
    this._colors = null;
    this._count = 0;
    this._lastX = 0;
    this._lastZ = 0;
    this._hasLast = false;
    this._speedRatio = 0;
  }

  onAttach(ctx) {
    this._scene = ctx?.scene || null;
    if (!this._scene?.groups?.effects) return;

    this._positions = new Float32Array(MAX_POINTS * 3);
    this._colors = new Float32Array(MAX_POINTS * 3);

    this._geo = new THREE.BufferGeometry();
    this._geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    this._geo.setAttribute('color', new THREE.BufferAttribute(this._colors, 3));
    this._geo.setDrawRange(0, 0);

    this._mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._line = new THREE.Line(this._geo, this._mat);
    this._line.frustumCulled = false;
    this._line.visible = false;
    this._scene.groups.effects.add(this._line);
  }

  onDetach() {
    if (this._line?.parent) this._line.parent.remove(this._line);
    this._geo?.dispose();
    this._mat?.dispose();
    this._line = null;
    this._geo = null;
    this._mat = null;
    this._positions = null;
    this._colors = null;
    this._count = 0;
    this._hasLast = false;
  }

  /** Called each arena frame from main.js with current speed magnitude / MAX_SPEED. */
  setSpeedRatio(r) {
    this._speedRatio = Math.max(0, Math.min(1, r || 0));
  }

  /** Clear trail buffer (on arena enter/exit so runs don't inherit ghost lines). */
  reset() {
    this._count = 0;
    this._hasLast = false;
    if (this._geo) this._geo.setDrawRange(0, 0);
    if (this._line) this._line.visible = false;
  }

  update(_dt, ctx) {
    if (!this._line) return;
    const phase = ctx?.state?.round?.phase;
    const inArena = phase === 'boss_arena' || phase === 'arena_transition';
    if (!inArena) {
      if (this._count !== 0 || this._hasLast) this.reset();
      return;
    }

    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    const px = t.position.x;
    const py = t.position.y;
    const pz = t.position.z;

    if (!this._hasLast) {
      this._pushPoint(px, py, pz);
      this._lastX = px; this._lastZ = pz;
      this._hasLast = true;
    } else {
      const dx = px - this._lastX;
      const dz = pz - this._lastZ;
      if (dx * dx + dz * dz >= MIN_SAMPLE_DIST * MIN_SAMPLE_DIST) {
        this._pushPoint(px, py, pz);
        this._lastX = px; this._lastZ = pz;
      } else if (this._count > 0) {
        // Keep the head glued to the live ship position between samples so
        // the trail doesn't appear to lag behind the hull.
        const headIdx = (this._count - 1) * 3;
        this._positions[headIdx] = px;
        this._positions[headIdx + 1] = py;
        this._positions[headIdx + 2] = pz;
        this._geo.attributes.position.needsUpdate = true;
      }
    }

    this._refreshColors();

    // Opacity = baseline + speedRatio kick, clamped.
    const opacity = Math.min(0.95, 0.15 + 0.85 * this._speedRatio);
    this._mat.opacity = opacity;
    this._line.visible = this._count > 1 && this._speedRatio > 0.02;
  }

  _pushPoint(x, y, z) {
    if (this._count >= MAX_POINTS) {
      // Shift buffer left by one point (drop oldest) to make room.
      this._positions.copyWithin(0, 3, MAX_POINTS * 3);
      this._count = MAX_POINTS - 1;
    }
    const i = this._count * 3;
    this._positions[i] = x;
    this._positions[i + 1] = y;
    this._positions[i + 2] = z;
    this._count++;
    this._geo.attributes.position.needsUpdate = true;
    this._geo.setDrawRange(0, this._count);
  }

  _refreshColors() {
    const col = this._colors;
    const n = this._count;
    if (n < 1) return;
    for (let i = 0; i < n; i++) {
      // i=0 is oldest/tail → black; i=n-1 is head → full color.
      const f = n > 1 ? i / (n - 1) : 1;
      // Ease the fade so the head reads brighter with a longer dim tail.
      const e = f * f;
      col[i * 3]     = BASE_COLOR.r * e;
      col[i * 3 + 1] = BASE_COLOR.g * e;
      col[i * 3 + 2] = BASE_COLOR.b * e;
    }
    this._geo.attributes.color.needsUpdate = true;
  }
}
