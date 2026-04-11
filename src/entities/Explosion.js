import * as THREE from 'three';

export class Explosion {
  constructor(pos, color, scale, scene) {
    this._particles = [];
    this._light = null;
    this._lifetime = 0;
    this._maxLifetime = 0.6;
    this.alive = true;
    this._scene = scene;
    this._group = new THREE.Group();
    this._group.position.copy(pos);
    scene.groups.effects.add(this._group);

    const count = 8 + Math.floor(scale * 6);
    const geo = new THREE.SphereGeometry(0.08 * scale, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6 * scale,
        (Math.random() - 0.5) * 6 * scale,
        (Math.random() - 0.5) * 6 * scale
      );
      this._particles.push({ mesh, vel });
      this._group.add(mesh);
    }

    this._light = new THREE.PointLight(color, 3 * scale, 6 * scale);
    this._group.add(this._light);
  }

  update(delta) {
    if (!this.alive) return;
    this._lifetime += delta;
    const t = this._lifetime / this._maxLifetime;

    if (t >= 1) {
      this.destroy();
      return;
    }

    const easeOut = 1 - t;
    this._particles.forEach(p => {
      p.mesh.position.addScaledVector(p.vel, delta * easeOut);
      p.mesh.scale.setScalar(1 - t * 0.8);
      p.mesh.material.opacity = easeOut;
    });
    this._light.intensity = (1 - t) * 3;
  }

  destroy() {
    this.alive = false;
    this._scene.groups.effects.remove(this._group);
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
    });
  }
}
