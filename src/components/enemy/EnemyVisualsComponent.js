import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

export const reticleDebug = {
  offsetX: Math.PI / 2,
  offsetY: 0,
  offsetZ: 0,
};

/**
 * Owns the visual group for an enemy (body, eyes, HP bar, target reticle) and
 * handles flash-on-hit, HP bar sync, vision-range culling, and camera-facing
 * HP billboard. Synced to the entity's TransformComponent each frame.
 */
export class EnemyVisualsComponent extends Component {
  constructor({ def }) {
    super();
    this.def = def;
    this._time = 0;
    this._reticleAngle = 0;
    this._flashTimer = 0;
    this._scene = null;
    this.group = new THREE.Group();
    this._spinGroup = new THREE.Group();
    this.group.add(this._spinGroup);
    this._buildBody();
    this._buildHpBar();
    this._buildReticle();
    this.group.scale.setScalar(def.scale || 1);
  }

  _buildBody() {
    const def = this.def;
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: new THREE.Color(def.color).multiplyScalar(0.25),
      metalness: 0.5,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(def.geometry.clone(), mat);
    this._spinGroup.add(mesh);
    this._bodyMesh = mesh;

    if (def.type !== 'boss') {
      const eyeGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [-0.15, 0.15].forEach(x => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 0.15, -def.eyeZ || -0.3);
        this._spinGroup.add(eye);
      });
    }
  }

  _buildHpBar() {
    const trackGeo = new THREE.PlaneGeometry(1.2, 0.12);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 });
    this._hpTrack = new THREE.Mesh(trackGeo, trackMat);
    this._hpTrack.position.set(0, 1.5, 0);
    const barGeo = new THREE.PlaneGeometry(1.1, 0.08);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    this._hpBar = new THREE.Mesh(barGeo, barMat);
    this._hpBar.position.set(0, 1.5, 0.01);
    this._hpBarMat = barMat;
    this.group.add(this._hpTrack);
    this.group.add(this._hpBar);
  }

  _buildReticle() {
    const def = this.def;
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    this._reticle = new THREE.Group();
    const r = (def.collisionRadius / (def.scale || 1)) * 1.35;
    const armLen = r * 0.45;
    const thick = 0.055 / (def.scale || 1);
    const corners = [
      { cx:  r, cz:  r }, { cx: -r, cz:  r },
      { cx:  r, cz: -r }, { cx: -r, cz: -r },
    ];
    for (const c of corners) {
      const sgnX = Math.sign(c.cx);
      const sgnZ = Math.sign(c.cz);
      const hMesh = new THREE.Mesh(new THREE.BoxGeometry(armLen, thick, thick), mat);
      hMesh.position.set(c.cx + sgnX * armLen / 2, 0, c.cz);
      this._reticle.add(hMesh);
      const vMesh = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, armLen), mat);
      vMesh.position.set(c.cx, 0, c.cz + sgnZ * armLen / 2);
      this._reticle.add(vMesh);
    }
    this._reticle.position.y = 0.25 / (def.scale || 1);
    this._reticle.visible = false;
    this.group.add(this._reticle);
  }

  onAttach(ctx) {
    this._scene = ctx.scene;
    ctx.scene.groups.enemies.add(this.group);
  }

  onDetach() {
    if (this._scene) this._scene.groups.enemies.remove(this.group);
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  setTargeted(v) { if (this._reticle) this._reticle.visible = !!v; }

  flash() {
    if (!this._bodyMesh) return;
    this._bodyMesh.material.emissive.setHex(0xffffff);
    this._flashTimer = 0.08;
  }

  syncHp(ratio) {
    this._hpBar.scale.x = Math.max(0.01, ratio);
    this._hpBar.position.x = -((1 - ratio) * 0.55);
    if (ratio > 0.5) this._hpBarMat.color.setHex(0x39ff14);
    else if (ratio > 0.25) this._hpBarMat.color.setHex(0xffaa00);
    else this._hpBarMat.color.setHex(0xff2200);
  }

  update(dt, ctx) {
    this._time += dt;
    const t = this.entity.get('TransformComponent');
    if (t) {
      this.group.position.copy(t.position);
      this.group.rotation.copy(t.rotation);
    }

    const health = this.entity.get('HealthComponent');
    if (health) this.syncHp(health.hp / Math.max(1, health.maxHp));

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        const base = new THREE.Color(this._bodyMesh.material.color).multiplyScalar(0.25);
        this._bodyMesh.material.emissive.copy(base);
      }
    }

    if (this._reticle?.visible) {
      this._reticleAngle += dt * 1.1;
      this._reticle.rotation.x = reticleDebug.offsetX;
      this._reticle.rotation.y = reticleDebug.offsetY + this._reticleAngle;
      this._reticle.rotation.z = reticleDebug.offsetZ;
    }

    const camera = ctx?.scene?.camera;
    if (camera) {
      this._hpTrack.quaternion.copy(camera.quaternion);
      this._hpBar.quaternion.copy(camera.quaternion);
    }

    const playerEnt = ctx?.playerEntity;
    const playerT = playerEnt?.get('TransformComponent');
    if (playerT) {
      const visionRange = playerEnt.get('PlayerStatsComponent')?.visionRange ?? Infinity;
      const dx = this.group.position.x - playerT.position.x;
      const dz = this.group.position.z - playerT.position.z;
      const d2 = dx * dx + dz * dz;
      this.group.visible = d2 <= visionRange * visionRange;
    }

    if (this.def.type !== 'boss') this._spinGroup.rotation.y += dt * 0.6;
  }

  get spinGroup() { return this._spinGroup; }
}
