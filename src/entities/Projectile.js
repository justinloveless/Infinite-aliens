import * as THREE from 'three';

// Geometry/material cache
const GEO_CACHE = {};
const MAT_CACHE = {};

function getLaserGeo() {
  if (!GEO_CACHE.laser) GEO_CACHE.laser = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6);
  return GEO_CACHE.laser;
}
function getMissileGeo() {
  if (!GEO_CACHE.missile) GEO_CACHE.missile = new THREE.ConeGeometry(0.07, 0.5, 6);
  return GEO_CACHE.missile;
}
function getPlasmaGeo() {
  if (!GEO_CACHE.plasma) GEO_CACHE.plasma = new THREE.SphereGeometry(0.13, 6, 6);
  return GEO_CACHE.plasma;
}
function getEnemyGeo() {
  if (!GEO_CACHE.enemy) GEO_CACHE.enemy = new THREE.SphereGeometry(0.1, 5, 5);
  return GEO_CACHE.enemy;
}

const TYPE_CONFIGS = {
  laser:   { geo: getLaserGeo,   color: 0x00f5ff, emissive: 0x00a0cc, speed: 28, isHoming: false },
  missile: { geo: getMissileGeo, color: 0xff8800, emissive: 0xcc4400, speed: 20, isHoming: true  },
  plasma:  { geo: getPlasmaGeo,  color: 0xff00ff, emissive: 0x880088, speed: 22, isHoming: false },
  enemy:   { geo: getEnemyGeo,   color: 0xff2233, emissive: 0x880011, speed: 14, isHoming: false },
};

export class Projectile {
  constructor() {
    this.active = false;
    this.isPlayerProjectile = true;
    this.damage = 0;
    this.isCrit = false;
    this.speed = 0;
    this.isHoming = false;
    this._target = null;
    this.collisionRadius = 0.2;
    this.mesh = new THREE.Mesh();
    this.mesh.visible = false;
    this._light = null;
  }

  activate(pos, dir, damage, isCrit, type, isPlayer, target) {
    const cfg = TYPE_CONFIGS[type] || TYPE_CONFIGS.laser;

    this.active = true;
    this.isPlayerProjectile = isPlayer;
    this.damage = damage;
    this.isCrit = isCrit;
    this.speed = cfg.speed;
    this.isHoming = cfg.isHoming && !!target;
    this._target = target || null;
    this._type = type;

    this.mesh.geometry = cfg.geo();
    if (!this.mesh.material || this.mesh.material._type !== type) {
      this.mesh.material = new THREE.MeshBasicMaterial({
        color: cfg.color,
      });
      this.mesh.material._type = type;
    }

    this.mesh.position.copy(pos);
    this._dir = dir.clone().normalize();

    // Orient along direction
    if (type === 'laser') {
      this.mesh.rotation.x = Math.PI / 2;
    }
    this.mesh.visible = true;

    return this;
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
    this._target = null;
  }

  update(delta) {
    if (!this.active) return;

    if (this.isHoming && this._target && this._target.active) {
      const toTarget = this._target.group.position.clone()
        .sub(this.mesh.position).normalize();
      this._dir.lerp(toTarget, delta * 4).normalize();
    }

    this.mesh.position.addScaledVector(this._dir, this.speed * delta);

    // Out of bounds check
    const p = this.mesh.position;
    if (p.z < -90 || p.z > 10 || Math.abs(p.x) > 35 || Math.abs(p.y) > 20) {
      this.deactivate();
    }
  }
}
