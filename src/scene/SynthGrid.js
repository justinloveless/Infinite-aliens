import * as THREE from 'three';

const DEFAULT_CONFIG = {
  width: 60,
  depth: 80,
  hLines: 16,
  vLines: 12,
  zStart: 5,
  zEnd: -80,
  centered: false, // false: legacy corridor (z: +5 forward, -depth back)
};

const ARENA_CONFIG = {
  width: 680,
  depth: 680,
  hLines: 40,
  vLines: 40,
  centered: true, // symmetric around origin in x and z
};

// Scrolling synthwave perspective grid below the ship
export class SynthGrid {
  constructor(scene) {
    this._time = 0;
    this._scene = scene;
    this._config = { ...DEFAULT_CONFIG };
    this._lines = null;
    this._basePositions = null;
    this._color = 0xff00dd;
    this._arenaMode = false;
    this._rebuild();
  }

  _rebuild() {
    if (this._lines) {
      this._scene.remove(this._lines);
      this._lines.geometry.dispose();
      this._lines.material.dispose();
      this._lines = null;
    }

    const cfg = this._config;
    const lines = [];
    const halfW = cfg.width / 2;

    if (cfg.centered) {
      const halfD = cfg.depth / 2;
      // Vertical lines (constant x, spanning full z)
      for (let i = 0; i <= cfg.vLines; i++) {
        const x = (i / cfg.vLines - 0.5) * cfg.width;
        lines.push(x, -3.5, -halfD, x, -3.5, halfD);
      }
      // Horizontal lines (constant z, spanning full x)
      for (let i = 0; i <= cfg.hLines; i++) {
        const z = (i / cfg.hLines - 0.5) * cfg.depth;
        lines.push(-halfW, -3.5, z, halfW, -3.5, z);
      }
    } else {
      const zStart = cfg.zStart;
      const zEnd = cfg.zEnd;
      const FLOOR_Y = -5.5;
      const CEIL_Y  =  5.5;
      // Vertical lines running front-to-back (floor + ceiling)
      for (let i = 0; i <= cfg.vLines; i++) {
        const x = (i / cfg.vLines - 0.5) * cfg.width;
        lines.push(x, FLOOR_Y, zStart, x, FLOOR_Y, zEnd);
        lines.push(x, CEIL_Y,  zStart, x, CEIL_Y,  zEnd);
      }
      // Horizontal lines (floor + ceiling)
      const span = zStart - zEnd;
      for (let i = 0; i <= cfg.hLines; i++) {
        const z = zStart - i * (span / cfg.hLines);
        lines.push(-halfW, FLOOR_Y, z, halfW, FLOOR_Y, z);
        lines.push(-halfW, CEIL_Y,  z, halfW, CEIL_Y,  z);
      }
    }

    const posArr = new Float32Array(lines);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const mat = new THREE.LineBasicMaterial({
      color: this._color,
      transparent: true,
      opacity: 0.2,
    });

    this._lines = new THREE.LineSegments(geo, mat);
    this._basePositions = posArr.slice();
    this._scene.add(this._lines);
  }

  setColor(hex) {
    this._color = hex;
    if (this._lines) this._lines.material.color.setHex(hex);
  }

  /** Expand the grid to cover the full arena bounds, or restore corridor default. */
  setArenaMode(on) {
    const next = !!on;
    if (next === this._arenaMode) return;
    this._arenaMode = next;
    this._config = { ...(next ? ARENA_CONFIG : DEFAULT_CONFIG) };
    this._time = 0;
    this._rebuild();
  }

  /** @param {number} speedScale - matches player run speed vs base (combat only in main) */
  update(delta, speedScale = 1) {
    if (this._arenaMode) {
      // In arena, grid is static under the ship's movement; no scrolling.
      return;
    }
    const s = Math.max(0, speedScale);
    this._time += delta * 8 * s;
    const posAttr = this._lines.geometry.getAttribute('position');
    const arr = posAttr.array;
    const base = this._basePositions;

    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 2] = base[i + 2] + (this._time % 5); // mod by segment spacing
    }
    posAttr.needsUpdate = true;
  }
}
