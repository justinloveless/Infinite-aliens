import * as THREE from 'three';
import { PLAY_AREA, PLAYER } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

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

// One-shot expanding disk: same ribbed look as the magnet field, but waves travel outward with uAge.
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

// Arrow key fallbacks are always active regardless of keybind settings
const ARROW_ALTS = {
  moveUp:    'ArrowUp',
  moveDown:  'ArrowDown',
  moveLeft:  'ArrowLeft',
  moveRight: 'ArrowRight',
};

const X_MIN = PLAY_AREA.X_MIN + 2;
const X_MAX = PLAY_AREA.X_MAX - 2;
const Z_MIN = -8;
const Z_MAX = 5;

// Local-space mount points for each extra weapon turret
const TURRET_LOCAL = {
  laser:   new THREE.Vector3(-1.5,  0.05,  0.1),  // left wing tip
  missile: new THREE.Vector3( 1.5,  0.05,  0.1),  // right wing tip
  plasma:  new THREE.Vector3( 0,   -0.25, -0.5),  // belly/nose mount
  beam:    new THREE.Vector3( 0,    0.3,  -0.8),  // top-center, forward
};

// Local-space anchor points for visual attachments
const ATTACHMENT_ANCHORS = {
  ship:       new THREE.Vector3( 0,    0,    0   ),
  hull:       new THREE.Vector3( 0,    0,    0   ),
  wing_left:  new THREE.Vector3(-0.9,  0,    0.5 ),
  wing_right: new THREE.Vector3( 0.9,  0,    0.5 ),
  cockpit:    new THREE.Vector3( 0,    0,   -0.6 ),
  engine:     new THREE.Vector3( 0,    0,    1.1 ),
};

// Visual config per turret type
const TURRET_CFG = {
  laser:   { color: 0x00f5ff, emissive: 0x006688, lightColor: 0x00f5ff },
  missile: { color: 0xff8800, emissive: 0x884400, lightColor: 0xff8800 },
  plasma:  { color: 0xff00ff, emissive: 0x880088, lightColor: 0xff00ff },
  beam:    { color: 0xff1133, emissive: 0x880011, lightColor: 0xff1133 },
};

export class Ship {
  /**
   * @param {import('../scene/SceneManager.js').SceneManager} scene
   * @param {import('../core/SettingsManager.js').SettingsManager} [settingsManager]
   */
  constructor(scene, settingsManager = null) {
    this.group = new THREE.Group();
    this.collisionRadius = 1.0;
    this._time = 0;
    this._thrusterLight = null;
    this._shieldMesh = null;
    this._magnetMesh = null;
    this._magnetUniforms = null;
    this._novaMesh = null;
    this._novaUniforms = null;
    this._novaActive = false;
    this._novaAge = 0;
    this._novaRadius = PLAYER.STELLAR_NOVA_BASE_RADIUS;
    this._novaUnsub = null;
    this._playerRoot = scene.groups.player;
    this._settings = settingsManager;
    this._turretMeshes = {}; // weaponType -> THREE.Group
    this._attachments = new Map(); // attachmentId -> { object, spec, phase }
    this._defaultVisuals = null;  // snapshot of default material/scale values

    // Smooth velocity (XZ plane)
    this._vx = 0;
    this._vz = 0;

    // Input state
    this._keys = {};
    this._onKeyDown = e => { this._keys[e.code] = true; };
    this._onKeyUp   = e => { this._keys[e.code] = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    this._buildMesh();
    this._buildMagnetField();
    this._buildStellarNovaBurst();
    this._novaUnsub = eventBus.on(EVENTS.STELLAR_NOVA, data => {
      this._startStellarNovaPulse(data?.radius ?? PLAYER.STELLAR_NOVA_BASE_RADIUS);
    });
    scene.groups.player.add(this.group);
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
      uniforms,
      vertexShader: MAGNET_VERTEX,
      fragmentShader: MAGNET_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 2;
    this._magnetMesh = mesh;
    this._playerRoot.add(mesh);
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
      uniforms,
      vertexShader: NOVA_VERTEX,
      fragmentShader: NOVA_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 3;
    this._novaMesh = mesh;
    this._playerRoot.add(mesh);
  }

  _startStellarNovaPulse(radius) {
    if (!this._novaMesh || !this._novaUniforms) return;
    this._novaRadius = Math.max(1, radius);
    this._novaActive = true;
    this._novaAge = 0;
    this._novaMesh.visible = true;
    this._novaUniforms.uAge.value = 0;
    this._novaUniforms.uIntensity.value = 0.42;
  }

  _buildMesh() {
    // ---- Key light (moves with ship so it always looks lit) ----
    const keyLight = new THREE.PointLight(0xc8e0ff, 6, 14);
    keyLight.position.set(2, 5, 3);
    this.group.add(keyLight);

    const rimLight = new THREE.PointLight(0x4466aa, 2, 8);
    rimLight.position.set(-2, -2, 2);
    this.group.add(rimLight);

    // ---- Hull: elongated hexagonal cone ----
    const hullGeo = new THREE.ConeGeometry(0.55, 2.2, 6);
    const hullMat = new THREE.MeshStandardMaterial({
      color:     0x7799bb,
      emissive:  0x1a2e42,
      emissiveIntensity: 0.6,
      metalness: 0.35,
      roughness: 0.55,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2;
    this.group.add(hull);
    this._hull = hull;

    // ---- Wings ----
    const wingGeo = new THREE.BoxGeometry(1.8, 0.1, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({
      color:     0x5577aa,
      emissive:  0x0f1f33,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.5,
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.9, 0, 0.5);
    this.group.add(wingL);
    this._wingL = wingL;
    // Give wingR its own material clone so scale is independent
    const wingR = new THREE.Mesh(wingGeo, wingMat.clone());
    wingR.position.set(0.9, 0, 0.5);
    this.group.add(wingR);
    this._wingR = wingR;

    // ---- Engine body ----
    const engineGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8);
    const engineMat = new THREE.MeshStandardMaterial({
      color:     0x445566,
      emissive:  0x0a1520,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.4,
    });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.z = 1.1;
    this.group.add(engine);
    this._engine = engine;

    // ---- Engine glow ----
    const glowGeo = new THREE.CircleGeometry(0.2, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.9,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.z = 1.38;
    this.group.add(glow);

    // ---- Thruster point light ----
    this._thrusterLight = new THREE.PointLight(0x0088ff, 2.5, 5);
    this._thrusterLight.position.set(0, 0, 1.5);
    this.group.add(this._thrusterLight);

    // ---- Cockpit ----
    const cockpitGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const cockpitMat = new THREE.MeshStandardMaterial({
      color:     0x00f5ff,
      emissive:  0x00c8d8,
      emissiveIntensity: 1.2,
      metalness: 0.1,
      roughness: 0.2,
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.z = -0.6;
    this.group.add(cockpit);
    this._cockpit = cockpit;

    // ---- Shield visual (hidden by default) ----
    const shieldGeo = new THREE.SphereGeometry(1.5, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this._shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this._shieldMesh.visible = false;
    this.group.add(this._shieldMesh);

    // ---- Wing accent lights ----
    const wingLight = new THREE.PointLight(0xff00ff, 0.5, 3);
    wingLight.position.set(0, 0, 0.4);
    this.group.add(wingLight);

    this._snapshotDefaults();
  }

  setShieldVisible(hasShield) {
    this._shieldMesh.visible = hasShield;
  }

  flash(color = 0xff0000) {
    this.group.children.forEach(child => {
      if (child.material && child.material.emissive) {
        const orig = child.material.emissive.getHex();
        child.material.emissive.setHex(color);
        setTimeout(() => {
          if (child.material) child.material.emissive.setHex(orig);
        }, 120);
      }
    });
  }

  // speed: units/sec from computed stats (optional, defaults to 3)
  // phase: when set, magnet field shows only during combat
  update(delta, computed, phase) {
    this._time += delta;

    const speed = computed?.speed ?? 3;

    // ---- Input (read keybinds from settings, arrow keys always active) ----
    const kb = this._settings;
    const isDown = action =>
      this._keys[kb ? kb.getKeybind(action) : null] || this._keys[ARROW_ALTS[action]];

    const inputX = (isDown('moveRight') ? 1 : 0) - (isDown('moveLeft') ? 1 : 0);
    const inputZ = (isDown('moveDown')  ? 1 : 0) - (isDown('moveUp')   ? 1 : 0);

    // Smooth acceleration / deceleration
    const accel = delta * 10;
    this._vx += (inputX * speed - this._vx) * accel;
    this._vz += (inputZ * speed - this._vz) * accel;

    // Apply movement with bounds clamping
    const px = THREE.MathUtils.clamp(this.group.position.x + this._vx * delta, X_MIN, X_MAX);
    const pz = THREE.MathUtils.clamp(this.group.position.z + this._vz * delta, Z_MIN, Z_MAX);
    this.group.position.x = px;
    this.group.position.z = pz;

    // Gentle hover on Y
    this.group.position.y = Math.sin(this._time * 1.2) * 0.15;

    // ---- Banking & pitch based on velocity ----
    const bankTarget  = -(this._vx / speed) * 0.38;  // roll: lean into lateral movement
    const pitchTarget =  (this._vz / speed) * 0.12;  // pitch: nose up when braking back
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, bankTarget, delta * 7);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, pitchTarget, delta * 7);

    // ---- Engine pulse ----
    const pulse = 1.8 + Math.sin(this._time * 8) * 0.6;
    this._thrusterLight.intensity = pulse;

    // ---- Magnet range (world-flat disk, inward pulsing ripples) ----
    if (this._magnetMesh && this._magnetUniforms) {
      this._magnetUniforms.uTime.value = this._time;
      const range = computed?.magnetRange ?? PLAYER.BASE_MAGNET_RANGE;
      this._magnetMesh.position.x = this.group.position.x;
      this._magnetMesh.position.y = this.group.position.y + 0.06;
      this._magnetMesh.position.z = this.group.position.z;
      this._magnetMesh.scale.setScalar(range);
      const show = !!computed && phase === 'combat';
      this._magnetMesh.visible = show;
    }

    // ---- Stellar Nova burst (outward pulse, only while animating) ----
    if (this._novaMesh && this._novaUniforms) {
      this._novaUniforms.uTime.value = this._time;
      this._novaMesh.position.x = this.group.position.x;
      this._novaMesh.position.y = this.group.position.y + 0.07;
      this._novaMesh.position.z = this.group.position.z;
      this._novaMesh.scale.setScalar(this._novaRadius);
      if (this._novaActive) {
        this._novaAge += delta / NOVA_PULSE_DURATION;
        this._novaUniforms.uAge.value = Math.min(1, this._novaAge);
        if (this._novaAge >= 1) {
          this._novaActive = false;
          this._novaMesh.visible = false;
        }
      }
    }
  }

  // Add/remove turret meshes to match the current extra-weapon set.
  // Call this whenever computed.extraWeapons changes.
  syncTurrets(extraWeapons) {
    const desired = new Set(extraWeapons);

    // Remove stale turrets
    for (const type of Object.keys(this._turretMeshes)) {
      if (!desired.has(type)) {
        this.group.remove(this._turretMeshes[type]);
        delete this._turretMeshes[type];
      }
    }

    // Add new turrets
    for (const type of desired) {
      if (this._turretMeshes[type]) continue;
      const turret = this._buildTurretMesh(type);
      const localPos = TURRET_LOCAL[type];
      if (localPos) turret.position.copy(localPos);
      this.group.add(turret);
      this._turretMeshes[type] = turret;
    }
  }

  // Returns the world-space position of the named turret's muzzle.
  getTurretWorldPosition(type) {
    const localPos = TURRET_LOCAL[type];
    if (!localPos) return this.group.position.clone();
    // Offset the muzzle slightly forward (-Z) from the mount center
    const muzzle = localPos.clone().add(new THREE.Vector3(0, 0, -0.25));
    return this.group.localToWorld(muzzle);
  }

  _buildTurretMesh(type) {
    const cfg = TURRET_CFG[type] || TURRET_CFG.laser;
    const group = new THREE.Group();

    // Barrel — thin cylinder pointing forward (-Z)
    const barrelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.45, 6);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.emissive,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.4,
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;   // align along Z axis
    barrel.position.z = -0.1;          // shift barrel slightly forward
    group.add(barrel);

    // Mount pod — small dark box/cylinder at the base
    const podGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8);
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      metalness: 0.6,
      roughness: 0.4,
    });
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.z = 0.18;
    group.add(pod);

    // Glow point light
    const light = new THREE.PointLight(cfg.lightColor, 0.9, 2.5);
    group.add(light);

    return group;
  }

  // ── Visual modifier system ──────────────────────────────────────────────────

  // Capture default material/scale values after _buildMesh() completes.
  _snapshotDefaults() {
    const snap = (mesh) => {
      if (!mesh) return null;
      const m = mesh.material;
      return {
        color:             m.color?.getHex() ?? 0xffffff,
        emissive:          m.emissive?.getHex() ?? 0x000000,
        emissiveIntensity: m.emissiveIntensity ?? 1,
        opacity:           m.opacity ?? 1,
        scale:             mesh.scale.x,
      };
    };
    this._defaultVisuals = {
      hull:       snap(this._hull),
      wing_left:  snap(this._wingL),
      wing_right: snap(this._wingR),
      cockpit:    snap(this._cockpit),
      engine:     snap(this._engine),
    };
  }

  _resetToDefaults() {
    if (!this._defaultVisuals) return;
    const restore = (mesh, d) => {
      if (!mesh || !d) return;
      const m = mesh.material;
      if (m.color)    m.color.setHex(d.color);
      if (m.emissive) m.emissive.setHex(d.emissive);
      m.emissiveIntensity = d.emissiveIntensity;
      m.opacity           = d.opacity;
      mesh.scale.setScalar(d.scale);
    };
    restore(this._hull,    this._defaultVisuals.hull);
    restore(this._wingL,   this._defaultVisuals.wing_left);
    restore(this._wingR,   this._defaultVisuals.wing_right);
    restore(this._cockpit, this._defaultVisuals.cockpit);
    restore(this._engine,  this._defaultVisuals.engine);
  }

  // Called once per upgrade purchase from _rebuildComputed().
  syncVisualModifiers(modifiers) {
    this._resetToDefaults();
    if (!modifiers?.length) return;
    for (const mod of modifiers) {
      this._applyVisualModifier(mod);
    }
  }

  _resolveModTarget(targetName) {
    switch (targetName) {
      case 'hull':       return this._hull;
      case 'wing_left':  return this._wingL;
      case 'wing_right': return this._wingR;
      case 'cockpit':    return this._cockpit;
      case 'engine':     return this._engine;
      case 'shield':     return this._shieldMesh;
      default:           return null;
    }
  }

  _applyVisualModifier(mod) {
    // Turret modifiers routed to turret meshes
    if (mod.target?.startsWith('turret_')) {
      const type = mod.target.replace('turret_', '');
      const turret = this._turretMeshes[type];
      if (!turret) return;
      turret.traverse(child => {
        if (child.isMesh) this._applyMatOp(child, mod);
      });
      return;
    }
    // Projectile targets are handled by ProjectilePool, skip here
    if (mod.target?.startsWith('projectile_')) return;
    // Magnet visual
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
      const applyTo = (comp) => {
        switch (op) {
          case 'multiply': return comp * value;
          case 'add':      return comp + value;
          case 'set':      return value;
          default:         return comp;
        }
      };
      if (!axis) {
        mesh.scale.setScalar(applyTo(mesh.scale.x));
      } else {
        mesh.scale[axis] = applyTo(mesh.scale[axis]);
      }
      return;
    }

    if (property === 'color' || property === 'emissive') {
      if (!m[property]) return;
      const hex = typeof value === 'string' ? parseInt(value.replace('#', '0x'), 16) : value;
      if (op === 'set') {
        m[property].setHex(hex);
      }
      // multiply/add on color isn't well-defined — treat as set
      return;
    }

    if (property === 'emissiveIntensity') {
      switch (op) {
        case 'multiply': m.emissiveIntensity *= value; break;
        case 'add':      m.emissiveIntensity += value; break;
        case 'set':      m.emissiveIntensity  = value; break;
      }
      return;
    }

    if (property === 'opacity') {
      switch (op) {
        case 'multiply': m.opacity *= value; break;
        case 'add':      m.opacity += value; break;
        case 'set':      m.opacity  = value; break;
      }
      m.transparent = m.opacity < 1;
      return;
    }
  }

  // ── Attachment system ───────────────────────────────────────────────────────

  // Called every frame from _tick() to animate orbital attachments.
  syncAttachments(attachments, delta) {
    const desired = new Map((attachments || []).map(a => [a.id, a]));

    // Remove stale attachments
    for (const [id, entry] of this._attachments) {
      if (!desired.has(id)) {
        this.group.remove(entry.object);
        this._attachments.delete(id);
      }
    }

    // Add new attachments
    for (const [id, spec] of desired) {
      if (!this._attachments.has(id)) {
        const obj = this._buildMeshFromDef(spec.mesh);
        this.group.add(obj);
        this._attachments.set(id, { object: obj, spec, phase: spec.orbit?.phase ?? 0 });
      }
    }

    // Update positions / orbit each frame
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
        entry.phase += spec.orbit.speed * delta;
        const r     = spec.orbit.radius ?? 1;
        const tilt  = spec.orbit.tilt  ?? 0;
        object.position.set(
          anchorVec.x + r * Math.cos(entry.phase),
          anchorVec.y + r * Math.sin(entry.phase) * Math.sin(tilt),
          anchorVec.z + r * Math.sin(entry.phase) * Math.cos(tilt)
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

    if (meshDef.scale)    mesh.scale.setScalar(meshDef.scale);
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

    if (meshDef.children) {
      for (const childDef of meshDef.children) {
        group.add(this._buildMeshFromDef(childDef));
      }
    }

    return group;
  }

  _makeGeo(geoSpec) {
    if (!geoSpec) return new THREE.SphereGeometry(0.2, 6, 6);
    const p = geoSpec.params || [];
    switch (geoSpec.type) {
      case 'sphere':      return new THREE.SphereGeometry(...p);
      case 'box':         return new THREE.BoxGeometry(...p);
      case 'cone':        return new THREE.ConeGeometry(...p);
      case 'cylinder':    return new THREE.CylinderGeometry(...p);
      case 'octahedron':  return new THREE.OctahedronGeometry(...p);
      case 'tetrahedron': return new THREE.TetrahedronGeometry(...p);
      case 'torus':       return new THREE.TorusGeometry(...p);
      default:            return new THREE.SphereGeometry(0.2, 6, 6);
    }
  }

  _makeMat(matSpec) {
    if (!matSpec) return new THREE.MeshStandardMaterial({ color: 0x888888 });
    const colorHex   = typeof matSpec.color    === 'string' ? parseInt(matSpec.color.replace('#','0x'),16)    : (matSpec.color    ?? 0x888888);
    const emissHex   = typeof matSpec.emissive === 'string' ? parseInt(matSpec.emissive.replace('#','0x'),16) : (matSpec.emissive ?? 0x000000);

    if (matSpec.type === 'basic') {
      return new THREE.MeshBasicMaterial({
        color:       colorHex,
        opacity:     matSpec.opacity ?? 1,
        transparent: (matSpec.opacity ?? 1) < 1 || !!matSpec.transparent,
        wireframe:   matSpec.wireframe ?? false,
      });
    }

    return new THREE.MeshStandardMaterial({
      color:             colorHex,
      emissive:          emissHex,
      emissiveIntensity: matSpec.emissiveIntensity ?? 1,
      metalness:         matSpec.metalness ?? 0.3,
      roughness:         matSpec.roughness ?? 0.5,
      opacity:           matSpec.opacity ?? 1,
      transparent:       (matSpec.opacity ?? 1) < 1 || !!matSpec.transparent,
      wireframe:         matSpec.wireframe ?? false,
    });
  }

  get position() { return this.group.position; }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    if (this._novaUnsub) {
      this._novaUnsub();
      this._novaUnsub = null;
    }
    if (this._novaMesh) {
      this._playerRoot.remove(this._novaMesh);
      this._novaMesh.geometry.dispose();
      this._novaMesh.material.dispose();
      this._novaMesh = null;
      this._novaUniforms = null;
    }
    if (this._magnetMesh) {
      this._playerRoot.remove(this._magnetMesh);
      this._magnetMesh.geometry.dispose();
      this._magnetMesh.material.dispose();
      this._magnetMesh = null;
      this._magnetUniforms = null;
    }
  }
}
