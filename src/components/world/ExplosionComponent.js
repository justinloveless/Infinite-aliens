import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

/** Particle burst that self-destroys after 0.6s. */
export class ExplosionComponent extends Component {
  constructor({ color = 0xff6600, scale = 1 } = {}) {
    super();
    this.color = color;
    this.scale = scale;
    this._lifetime = 0;
    this._maxLifetime = 0.6;
    this._scene = null;
    this._group = new THREE.Group();

    const count = 8 + Math.floor(scale * 6);
    const geo = new THREE.SphereGeometry(0.08 * scale, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color });
    this._particles = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6 * scale,
        (Math.random() - 0.5) * 6 * scale,
        (Math.random() - 0.5) * 6 * scale,
      );
      this._particles.push({ mesh, vel });
      this._group.add(mesh);
    }
    this._light = new THREE.PointLight(color, 3 * scale, 6 * scale);
    this._group.add(this._light);
  }

  onAttach(ctx) {
    this._scene = ctx.scene;
    const t = this.entity.get('TransformComponent');
    if (t) this._group.position.copy(t.position);
    ctx.scene.groups.effects.add(this._group);
  }

  onDetach() {
    if (this._scene) this._scene.groups.effects.remove(this._group);
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
    });
  }

  update(dt) {
    this._lifetime += dt;
    const t = this._lifetime / this._maxLifetime;
    if (t >= 1) { this.entity.destroy(); return; }
    const easeOut = 1 - t;
    for (const p of this._particles) {
      p.mesh.position.addScaledVector(p.vel, dt * easeOut);
      p.mesh.scale.setScalar(1 - t * 0.8);
      p.mesh.material.opacity = easeOut;
    }
    this._light.intensity = easeOut * 3;
  }
}
