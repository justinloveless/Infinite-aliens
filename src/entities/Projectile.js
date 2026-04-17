import * as THREE from 'three';

// Geometry/material cache for default types
const GEO_CACHE = {};
const OVERRIDE_GEO_CACHE = new Map(); // JSON key -> geometry
// Heat-stepped material cache for manual cannon (10 steps → reuse materials across shots)
const MANUAL_HEAT_MAT_CACHE = new Map(); // step (0-10) -> THREE.MeshBasicMaterial

function getManualHeatMaterial(heatRatio) {
  const step = Math.round(Math.min(1, Math.max(0, heatRatio)) * 10);
  if (!MANUAL_HEAT_MAT_CACHE.has(step)) {
    const cool = new THREE.Color(0xffe030);
    const hot  = new THREE.Color(0xff1800);
    cool.lerp(hot, step / 10);
    // Scale above 1.0 for HDR bloom: 1.5× cool → 3.0× max heat
    cool.multiplyScalar(1.5 + (step / 10) * 1.5);
    const mat = new THREE.MeshBasicMaterial({ color: cool });
    mat._matKey = `manual_heat_${step}`;
    MANUAL_HEAT_MAT_CACHE.set(step, mat);
  }
  return MANUAL_HEAT_MAT_CACHE.get(step);
}

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

// Build or retrieve a cached geometry from a declarative spec
function buildGeoFromSpec(geoSpec) {
  if (!geoSpec) return getLaserGeo();
  const key = JSON.stringify(geoSpec);
  if (!OVERRIDE_GEO_CACHE.has(key)) {
    const p = geoSpec.params || [];
    let geo;
    switch (geoSpec.type) {
      case 'sphere':    geo = new THREE.SphereGeometry(...p); break;
      case 'box':       geo = new THREE.BoxGeometry(...p); break;
      case 'cone':      geo = new THREE.ConeGeometry(...p); break;
      case 'cylinder':  geo = new THREE.CylinderGeometry(...p); break;
      case 'octahedron':geo = new THREE.OctahedronGeometry(...p); break;
      case 'tetrahedron':geo = new THREE.TetrahedronGeometry(...p); break;
      default:          geo = new THREE.SphereGeometry(0.15, 6, 6);
    }
    OVERRIDE_GEO_CACHE.set(key, geo);
  }
  return OVERRIDE_GEO_CACHE.get(key);
}

export const TYPE_CONFIGS = {
  laser:   { geo: getLaserGeo,   color: 0x00f5ff, emissive: 0x00a0cc, speed: 28, isHoming: false },
  /** Nose cannon — same ballistics as laser bolt, distinct warm color */
  manual:  { geo: getLaserGeo,   color: 0xffe030, emissive: 0xaa8000, speed: 28, isHoming: false },
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
    this.piercesLeft = 0;
    this._hitEnemies = new Set();
  }

  // visualOverride: optional ProjectileVisual spec from upgrade grammar
  // pierces: number of additional enemies this projectile passes through
  // heatRatio: 0–1, only used for 'manual' type to shift color toward red + boost bloom
  activate(pos, dir, damage, isCrit, type, isPlayer, target, visualOverride = null, pierces = 0, heatRatio = 0) {
    const cfg = TYPE_CONFIGS[type] || TYPE_CONFIGS.laser;

    this.active = true;
    this.isPlayerProjectile = isPlayer;
    this.damage = damage;
    this.isCrit = isCrit;
    this.speed = cfg.speed;
    this.isHoming = cfg.isHoming && !!target;
    this._target = target || null;
    this._type = type;
    this.piercesLeft = pierces;
    this._hitEnemies.clear();

    // Geometry: use override spec if provided, else default
    const geo = (visualOverride?.geometry)
      ? buildGeoFromSpec(visualOverride.geometry)
      : cfg.geo();
    this.mesh.geometry = geo;

    // Manual cannon: heat-based HDR color (yellow → red, brightness 1.5×→3.0×)
    if (type === 'manual' && !visualOverride?.color) {
      this.mesh.material = getManualHeatMaterial(heatRatio);
    } else {
      // Color: use override color if provided
      const color = visualOverride?.color
        ? new THREE.Color(visualOverride.color).getHex()
        : cfg.color;

      const matKey = `${type}:${color}`;
      if (!this.mesh.material || this.mesh.material._matKey !== matKey) {
        this.mesh.material = new THREE.MeshBasicMaterial({ color });
        this.mesh.material._matKey = matKey;
      }
    }

    // Scale override
    const scale = visualOverride?.scale ?? 1;
    this.mesh.scale.setScalar(scale);

    this.mesh.position.copy(pos);
    this._dir = dir.clone().normalize();

    // Orient along direction
    if (type === 'laser' || type === 'manual') {
      this.mesh.rotation.x = Math.PI / 2;
    } else {
      this.mesh.rotation.set(0, 0, 0);
    }
    this.mesh.visible = true;

    return this;
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
    this._target = null;
    this._hitEnemies.clear();
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
