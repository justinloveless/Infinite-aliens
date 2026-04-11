import * as THREE from 'three';
import { CURRENCIES } from '../constants.js';

const COLORS = {
  scrapMetal:     0xaaaaaa,
  plasmaCrystals: 0x00f5ff,
  bioEssence:     0x39ff14,
  darkMatter:     0x9b30ff,
  stellarDust:    0xffd700,
};

export class LootDrop {
  constructor(pos, currencyType, amount, scene) {
    this.currencyType = currencyType;
    this.amount = amount;
    this.active = true;
    this.collisionRadius = 0.5;
    this._time = Math.random() * Math.PI * 2;
    this._baseY = pos.y + 0.5;

    const geo = new THREE.OctahedronGeometry(0.22, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS[currencyType] || 0xffffff,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos);
    this.mesh.position.y = this._baseY;

    // Glow light
    const color = COLORS[currencyType] || 0xffffff;
    this._light = new THREE.PointLight(color, 0.8, 2.5);
    this._light.position.copy(this.mesh.position);
    scene.groups.loot.add(this.mesh);
    scene.groups.loot.add(this._light);
    this._scene = scene;
  }

  update(delta) {
    if (!this.active) return;
    this._time += delta * 2.5;
    this.mesh.position.y = this._baseY + Math.sin(this._time) * 0.2;
    this.mesh.rotation.y += delta * 2;
    this._light.position.copy(this.mesh.position);
    // Pulse light
    this._light.intensity = 0.6 + Math.sin(this._time * 3) * 0.2;
  }

  collect() {
    this.active = false;
    this._scene.groups.loot.remove(this.mesh);
    this._scene.groups.loot.remove(this._light);
  }

  get position() { return this.mesh.position; }
}
