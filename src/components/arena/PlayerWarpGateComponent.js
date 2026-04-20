import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

/** Visual for the player's warp gate that builds over time during the boss arena. */
export class PlayerWarpGateComponent extends Component {
  constructor({ position }) {
    super();
    this._spawnPos = position.clone();
    this._group = null;
    this._rotTime = 0;
  }

  onAttach(ctx) {
    this._group = new THREE.Group();
    this._group.position.copy(this._spawnPos);

    // Wireframe ring (starts as ghost)
    const torusGeo = new THREE.TorusGeometry(4, 0.3, 8, 48);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff, emissive: 0x00f5ff, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.25, wireframe: false,
    });
    this._torus = new THREE.Mesh(torusGeo, torusMat);
    this._group.add(this._torus);

    const innerGeo = new THREE.TorusGeometry(3, 0.15, 6, 48);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x9b30ff, emissive: 0x9b30ff, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.1,
    });
    this._inner = new THREE.Mesh(innerGeo, innerMat);
    this._inner.rotation.x = Math.PI * 0.5;
    this._group.add(this._inner);

    // Portal disc (fully transparent until built)
    const discGeo = new THREE.CircleGeometry(3.8, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
    });
    this._disc = new THREE.Mesh(discGeo, discMat);
    this._group.add(this._disc);

    this._light = new THREE.PointLight(0x00f5ff, 0, 14);
    this._group.add(this._light);

    ctx.scene.groups.effects.add(this._group);
  }

  /** @param {number} progress - 0..1 */
  setProgress(progress) {
    if (!this._torus) return;
    const p = Math.max(0, Math.min(1, progress));
    this._torus.material.opacity = 0.2 + p * 0.75;
    this._torus.material.emissiveIntensity = 0.3 + p * 2.0;
    this._inner.material.opacity = p * 0.6;
    this._inner.material.emissiveIntensity = p * 1.5;
    this._disc.material.opacity = p * 0.35;
    this._light.intensity = p * 4;
  }

  update(dt) {
    if (!this._group) return;
    this._rotTime += dt;
    this._torus.rotation.y = this._rotTime * 0.5;
    this._inner.rotation.y = -this._rotTime * 0.7;
  }

  onDetach() {
    if (this._group) {
      this._group.parent?.remove(this._group);
      this._group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this._group = null;
    }
  }
}
