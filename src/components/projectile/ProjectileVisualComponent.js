import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

const GEO_CACHE = {};
const OVERRIDE_GEO_CACHE = new Map();
const MANUAL_HEAT_MAT_CACHE = new Map();

function getManualHeatMaterial(heatRatio) {
  const step = Math.round(Math.min(1, Math.max(0, heatRatio)) * 10);
  if (!MANUAL_HEAT_MAT_CACHE.has(step)) {
    const cool = new THREE.Color(0xffe030);
    const hot = new THREE.Color(0xff1800);
    cool.lerp(hot, step / 10);
    cool.multiplyScalar(1.5 + (step / 10) * 1.5);
    const mat = new THREE.MeshBasicMaterial({ color: cool });
    mat._matKey = `manual_heat_${step}`;
    MANUAL_HEAT_MAT_CACHE.set(step, mat);
  }
  return MANUAL_HEAT_MAT_CACHE.get(step);
}

function geoOf(type) {
  if (!GEO_CACHE[type]) {
    switch (type) {
      case 'laser':
      case 'manual':   GEO_CACHE[type] = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6); break;
      case 'missile':  GEO_CACHE[type] = new THREE.ConeGeometry(0.07, 0.5, 6); break;
      case 'plasma':   GEO_CACHE[type] = new THREE.SphereGeometry(0.13, 6, 6); break;
      case 'enemy':    GEO_CACHE[type] = new THREE.SphereGeometry(0.1, 5, 5); break;
      default:         GEO_CACHE[type] = new THREE.SphereGeometry(0.15, 6, 6);
    }
  }
  return GEO_CACHE[type];
}

function geoFromSpec(geoSpec) {
  const key = JSON.stringify(geoSpec);
  if (!OVERRIDE_GEO_CACHE.has(key)) {
    const p = geoSpec.params || [];
    let geo;
    switch (geoSpec.type) {
      case 'sphere': geo = new THREE.SphereGeometry(...p); break;
      case 'box': geo = new THREE.BoxGeometry(...p); break;
      case 'cone': geo = new THREE.ConeGeometry(...p); break;
      case 'cylinder': geo = new THREE.CylinderGeometry(...p); break;
      case 'octahedron': geo = new THREE.OctahedronGeometry(...p); break;
      case 'tetrahedron': geo = new THREE.TetrahedronGeometry(...p); break;
      default: geo = new THREE.SphereGeometry(0.15, 6, 6);
    }
    OVERRIDE_GEO_CACHE.set(key, geo);
  }
  return OVERRIDE_GEO_CACHE.get(key);
}

const TYPE_COLORS = {
  laser:   0x00f5ff,
  manual:  0xffe030,
  missile: 0xff8800,
  plasma:  0xff00ff,
  enemy:   0xff2233,
};

/**
 * Builds & owns the projectile's THREE mesh. The mesh mirrors the entity's
 * TransformComponent each frame via its own update().
 */
export class ProjectileVisualComponent extends Component {
  constructor({ type = 'laser', heatRatio = 0, visualOverride = null } = {}) {
    super();
    this.type = type;

    const geo = visualOverride?.geometry ? geoFromSpec(visualOverride.geometry) : geoOf(type);
    let mat;
    if (type === 'manual' && !visualOverride?.color) {
      mat = getManualHeatMaterial(heatRatio);
    } else {
      const color = visualOverride?.color
        ? new THREE.Color(visualOverride.color).getHex()
        : TYPE_COLORS[type] ?? 0xffffff;
      mat = new THREE.MeshBasicMaterial({ color });
    }
    this.mesh = new THREE.Mesh(geo, mat);
    const scale = visualOverride?.scale ?? 1;
    this.mesh.scale.setScalar(scale);
    if (type === 'laser' || type === 'manual') this.mesh.rotation.x = Math.PI / 2;
  }

  onAttach(ctx) {
    ctx?.scene?.groups.projectiles.add(this.mesh);
  }

  onDetach() {
    const parent = this.mesh.parent;
    if (parent) parent.remove(this.mesh);
    // Don't dispose cached geometry/materials.
  }

  update() {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;
    this.mesh.position.copy(t.position);
  }
}
