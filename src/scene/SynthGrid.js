import * as THREE from 'three';

// Scrolling synthwave perspective grid below the ship
export class SynthGrid {
  constructor(scene) {
    this._time = 0;
    this._mesh = null;
    this._createGrid(scene);
  }

  _createGrid(scene) {
    // Use a grid helper approach with a custom scrolling shader
    const geo = new THREE.PlaneGeometry(120, 120, 30, 30);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });

    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.rotation.x = -Math.PI / 2;
    this._mesh.position.set(0, -3.5, -20);
    scene.add(this._mesh);

    // Horizontal lines only grid using LineSegments for sharper look
    this._createLines(scene);
  }

  _createLines(scene) {
    const lines = [];
    const width = 60;
    const depth = 80;
    const hLines = 16;
    const vLines = 12;

    // Vertical lines (running front-to-back)
    for (let i = 0; i <= vLines; i++) {
      const x = (i / vLines - 0.5) * width;
      lines.push(x, -3.5, 5, x, -3.5, -depth);
    }

    // Horizontal lines
    for (let i = 0; i <= hLines; i++) {
      const z = -i * (depth / hLines);
      lines.push(-width / 2, -3.5, z, width / 2, -3.5, z);
    }

    const posArr = new Float32Array(lines);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0xff00dd,
      transparent: true,
      opacity: 0.2,
    });

    this._lines = new THREE.LineSegments(geo, mat);
    this._basePositions = posArr.slice();
    scene.add(this._lines);
  }

  update(delta) {
    this._time += delta * 8;
    // Scroll horizontal lines forward
    const posAttr = this._lines.geometry.getAttribute('position');
    const arr = posAttr.array;
    const base = this._basePositions;

    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 2] = base[i + 2] + (this._time % 5); // mod by segment spacing
    }
    posAttr.needsUpdate = true;
  }
}
