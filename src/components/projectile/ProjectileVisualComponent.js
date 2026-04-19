import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

// Shared geometry + color tables. These are also the source of truth for
// the InstancedMesh buckets inside ProjectileRenderer.

const GEO_CACHE = {};
const OVERRIDE_GEO_CACHE = new Map();
const MANUAL_HEAT_HEX_CACHE = new Map();

function getManualHeatHex(heatRatio) {
  const step = Math.round(Math.min(1, Math.max(0, heatRatio)) * 10);
  let hex = MANUAL_HEAT_HEX_CACHE.get(step);
  if (hex == null) {
    const cool = new THREE.Color(0xffe030);
    const hot = new THREE.Color(0xff1800);
    cool.lerp(hot, step / 10);
    cool.multiplyScalar(1.5 + (step / 10) * 1.5);
    hex = cool.getHex();
    MANUAL_HEAT_HEX_CACHE.set(step, hex);
  }
  return hex;
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
 * Allocates an instance slot in the central ProjectileRenderer (falls back to
 * a per-projectile Mesh only if the renderer is unavailable, e.g. in tests).
 * Per-frame update writes the entity's position into the instanced matrix.
 */
export class ProjectileVisualComponent extends Component {
  constructor({ type = 'laser', heatRatio = 0, visualOverride = null } = {}) {
    super();
    this.type = type;
    this._handle = null;
    this._fallbackMesh = null;
    this._scene = null;

    const geo = visualOverride?.geometry ? geoFromSpec(visualOverride.geometry) : geoOf(type);
    const scale = visualOverride?.scale ?? 1;
    const rotateX = (type === 'laser' || type === 'manual');

    let colorHex;
    if (type === 'manual' && !visualOverride?.color) {
      colorHex = getManualHeatHex(heatRatio);
    } else if (visualOverride?.color) {
      colorHex = new THREE.Color(visualOverride.color).getHex();
    } else {
      colorHex = TYPE_COLORS[type] ?? 0xffffff;
    }

    this._spec = {
      // Bucket key must capture everything that defines the InstancedMesh's
      // appearance except per-instance color. Color is applied per-instance.
      key: `${type}|${visualOverride ? JSON.stringify(visualOverride.geometry || null) : 'default'}|s${scale}|r${rotateX ? 1 : 0}`,
      geometry: geo,
      scale,
      rotateX,
      color: 0xffffff, // base white; tint is supplied per-instance
    };
    this._instanceColorHex = colorHex;
  }

  onAttach(ctx) {
    this._scene = ctx?.scene ?? null;
    const renderer = ctx?.projectileRenderer;
    if (renderer) {
      this._handle = renderer.allocate(this._spec);
      this._handle.setColor(this._instanceColorHex);
      const t = this.entity?.get('TransformComponent');
      if (t) this._handle.setPosition(t.position);
      return;
    }
    // Fallback: regular Mesh (matches the original behavior).
    const mat = new THREE.MeshBasicMaterial({ color: this._instanceColorHex });
    const mesh = new THREE.Mesh(this._spec.geometry, mat);
    mesh.scale.setScalar(this._spec.scale);
    if (this._spec.rotateX) mesh.rotation.x = Math.PI / 2;
    this._fallbackMesh = mesh;
    ctx?.scene?.groups.projectiles.add(mesh);
  }

  onDetach() {
    if (this._handle) {
      this._handle.release();
      this._handle = null;
    }
    if (this._fallbackMesh) {
      const parent = this._fallbackMesh.parent;
      if (parent) parent.remove(this._fallbackMesh);
      this._fallbackMesh.material?.dispose?.();
      this._fallbackMesh = null;
    }
  }

  update() {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;
    if (this._handle) {
      this._handle.setPosition(t.position);
    } else if (this._fallbackMesh) {
      this._fallbackMesh.position.copy(t.position);
    }
  }
}
