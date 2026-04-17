import * as THREE from 'three';

export class Starfield {
  constructor(scene) {
    this.layers = [];
    this._createLayers(scene);
  }

  _createLayers(scene) {
    const layerDefs = [
      { count: 600, zMin: -120, zMax: -50, sizeRange: [0.5, 1.2], speed: 4,  opacity: 0.5 },
      { count: 250, zMin: -50,  zMax: -25, sizeRange: [1.0, 2.0], speed: 8,  opacity: 0.7 },
      { count: 80,  zMin: -25,  zMax: -12, sizeRange: [1.5, 3.0], speed: 14, opacity: 0.9 },
    ];

    layerDefs.forEach(def => {
      const positions = new Float32Array(def.count * 3);
      const sizes = new Float32Array(def.count);

      for (let i = 0; i < def.count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 80;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
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
      scene.add(points);

      this.layers.push({ points, def, positions });
    });
  }

  /** @param {number} speedScale - 1 = base run speed; matches player stat `speed` / BASE_SPEED during combat */
  update(delta, speedScale = 1) {
    const s = Math.max(0, speedScale);
    this.layers.forEach(layer => {
      const { points, def, positions } = layer;
      const posAttr = points.geometry.getAttribute('position');

      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 2] += def.speed * delta * s;
        // Recycle stars that pass the camera
        if (positions[i * 3 + 2] > 15) {
          positions[i * 3]     = (Math.random() - 0.5) * 80;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
          positions[i * 3 + 2] = def.zMin - Math.random() * 10;
        }
      }

      posAttr.array = positions;
      posAttr.needsUpdate = true;
    });
  }
}
