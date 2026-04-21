import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { PLAYER } from '../../constants.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
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
    /** GPU particle system for engine exhaust. Built per attach. */
    this._thrustParticles = null;
    /** Engines list cached from hull userData for per-frame emission. */
    this._thrustEngines = [];
    /** Smoothed thrust intensity 0..1 actually rendered this frame. */
    this._thrustLevel = 0.4;
    /** Target intensity 0..1 fed by setThrust(); idle baseline = 0.4. */
    this._thrustTarget = 0.4;
  }

  onAttach(ctx) {
    this._scene = ctx?.scene;
    const scene = this._scene;
    if (!scene) return;

    this._buildMesh();
    this._buildThrustParticles();
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
    this._disposeThrustParticles();
  }

  update(dt, ctx) {
    this._time += dt;
    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    // Mirror transform onto the hull group
    this._group.position.copy(t.position);
    this._group.rotation.copy(t.rotation);

    // Smooth the thrust level toward whatever the flight controller last set.
    // When no one calls setThrust() (combat phase), target stays at the idle
    // baseline (0.4) so the plumes read as "engines on, not thrusting".
    const THRUST_LERP = 10;
    this._thrustLevel += (this._thrustTarget - this._thrustLevel) * Math.min(1, dt * THRUST_LERP);
    const lvl = this._thrustLevel;

    // Exhaust particle system — world-space so particles trail the ship.
    this._tickThrustParticles(dt);

    // Thruster point light also modulates with level + a small pulse.
    const pulse = 1.2 + Math.sin(this._time * 8) * 0.25;
    if (this._thrusterLight) this._thrusterLight.intensity = pulse * (0.5 + 1.8 * lvl);

    // Magnet ring
    const stats = this.entity.get('PlayerStatsComponent');
    const mRange = stats?.magnetRange ?? PLAYER.BASE_MAGNET_RANGE;
    if (this._magnetMesh && this._magnetUniforms) {
      this._magnetUniforms.uTime.value = this._time;
      this._magnetMesh.position.x = t.position.x;
      this._magnetMesh.position.y = t.position.y + 0.06;
      this._magnetMesh.position.z = t.position.z;
      this._magnetMesh.scale.setScalar(Math.max(0.001, mRange));
      this._magnetMesh.visible = isCombatPhase(ctx?.state?.round?.phase) && mRange > 0;
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

  /**
   * Drive the thrust visuals (plume size/brightness + thruster light).
   * @param {number} level  0..1. 1 = full forward thrust, 0 = retro/cutoff,
   *                        ~0.4 = idle baseline.
   */
  setThrust(level) {
    this._thrustTarget = Math.max(0, Math.min(1, level || 0));
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

  /**
   * Build a GPU particle system (THREE.Points + custom ShaderMaterial) for
   * engine exhaust. Particles live in world space — they emit from each
   * engine's current world position with a ship-rearward velocity, so they
   * correctly trail behind the hull during hard turns (they stay put; the
   * ship moves away).
   *
   * Per-particle size + alpha fade come from the shader using `aAge`/`aLifetime`
   * attributes. Spawn rate and particle speed scale with `_thrustLevel` in
   * `_tickThrustParticles()`.
   */
  _buildThrustParticles() {
    this._disposeThrustParticles();

    const hull = this._hullGroup;
    if (!hull || !this._scene?.groups?.effects) return;

    const engines = Array.isArray(hull.userData.engines) && hull.userData.engines.length
      ? hull.userData.engines
      : (hull.userData.engine ? [hull.userData.engine] : []);
    if (!engines.length) return;

    this._thrustEngines = engines.slice();

    const CAP = 240;
    const positions = new Float32Array(CAP * 3);
    const ages      = new Float32Array(CAP);
    const lifetimes = new Float32Array(CAP);
    const velocities = new Float32Array(CAP * 3);
    // Start all dead so nothing renders until spawned.
    for (let i = 0; i < CAP; i++) { ages[i] = 1; lifetimes[i] = 1; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aAge',       new THREE.BufferAttribute(ages, 1));
    geo.setAttribute('aLifetime',  new THREE.BufferAttribute(lifetimes, 1));
    geo.setDrawRange(0, CAP);
    // Large bounding sphere so THREE doesn't frustum-cull the whole system
    // based on stale positions in the buffer.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const colorHex = hull.userData.engineColor ?? 0x66d9ff;
    const pixelRatio = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor:      { value: new THREE.Color(colorHex) },
        uSize:       { value: 140 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: /* glsl */`
        attribute float aAge;
        attribute float aLifetime;
        uniform float uSize;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          float t = clamp(aAge / max(aLifetime, 0.0001), 0.0, 1.0);
          vAlpha = 1.0 - t;
          float sizeScale = mix(1.0, 0.25, t);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * uPixelRatio * sizeScale / max(0.01, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.35, 0.0, d);
          vec3 col = uColor * (glow + core * 0.8);
          gl_FragColor = vec4(col * vAlpha, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this._scene.groups.effects.add(points);

    this._thrustParticles = {
      points, geo, mat,
      positions, ages, lifetimes, velocities,
      capacity: CAP,
      cursor: 0,
      spawnLeftover: 0,
      vEngine: new THREE.Vector3(),
      vDir: new THREE.Vector3(),
    };
  }

  _disposeThrustParticles() {
    const p = this._thrustParticles;
    if (!p) return;
    p.geo?.dispose?.();
    p.mat?.dispose?.();
    if (p.points?.parent) p.points.parent.remove(p.points);
    this._thrustParticles = null;
    this._thrustEngines = [];
  }

  _tickThrustParticles(dt) {
    const p = this._thrustParticles;
    if (!p || !this._thrustEngines?.length) return;

    const lvl = this._thrustLevel;

    // Bigger, brighter particles at higher thrust (in addition to spawn-rate
    // + exhaust-speed modulation below).
    p.mat.uniforms.uSize.value = 90 + 110 * lvl;

    // Ensure hull world matrix is current before reading engine world positions.
    this._group.updateMatrixWorld(true);

    // Rearward direction in world = ship-local +Z mapped through hull rotation.
    const dir = p.vDir.set(0, 0, 1).applyQuaternion(this._group.quaternion);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();

    // Spawn rate in particles per second.
    const SPAWN_MIN = 30;
    const SPAWN_MAX = 260;
    const rate = SPAWN_MIN + (SPAWN_MAX - SPAWN_MIN) * lvl;
    p.spawnLeftover += rate * dt;
    const toSpawn = Math.floor(p.spawnLeftover);
    p.spawnLeftover -= toSpawn;

    // Per-particle physical params.
    const EXHAUST_SPEED = 8 + 22 * lvl;   // world units/sec rearward
    const JITTER_POS = 0.12;              // nozzle spread
    const JITTER_DIR = 0.28;              // velocity cone spread
    const LIFE_BASE = 0.55;

    const engines = this._thrustEngines;
    const positions = p.positions;
    const ages = p.ages;
    const lifetimes = p.lifetimes;
    const velocities = p.velocities;

    // Spawn phase — round-robin across engines.
    for (let k = 0; k < toSpawn; k++) {
      const eng = engines[k % engines.length];
      eng.getWorldPosition(p.vEngine);
      // Push the emitter slightly rearward of the engine body so particles
      // don't pop out of the hull geometry.
      p.vEngine.addScaledVector(dir, 0.35);

      const idx = p.cursor;
      p.cursor = (p.cursor + 1) % p.capacity;
      const i3 = idx * 3;

      positions[i3]     = p.vEngine.x + (Math.random() - 0.5) * JITTER_POS;
      positions[i3 + 1] = p.vEngine.y + (Math.random() - 0.5) * JITTER_POS;
      positions[i3 + 2] = p.vEngine.z + (Math.random() - 0.5) * JITTER_POS;

      const dx = dir.x + (Math.random() - 0.5) * JITTER_DIR;
      const dy = dir.y + (Math.random() - 0.5) * JITTER_DIR;
      const dz = dir.z + (Math.random() - 0.5) * JITTER_DIR;
      const spd = EXHAUST_SPEED * (0.75 + Math.random() * 0.5);
      velocities[i3]     = dx * spd;
      velocities[i3 + 1] = dy * spd;
      velocities[i3 + 2] = dz * spd;

      ages[idx] = 0;
      lifetimes[idx] = LIFE_BASE * (0.7 + Math.random() * 0.7);
    }

    // Integrate every live particle. Pool is small (240), so the straight
    // loop is cheap and avoids having to maintain a free-list.
    for (let i = 0; i < p.capacity; i++) {
      const life = lifetimes[i];
      if (ages[i] >= life) continue;
      ages[i] += dt;
      const i3 = i * 3;
      positions[i3]     += velocities[i3]     * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;
    }

    p.geo.attributes.position.needsUpdate = true;
    p.geo.attributes.aAge.needsUpdate = true;
    p.geo.attributes.aLifetime.needsUpdate = true;
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
