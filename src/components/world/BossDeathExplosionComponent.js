import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

const DURATION = 4.2;

// Concentric sphere layers, inside-out. Each expands at its own rate and fades
// on a separate opacity curve so the core looks hot and the outer ring looks
// like a dissipating shockwave.
const LAYER_DEFS = [
  { color: 0xffffff, maxR:  8, delay: 0.00, peakT: 0.04, baseOpacity: 1.00 }, // initial flash
  { color: 0xffee55, maxR: 22, delay: 0.04, peakT: 0.10, baseOpacity: 0.70 }, // yellow core
  { color: 0xff8800, maxR: 42, delay: 0.10, peakT: 0.18, baseOpacity: 0.50 }, // orange mid
  { color: 0xff3300, maxR: 62, delay: 0.20, peakT: 0.28, baseOpacity: 0.28 }, // red shockwave
];

const EMBER_COUNT = 60;

const _tmpPos    = new THREE.Vector3();
const _tmpQuat   = new THREE.Quaternion();
const _tmpScale  = new THREE.Vector3();
const _tmpMatrix = new THREE.Matrix4();

export class BossDeathExplosionComponent extends Component {
  constructor() {
    super();
    this._lifetime   = 0;
    this._group      = new THREE.Group();
    this._layers     = [];
    this._emberMesh  = null;
    this._emberMat   = null;
    this._emberGeo   = null;
    this._positions  = null;
    this._velocities = null;
    this._light      = null;
    this._lightPool  = null;
    this._scene      = null;
  }

  onAttach(ctx) {
    this._scene = ctx.scene;
    const t = this.entity.get('TransformComponent');
    if (t) this._group.position.copy(t.position);

    for (const def of LAYER_DEFS) {
      const geo = new THREE.SphereGeometry(1, 28, 18);
      const mat = new THREE.MeshBasicMaterial({
        color:      def.color,
        transparent: true,
        opacity:    0,
        blending:   THREE.AdditiveBlending,
        depthWrite: false,
        side:       THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.scale.setScalar(0.01);
      this._group.add(mesh);
      this._layers.push({ mesh, mat, geo, ...def });
    }

    // Ember particle cloud — instanced spheres flying outward
    this._positions  = new Float32Array(EMBER_COUNT * 3);
    this._velocities = new Float32Array(EMBER_COUNT * 3);
    this._emberGeo   = new THREE.SphereGeometry(0.55, 4, 3);
    this._emberMat   = new THREE.MeshBasicMaterial({
      color:      0xff7700,
      transparent: true,
      opacity:    0.9,
      blending:   THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._emberMesh = new THREE.InstancedMesh(this._emberGeo, this._emberMat, EMBER_COUNT);
    this._emberMesh.frustumCulled = false;
    this._emberMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < EMBER_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const speed = 10 + Math.random() * 20;
      this._velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * speed;
      this._velocities[i * 3 + 1] = Math.cos(phi) * speed;
      this._velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      _tmpPos.set(0, 0, 0);
      _tmpQuat.identity();
      _tmpScale.set(1, 1, 1);
      _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
      this._emberMesh.setMatrixAt(i, _tmpMatrix);
    }
    this._emberMesh.instanceMatrix.needsUpdate = true;
    this._group.add(this._emberMesh);

    ctx.scene.groups.effects.add(this._group);

    this._lightPool = ctx.lightPool ?? null;
    if (this._lightPool) {
      this._light = this._lightPool.acquire(0xff6600, 0, 140);
      if (this._light) this._light.position.copy(this._group.position);
    }
  }

  onDetach() {
    if (this._scene) this._scene.groups.effects.remove(this._group);
    if (this._lightPool) this._lightPool.release(this._light);
    this._light     = null;
    this._lightPool = null;
    for (const layer of this._layers) {
      layer.geo.dispose();
      layer.mat.dispose();
    }
    this._emberGeo?.dispose();
    this._emberMat?.dispose();
  }

  update(dt) {
    this._lifetime += dt;
    const globalT = this._lifetime / DURATION;
    if (globalT >= 1) { this.entity.destroy(); return; }

    // Sphere layers
    for (const layer of this._layers) {
      const remain = DURATION - layer.delay;
      const lt = Math.max(0, (this._lifetime - layer.delay)) / remain;
      if (lt <= 0) { layer.mat.opacity = 0; continue; }

      // Cubic ease-out expansion: fast start, decelerates to final radius
      const clampedLt = Math.min(lt, 1);
      const scale = layer.maxR * (1 - Math.pow(1 - clampedLt, 3));
      layer.mesh.scale.setScalar(Math.max(0.01, scale));

      // Opacity arc: rises quickly to peak then slowly decays
      const opT = lt < layer.peakT
        ? lt / layer.peakT
        : 1 - (lt - layer.peakT) / (1 - layer.peakT);
      layer.mat.opacity = layer.baseOpacity * Math.max(0, opT);
    }

    // Embers
    const easeOut = Math.max(0, 1 - globalT);
    const pos = this._positions;
    const vel = this._velocities;
    for (let i = 0; i < EMBER_COUNT; i++) {
      const i3 = i * 3;
      pos[i3]     += vel[i3]     * dt * easeOut;
      pos[i3 + 1] += vel[i3 + 1] * dt * easeOut;
      pos[i3 + 2] += vel[i3 + 2] * dt * easeOut;
      const s = Math.max(0.05, (1 - globalT) * 0.9);
      _tmpPos.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
      _tmpQuat.identity();
      _tmpScale.setScalar(s);
      _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
      this._emberMesh.setMatrixAt(i, _tmpMatrix);
    }
    this._emberMesh.instanceMatrix.needsUpdate = true;
    this._emberMat.opacity = easeOut * 0.9;

    // Dynamic light: bright flash then long decay
    if (this._light) {
      const peakT  = 0.08;
      const lightT = globalT < peakT
        ? globalT / peakT
        : Math.max(0, 1 - (globalT - peakT) / (1 - peakT));
      this._light.intensity = lightT * 60;
      this._light.distance  = 80 + globalT * 80;
    }
  }
}
