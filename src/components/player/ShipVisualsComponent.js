import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { PLAYER } from '../../constants.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { buildShipHull } from '../../scene/ShipMeshFactory.js';
import { getActiveShipDef, getActiveShipSlots } from '../../data/ships.js';

const MAGNET_VERTEX = `
varying float vR;
void main() {
  vR = length(position.xy);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const MAGNET_FRAGMENT = `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
varying float vR;
void main() {
  if (vR > 0.998) discard;
  float inward1 = 0.5 + 0.5 * sin(vR * 26.0 + uTime * 5.2);
  float inward2 = 0.5 + 0.5 * sin(vR * 15.0 + uTime * 3.1);
  float ribs = inward1 * 0.58 + inward2 * 0.42;
  float edge = smoothstep(1.02, 0.88, vR) * smoothstep(0.05, 0.16, vR);
  float a = ribs * edge * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

const NOVA_VERTEX = MAGNET_VERTEX;
const NOVA_FRAGMENT = `
precision highp float;
uniform float uTime;
uniform float uAge;
uniform vec3 uColor;
uniform float uIntensity;
varying float vR;
void main() {
  if (vR > 0.998) discard;
  float outward1 = 0.5 + 0.5 * sin(vR * 24.0 - uAge * 15.0);
  float outward2 = 0.5 + 0.5 * sin(vR * 14.0 - uAge * 9.0);
  float ribs = outward1 * 0.58 + outward2 * 0.42;
  float shimmer = 0.5 + 0.5 * sin(vR * 20.0 + uTime * 5.5);
  ribs = mix(ribs, ribs * shimmer, 0.12);
  float ringPos = uAge * 1.06;
  float ring = smoothstep(ringPos - 0.15, ringPos - 0.02, vR)
    * smoothstep(ringPos + 0.24, ringPos + 0.05, vR);
  float innerCore = smoothstep(0.2, 0.03, vR) * exp(-uAge * 2.8) * 0.9;
  float edge = smoothstep(1.02, 0.82, vR) * smoothstep(0.04, 0.14, vR);
  float life = 1.0 - smoothstep(0.55, 1.0, uAge);
  float a = (ribs * ring * 1.2 + innerCore + ribs * edge * 0.4 * (1.0 - uAge * 0.85))
    * uIntensity * life;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;

const NOVA_PULSE_DURATION = 0.52;

const ATTACHMENT_ANCHORS = {
  ship:       new THREE.Vector3( 0,    0,    0   ),
  hull:       new THREE.Vector3( 0,    0,    0   ),
  wing_left:  new THREE.Vector3(-0.9,  0,    0.5 ),
  wing_right: new THREE.Vector3( 0.9,  0,    0.5 ),
  cockpit:    new THREE.Vector3( 0,    0,   -0.6 ),
  engine:     new THREE.Vector3( 0,    0,    1.1 ),
};

const TURRET_CFG = {
  laser:   { color: 0x00f5ff, emissive: 0x006688, lightColor: 0x00f5ff },
  missile: { color: 0xff8800, emissive: 0x884400, lightColor: 0xff8800 },
  plasma:  { color: 0xff00ff, emissive: 0x880088, lightColor: 0xff00ff },
  beam:    { color: 0xff1133, emissive: 0x880011, lightColor: 0xff1133 },
};

/**
 * Owns every visual aspect of the player ship: hull meshes, turret mounts,
 * magnet ring, stellar nova pulse, attachments, shield bubble, and visual
 * modifiers from upgrades. Also exposes turret muzzle world positions used by
 * the weapon components.
 */
export class ShipVisualsComponent extends Component {
  constructor() {
    super();
    this._time = 0;
    this._group = new THREE.Group();
    this._turretMeshes = {};
    this._attachments = new Map();
    this._novaActive = false;
    this._novaAge = 0;
    this._novaRadius = PLAYER.STELLAR_NOVA_BASE_RADIUS;
    this._shieldMesh = null;
    this._scene = null;
    /** @type {Map<string, THREE.Group>} */
    this._weaponSlotRoots = new Map();
    this._muzzleForwardLocal = new THREE.Vector3(0, 0, -0.25);
  }

  onAttach(ctx) {
    this._scene = ctx?.scene;
    const scene = this._scene;
    if (!scene) return;

    this._buildMesh();
    this._buildMagnetField();
    this._buildStellarNovaBurst();

    scene.groups.player.add(this._group);
    scene.groups.player.add(this._magnetMesh);
    scene.groups.player.add(this._novaMesh);

    this._snapshotDefaults();

    this.listen(EVENTS.STELLAR_NOVA, (data) => {
      this._startNovaPulse(data?.radius ?? PLAYER.STELLAR_NOVA_BASE_RADIUS);
    });
  }

  onDetach() {
    const scene = this._scene;
    if (scene) {
      scene.groups.player.remove(this._group);
      scene.groups.player.remove(this._magnetMesh);
      scene.groups.player.remove(this._novaMesh);
    }
    const disposeDeep = (obj) => {
      obj.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
          else o.material.dispose?.();
        }
      });
    };
    if (this._group) disposeDeep(this._group);
    if (this._magnetMesh) disposeDeep(this._magnetMesh);
    if (this._novaMesh) disposeDeep(this._novaMesh);
  }

  update(dt, ctx) {
    this._time += dt;
    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    // Mirror transform onto the hull group
    this._group.position.copy(t.position);
    this._group.rotation.copy(t.rotation);

    // Thruster pulse
    const pulse = 1.8 + Math.sin(this._time * 8) * 0.6;
    if (this._thrusterLight) this._thrusterLight.intensity = pulse;

    // Magnet ring
    const stats = this.entity.get('PlayerStatsComponent');
    const mRange = stats?.magnetRange ?? PLAYER.BASE_MAGNET_RANGE;
    if (this._magnetMesh && this._magnetUniforms) {
      this._magnetUniforms.uTime.value = this._time;
      this._magnetMesh.position.x = t.position.x;
      this._magnetMesh.position.y = t.position.y + 0.06;
      this._magnetMesh.position.z = t.position.z;
      this._magnetMesh.scale.setScalar(mRange);
      const phase = ctx?.state?.round?.phase;
      this._magnetMesh.visible = phase === 'combat';
    }

    // Stellar nova pulse
    if (this._novaUniforms) {
      this._novaUniforms.uTime.value = this._time;
      this._novaMesh.position.x = t.position.x;
      this._novaMesh.position.y = t.position.y + 0.07;
      this._novaMesh.position.z = t.position.z;
      this._novaMesh.scale.setScalar(this._novaRadius);
      if (this._novaActive) {
        this._novaAge += dt / NOVA_PULSE_DURATION;
        this._novaUniforms.uAge.value = Math.min(1, this._novaAge);
        if (this._novaAge >= 1) {
          this._novaActive = false;
          this._novaMesh.visible = false;
        }
      }
    }

    // Shield bubble visibility
    const shield = this.entity.get('ShieldComponent');
    if (this._shieldMesh) this._shieldMesh.visible = !!(shield && shield.maxHp > 0 && shield.hp > 0);

    // Attachments orbit
    this._tickAttachments(dt);
  }

  /** World-space muzzle point for a weapon hardpoint slot (ship-local −Z forward). */
  getSlotMuzzleWorldPosition(slotId, out = new THREE.Vector3()) {
    const root = this._weaponSlotRoots.get(slotId) || this._group;
    out.copy(this._muzzleForwardLocal);
    return root.localToWorld(out);
  }

  /** Nose / primary auto slot — same slot used for manual cannon alignment. */
  getPrimaryWeaponMuzzleWorldPosition(out = new THREE.Vector3()) {
    const stats = this.entity?.get('PlayerStatsComponent');
    const sid = stats?.weaponSlotByFireType?.primary || 'weapon_mid';
    return this.getSlotMuzzleWorldPosition(sid, out);
  }

  /** Returns world-space position of a named turret muzzle. */
  getTurretWorldPosition(type, out = new THREE.Vector3()) {
    const stats = this.entity?.get('PlayerStatsComponent');
    const sid = stats?.weaponSlotByFireType?.[type] || 'weapon_mid';
    return this.getSlotMuzzleWorldPosition(sid, out);
  }

  /** Re-parent turrets after hangar slot changes (stats already synced). */
  resyncWeaponTurretParents() {
    const stats = this.entity?.get('PlayerStatsComponent');
    const slotMap = stats?.weaponSlotByFireType;
    for (const type of Object.keys(this._turretMeshes)) {
      this._parentTurretToWeaponSlot(type, slotMap);
    }
  }

  _parentTurretToWeaponSlot(type, slotMap) {
    const turret = this._turretMeshes[type];
    if (!turret) return;
    const slotId = slotMap?.[type] || 'weapon_mid';
    const root = this._weaponSlotRoots.get(slotId) || this._group;
    if (turret.parent !== root) root.add(turret);
    turret.position.set(0, 0, 0);
  }

  /** Adds/removes turret meshes to match the desired set. */
  syncTurrets(types) {
    const desired = new Set(types || []);
    const stats = this.entity?.get('PlayerStatsComponent');
    const slotMap = stats?.weaponSlotByFireType;

    for (const type of Object.keys(this._turretMeshes)) {
      if (!desired.has(type)) {
        const mesh = this._turretMeshes[type];
        if (mesh.parent) mesh.parent.remove(mesh);
        delete this._turretMeshes[type];
      }
    }
    for (const type of desired) {
      if (this._turretMeshes[type]) {
        this._parentTurretToWeaponSlot(type, slotMap);
        continue;
      }
      const turret = this._buildTurretMesh(type);
      this._turretMeshes[type] = turret;
      this._parentTurretToWeaponSlot(type, slotMap);
    }
  }

  /** Called by UpgradeApplier. */
  syncVisualModifiers(modifiers) {
    this._resetToDefaults();
    if (!modifiers?.length) return;
    for (const mod of modifiers) this._applyVisualModifier(mod);
  }

  syncAttachments(attachments) {
    const desired = new Map((attachments || []).map(a => [a.id, a]));
    for (const [id, entry] of this._attachments) {
      if (!desired.has(id)) {
        this._group.remove(entry.object);
        this._attachments.delete(id);
      }
    }
    for (const [id, spec] of desired) {
      if (!this._attachments.has(id)) {
        const obj = this._buildMeshFromDef(spec.mesh);
        this._group.add(obj);
        this._attachments.set(id, { object: obj, spec, phase: spec.orbit?.phase ?? 0 });
      }
    }
  }

  flash(color = 0xff0000) {
    this._group.children.forEach(child => {
      if (child.material?.emissive) {
        const orig = child.material.emissive.getHex();
        child.material.emissive.setHex(color);
        setTimeout(() => {
          if (child.material) child.material.emissive.setHex(orig);
        }, 120);
      }
    });
  }

  // ── Internal build helpers ────────────────────────────────────────────
  _buildMesh() {
    const state = this.world?.ctx?.state;
    // Prefer the ShipComponent attached to this entity — it holds the ship's
    // identity (variant, slots) and behavior. Fall back to looking up the
    // active ship from global state for entities built before the component
    // was attached (shouldn't happen, but belt + suspenders).
    const shipComp = this.entity?.get('ShipComponent');
    const variant = shipComp?.meshVariant
      || getActiveShipDef(state)?.meshVariant
      || 'allrounder';

    const hullGroup = shipComp
      ? shipComp.buildHull({ withLights: true })
      : buildShipHull({ variant, withLights: true });
    this._group.add(hullGroup);
    this._hullGroup = hullGroup;
    this._hull = hullGroup.userData.hull || null;
    this._wingL = hullGroup.userData.wingL || null;
    this._wingR = hullGroup.userData.wingR || null;
    this._engine = hullGroup.userData.engine || null;
    this._cockpit = hullGroup.userData.cockpit || null;

    this._thrusterLight = new THREE.PointLight(0x0088ff, 2.5, 5);
    this._thrusterLight.position.set(0, 0, 1.5);
    this._group.add(this._thrusterLight);

    const shieldGeo = new THREE.SphereGeometry(1.5, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff, wireframe: true, transparent: true, opacity: 0.15,
    });
    this._shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this._shieldMesh.visible = false;
    this._group.add(this._shieldMesh);

    this._buildWeaponSlotRoots(state);
  }

  /** Empty groups at the active ship's weapon positions — turrets parent here. */
  _buildWeaponSlotRoots(state) {
    this._weaponSlotRoots.clear();
    // Same preference order as _buildMesh: ship component on the entity first.
    const shipComp = this.entity?.get('ShipComponent');
    const slots = shipComp?.slots || getActiveShipSlots(state || this.world?.ctx?.state);
    for (const slot of slots) {
      if (slot.type !== 'weapon') continue;
      const g = new THREE.Group();
      const p = slot.position;
      if (Array.isArray(p) && p.length >= 3) g.position.set(p[0], p[1], p[2]);
      this._group.add(g);
      this._weaponSlotRoots.set(slot.id, g);
    }
  }

  _buildMagnetField() {
    const geo = new THREE.CircleGeometry(1, 72);
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x3ec8e8) },
      uIntensity: { value: 0.22 },
    };
    this._magnetUniforms = uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: MAGNET_VERTEX, fragmentShader: MAGNET_FRAGMENT,
      transparent: true, depthWrite: false, depthTest: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 2;
    this._magnetMesh = mesh;
  }

  _buildStellarNovaBurst() {
    const geo = new THREE.CircleGeometry(1, 72);
    const uniforms = {
      uTime: { value: 0 },
      uAge: { value: 0 },
      uColor: { value: new THREE.Color(0xffd7a8) },
      uIntensity: { value: 0.38 },
    };
    this._novaUniforms = uniforms;
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: NOVA_VERTEX, fragmentShader: NOVA_FRAGMENT,
      transparent: true, depthWrite: false, depthTest: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 3;
    this._novaMesh = mesh;
  }

  _startNovaPulse(radius) {
    this._novaRadius = Math.max(1, radius);
    this._novaActive = true;
    this._novaAge = 0;
    if (this._novaMesh) this._novaMesh.visible = true;
    if (this._novaUniforms) {
      this._novaUniforms.uAge.value = 0;
      this._novaUniforms.uIntensity.value = 0.42;
    }
  }

  _buildTurretMesh(type) {
    const cfg = TURRET_CFG[type] || TURRET_CFG.laser;
    const group = new THREE.Group();

    const barrelMat = new THREE.MeshStandardMaterial({
      color: cfg.color, emissive: cfg.emissive, emissiveIntensity: 1.2,
      metalness: 0.3, roughness: 0.4,
    });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 6), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.1;
    group.add(barrel);

    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.6, roughness: 0.4 }),
    );
    pod.rotation.x = Math.PI / 2;
    pod.position.z = 0.18;
    group.add(pod);

    group.add(new THREE.PointLight(cfg.lightColor, 0.9, 2.5));
    return group;
  }

  _snapshotDefaults() {
    const snap = (mesh) => {
      if (!mesh) return null;
      const m = mesh.material;
      return {
        color: m.color?.getHex() ?? 0xffffff,
        emissive: m.emissive?.getHex() ?? 0x000000,
        emissiveIntensity: m.emissiveIntensity ?? 1,
        opacity: m.opacity ?? 1,
        scale: mesh.scale.x,
      };
    };
    this._defaultVisuals = {
      hull: snap(this._hull),
      wing_left: snap(this._wingL),
      wing_right: snap(this._wingR),
      cockpit: snap(this._cockpit),
      engine: snap(this._engine),
    };
  }

  _resetToDefaults() {
    if (!this._defaultVisuals) return;
    const restore = (mesh, d) => {
      if (!mesh || !d) return;
      const m = mesh.material;
      if (m.color) m.color.setHex(d.color);
      if (m.emissive) m.emissive.setHex(d.emissive);
      m.emissiveIntensity = d.emissiveIntensity;
      m.opacity = d.opacity;
      mesh.scale.setScalar(d.scale);
    };
    restore(this._hull, this._defaultVisuals.hull);
    restore(this._wingL, this._defaultVisuals.wing_left);
    restore(this._wingR, this._defaultVisuals.wing_right);
    restore(this._cockpit, this._defaultVisuals.cockpit);
    restore(this._engine, this._defaultVisuals.engine);
  }

  _resolveModTarget(targetName) {
    switch (targetName) {
      case 'hull': return this._hull;
      case 'wing_left': return this._wingL;
      case 'wing_right': return this._wingR;
      case 'cockpit': return this._cockpit;
      case 'engine': return this._engine;
      case 'shield': return this._shieldMesh;
      default: return null;
    }
  }

  _applyVisualModifier(mod) {
    if (mod.target?.startsWith('turret_')) {
      const type = mod.target.replace('turret_', '');
      const turret = this._turretMeshes[type];
      if (!turret) return;
      turret.traverse(c => { if (c.isMesh) this._applyMatOp(c, mod); });
      return;
    }
    if (mod.target?.startsWith('projectile_')) return;
    if (mod.target === 'magnet') {
      if (this._magnetUniforms && mod.property === 'color') {
        this._magnetUniforms.uColor.value.set(mod.value);
      }
      return;
    }
    const mesh = this._resolveModTarget(mod.target);
    if (!mesh) return;
    this._applyMatOp(mesh, mod);
  }

  _applyMatOp(mesh, mod) {
    const { property, op, value } = mod;
    const m = mesh.material;
    if (property === 'scale' || property === 'scale_x' || property === 'scale_y' || property === 'scale_z') {
      const axis = property === 'scale' ? null : property.replace('scale_', '');
      const applyTo = (c) => op === 'multiply' ? c * value : op === 'add' ? c + value : op === 'set' ? value : c;
      if (!axis) mesh.scale.setScalar(applyTo(mesh.scale.x));
      else mesh.scale[axis] = applyTo(mesh.scale[axis]);
      return;
    }
    if (property === 'color' || property === 'emissive') {
      if (!m[property]) return;
      const hex = typeof value === 'string' ? parseInt(value.replace('#', '0x'), 16) : value;
      if (op === 'set') m[property].setHex(hex);
      return;
    }
    if (property === 'emissiveIntensity') {
      if (op === 'multiply') m.emissiveIntensity *= value;
      else if (op === 'add') m.emissiveIntensity += value;
      else if (op === 'set') m.emissiveIntensity = value;
      return;
    }
    if (property === 'opacity') {
      if (op === 'multiply') m.opacity *= value;
      else if (op === 'add') m.opacity += value;
      else if (op === 'set') m.opacity = value;
      m.transparent = m.opacity < 1;
    }
  }

  _tickAttachments(dt) {
    const anchorVec = new THREE.Vector3();
    for (const [, entry] of this._attachments) {
      const { object, spec } = entry;
      const anchor = ATTACHMENT_ANCHORS[spec.anchor] || ATTACHMENT_ANCHORS.ship;
      anchorVec.copy(anchor);
      if (spec.offset) {
        anchorVec.x += spec.offset.x ?? 0;
        anchorVec.y += spec.offset.y ?? 0;
        anchorVec.z += spec.offset.z ?? 0;
      }
      if (spec.orbit) {
        entry.phase += spec.orbit.speed * dt;
        const r = spec.orbit.radius ?? 1;
        const tilt = spec.orbit.tilt ?? 0;
        object.position.set(
          anchorVec.x + r * Math.cos(entry.phase),
          anchorVec.y + r * Math.sin(entry.phase) * Math.sin(tilt),
          anchorVec.z + r * Math.sin(entry.phase) * Math.cos(tilt),
        );
      } else {
        object.position.copy(anchorVec);
      }
    }
  }

  _buildMeshFromDef(meshDef) {
    const group = new THREE.Group();
    if (!meshDef) return group;
    const geo = this._makeGeo(meshDef.geometry);
    const mat = this._makeMat(meshDef.material);
    const mesh = new THREE.Mesh(geo, mat);
    if (meshDef.scale) mesh.scale.setScalar(meshDef.scale);
    if (meshDef.rotation) {
      mesh.rotation.x = meshDef.rotation.x ?? 0;
      mesh.rotation.y = meshDef.rotation.y ?? 0;
      mesh.rotation.z = meshDef.rotation.z ?? 0;
    }
    group.add(mesh);
    if (meshDef.light) {
      const l = meshDef.light;
      const hex = typeof l.color === 'string' ? parseInt(l.color.replace('#', '0x'), 16) : l.color;
      const light = new THREE.PointLight(hex, l.intensity ?? 1, l.distance ?? 5);
      if (l.offset) light.position.set(l.offset.x ?? 0, l.offset.y ?? 0, l.offset.z ?? 0);
      group.add(light);
    }
    if (meshDef.children) for (const cd of meshDef.children) group.add(this._buildMeshFromDef(cd));
    return group;
  }

  _makeGeo(geoSpec) {
    if (!geoSpec) return new THREE.SphereGeometry(0.2, 6, 6);
    const p = geoSpec.params || [];
    switch (geoSpec.type) {
      case 'sphere': return new THREE.SphereGeometry(...p);
      case 'box': return new THREE.BoxGeometry(...p);
      case 'cone': return new THREE.ConeGeometry(...p);
      case 'cylinder': return new THREE.CylinderGeometry(...p);
      case 'octahedron': return new THREE.OctahedronGeometry(...p);
      case 'tetrahedron': return new THREE.TetrahedronGeometry(...p);
      case 'torus': return new THREE.TorusGeometry(...p);
      default: return new THREE.SphereGeometry(0.2, 6, 6);
    }
  }

  _makeMat(matSpec) {
    if (!matSpec) return new THREE.MeshStandardMaterial({ color: 0x888888 });
    const colorHex = typeof matSpec.color === 'string' ? parseInt(matSpec.color.replace('#', '0x'), 16) : (matSpec.color ?? 0x888888);
    const emissHex = typeof matSpec.emissive === 'string' ? parseInt(matSpec.emissive.replace('#', '0x'), 16) : (matSpec.emissive ?? 0x000000);
    if (matSpec.type === 'basic') {
      return new THREE.MeshBasicMaterial({
        color: colorHex, opacity: matSpec.opacity ?? 1,
        transparent: (matSpec.opacity ?? 1) < 1 || !!matSpec.transparent,
        wireframe: matSpec.wireframe ?? false,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: colorHex, emissive: emissHex, emissiveIntensity: matSpec.emissiveIntensity ?? 1,
      metalness: matSpec.metalness ?? 0.3, roughness: matSpec.roughness ?? 0.5,
      opacity: matSpec.opacity ?? 1,
      transparent: (matSpec.opacity ?? 1) < 1 || !!matSpec.transparent,
      wireframe: matSpec.wireframe ?? false,
    });
  }
}
