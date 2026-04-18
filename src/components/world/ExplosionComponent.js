import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

// Reused between explosions - we only allocate these scratch objects once.
const _tmpMatrix = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();

/** Particle burst that self-destroys after 0.6s. */
export class ExplosionComponent extends Component {
  constructor({ color = 0xff6600, scale = 1 } = {}) {
    super();
    this.color = color;
    this.scale = scale;
    this._lifetime = 0;
    this._maxLifetime = 0.6;
    this._scene = null;

    const count = 8 + Math.floor(scale * 6);
    const geo = new THREE.SphereGeometry(0.08 * scale, 4, 4);
    // Transparent so the fade-out at end of the burst is visible.
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });

    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Each particle gets a unique direction; store in typed arrays so the
    // per-frame loop is branchless and allocation-free.
    this._positions = new Float32Array(count * 3);
    this._velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this._velocities[i * 3]     = (Math.random() - 0.5) * 6 * scale;
      this._velocities[i * 3 + 1] = (Math.random() - 0.5) * 6 * scale;
      this._velocities[i * 3 + 2] = (Math.random() - 0.5) * 6 * scale;
      _tmpPos.set(0, 0, 0);
      _tmpQuat.identity();
      _tmpScale.set(1, 1, 1);
      _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
      mesh.setMatrixAt(i, _tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this._mesh = mesh;
    this._count = count;
    this._material = mat;
    this._geometry = geo;

    // Light is acquired from a pool on attach to avoid mutating the scene
    // graph's light count (which would invalidate every MeshStandardMaterial
    // shader program and force a multi-hundred-ms ANGLE/D3D11 recompile).
    this._light = null;
    this._lightPool = null;

    this._group = new THREE.Group();
    this._group.add(this._mesh);
  }

  onAttach(ctx) {
    this._scene = ctx.scene;
    const t = this.entity.get('TransformComponent');
    if (t) this._group.position.copy(t.position);
    ctx.scene.groups.effects.add(this._group);

    this._lightPool = ctx.lightPool ?? null;
    if (this._lightPool) {
      this._light = this._lightPool.acquire(this.color, 3 * this.scale, 6 * this.scale);
      if (this._light) this._light.position.copy(this._group.position);
    }
  }

  onDetach() {
    if (this._scene) this._scene.groups.effects.remove(this._group);
    if (this._lightPool) this._lightPool.release(this._light);
    this._light = null;
    this._lightPool = null;
    this._mesh.dispose();
    this._geometry.dispose();
    this._material.dispose();
  }

  update(dt) {
    this._lifetime += dt;
    const t = this._lifetime / this._maxLifetime;
    if (t >= 1) { this.entity.destroy(); return; }
    const easeOut = 1 - t;
    const particleScale = 1 - t * 0.8;
    _tmpQuat.identity();
    _tmpScale.set(particleScale, particleScale, particleScale);
    const pos = this._positions;
    const vel = this._velocities;
    for (let i = 0; i < this._count; i++) {
      const i3 = i * 3;
      pos[i3]     += vel[i3]     * dt * easeOut;
      pos[i3 + 1] += vel[i3 + 1] * dt * easeOut;
      pos[i3 + 2] += vel[i3 + 2] * dt * easeOut;
      _tmpPos.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
      this._mesh.setMatrixAt(i, _tmpMatrix);
    }
    this._mesh.instanceMatrix.needsUpdate = true;
    this._material.opacity = easeOut;
    if (this._light) this._light.intensity = easeOut * 3 * this.scale;
  }
}
