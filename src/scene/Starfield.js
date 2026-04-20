import * as THREE from 'three';

const DEFAULT_LAYERS = [
  { count: 600, zMin: -120, zMax: -50, xHalf: 40, yHalf: 30, sizeRange: [0.5, 1.2], speed: 4,  opacity: 0.5 },
  { count: 250, zMin: -50,  zMax: -25, xHalf: 40, yHalf: 30, sizeRange: [1.0, 2.0], speed: 8,  opacity: 0.7 },
  { count: 80,  zMin: -25,  zMax: -12, xHalf: 40, yHalf: 30, sizeRange: [1.5, 3.0], speed: 14, opacity: 0.9 },
];

// Arena: camera sits overhead/behind the ship anywhere inside a 600x600 plane.
// Stars must cover that whole volume so the background never looks empty from
// the far corners.
const ARENA_LAYERS = [
  { count: 900, zMin: -420, zMax: -150, xHalf: 420, yHalf: 220, sizeRange: [0.5, 1.2], speed: 0, opacity: 0.5 },
  { count: 450, zMin: -150, zMax: -60,  xHalf: 360, yHalf: 180, sizeRange: [1.0, 2.0], speed: 0, opacity: 0.7 },
  { count: 150, zMin: -60,  zMax: -20,  xHalf: 320, yHalf: 160, sizeRange: [1.5, 3.0], speed: 0, opacity: 0.9 },
];

export class Starfield {
  constructor(scene) {
    this._scene = scene;
    this.layers = [];
    this._arenaMode = false;
    this._build(DEFAULT_LAYERS);
  }

  _build(defs) {
    this._disposeLayers();
    defs.forEach(def => {
      const positions = new Float32Array(def.count * 3);
      const sizes = new Float32Array(def.count);

      for (let i = 0; i < def.count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * def.xHalf * 2;
        positions[i * 3 + 1] = (Math.random() - 0.5) * def.yHalf * 2;
        positions[i * 3 + 2] = Math.random() * (def.zMax - def.zMin) + def.zMin;
        sizes[i] = def.sizeRange[0] + Math.random() * (def.sizeRange[1] - def.sizeRange[0]);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const mat = new THREE.PointsMaterial({
        size: def.sizeRange[1],
        sizeAttenuation: false,
        color: 0xffffff,
        transparent: true,
        opacity: def.opacity,
      });

      const points = new THREE.Points(geo, mat);
      this._scene.add(points);

      this.layers.push({ points, def, positions });
    });
  }

  _disposeLayers() {
    for (const layer of this.layers) {
      this._scene.remove(layer.points);
      layer.points.geometry.dispose();
      layer.points.material.dispose();
    }
    this.layers.length = 0;
  }

  /** Expand stars to cover the full arena bounds, or restore corridor default. */
  setArenaMode(on) {
    const next = !!on;
    if (next === this._arenaMode) return;
    this._arenaMode = next;
    this._build(next ? ARENA_LAYERS : DEFAULT_LAYERS);
  }

  /** @param {number} speedScale - 1 = base run speed; matches player stat `speed` / BASE_SPEED during combat */
  update(delta, speedScale = 1) {
    if (this._arenaMode) return; // static starfield in arena; player moves through it
    const s = Math.max(0, speedScale);
    this.layers.forEach(layer => {
      const { points, def, positions } = layer;
      const posAttr = points.geometry.getAttribute('position');

      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 2] += def.speed * delta * s;
        if (positions[i * 3 + 2] > 15) {
          positions[i * 3]     = (Math.random() - 0.5) * def.xHalf * 2;
          positions[i * 3 + 1] = (Math.random() - 0.5) * def.yHalf * 2;
          positions[i * 3 + 2] = def.zMin - Math.random() * 10;
        }
      }

      posAttr.array = positions;
      posAttr.needsUpdate = true;
    });
  }
}
