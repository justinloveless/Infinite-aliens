import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { MouseAimTracker } from '../../core/MouseAimTracker.js';
import { PLAY_AREA } from '../../constants.js';

const NEAR_DIST    = 8;
const FAR_DIST     = 18;
const NEAR_R       = 1.0;
const FAR_R        = 0.55;
const TICK_LEN     = 0.38;
const CIRCLE_SEG   = 48;
const COLOR        = 0x66d9ff;

const LEADER_R     = 0.30;   // leader cross arm half-length
const CHEV_SPACING = 0.85;   // world units between chevrons
const CHEV_MAX     = 7;
const CHEV_ARM     = 0.20;   // half-length along path dir
const CHEV_WIDTH   = 0.14;   // half-width perpendicular to path

// Module-level scratch objects — never allocate in update()
const _shipFwd = new THREE.Vector3();
const _aimFwd  = new THREE.Vector3();
const _quat    = new THREE.Quaternion();
const _quatA   = new THREE.Quaternion();
const _zAxis   = new THREE.Vector3(0, 0, 1);
const _nearP   = new THREE.Vector3();
const _leadP   = new THREE.Vector3();
const _diff    = new THREE.Vector3();
const _pathD   = new THREE.Vector3();
const _perp    = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

function buildNearGeo() {
  const verts = [];
  for (let i = 0; i < CIRCLE_SEG; i++) {
    const a0 = (i / CIRCLE_SEG) * Math.PI * 2;
    const a1 = ((i + 1) / CIRCLE_SEG) * Math.PI * 2;
    verts.push(
      Math.cos(a0) * NEAR_R, Math.sin(a0) * NEAR_R, 0,
      Math.cos(a1) * NEAR_R, Math.sin(a1) * NEAR_R, 0,
    );
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a), cy = Math.sin(a);
    verts.push(
      cx * NEAR_R, cy * NEAR_R, 0,
      cx * (NEAR_R - TICK_LEN), cy * (NEAR_R - TICK_LEN), 0,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

function buildFarGeo() {
  const verts = [];
  for (let i = 0; i < CIRCLE_SEG; i++) {
    const a0 = (i / CIRCLE_SEG) * Math.PI * 2;
    const a1 = ((i + 1) / CIRCLE_SEG) * Math.PI * 2;
    verts.push(
      Math.cos(a0) * FAR_R, Math.sin(a0) * FAR_R, 0,
      Math.cos(a1) * FAR_R, Math.sin(a1) * FAR_R, 0,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

function buildLeaderGeo() {
  // Small "+" cross in local XY plane, oriented to face aimFwd
  const R = LEADER_R;
  const verts = [
    -R, 0, 0,  R, 0, 0,   // horizontal arm
     0,-R, 0,  0, R, 0,   // vertical arm
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

export class PlayerCrosshairComponent extends Component {
  constructor({ settings = null } = {}) {
    super();
    this._settings  = settings;
    this._scene     = null;
    this._near      = null;
    this._far       = null;
    this._leader    = null;
    this._chevrons  = null;
    this._nearGeo   = null;
    this._farGeo    = null;
    this._leaderGeo = null;
    this._chevGeo   = null;
    this._chevBuf   = null;
    this._mat       = null;
    this._matFar    = null;
    this._matLeader = null;
    this._matChev   = null;
  }

  onAttach(ctx) {
    this._scene = ctx?.scene?.groups?.effects ?? ctx?.scene ?? null;
    if (!this._scene) return;

    this._nearGeo   = buildNearGeo();
    this._farGeo    = buildFarGeo();
    this._leaderGeo = buildLeaderGeo();

    // Pre-allocated chevron buffer: CHEV_MAX × 2 lines × 2 verts × xyz
    this._chevBuf = new Float32Array(CHEV_MAX * 4 * 3);
    this._chevGeo = new THREE.BufferGeometry();
    this._chevGeo.setAttribute('position', new THREE.BufferAttribute(this._chevBuf, 3));
    this._chevGeo.setDrawRange(0, 0);

    this._mat       = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
    this._matFar    = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0.4,  depthWrite: false, blending: THREE.AdditiveBlending });
    this._matLeader = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending });
    this._matChev   = new THREE.LineBasicMaterial({ color: COLOR, transparent: true, opacity: 0.5,  depthWrite: false, blending: THREE.AdditiveBlending });

    this._near     = new THREE.LineSegments(this._nearGeo,   this._mat);
    this._far      = new THREE.LineSegments(this._farGeo,    this._matFar);
    this._leader   = new THREE.LineSegments(this._leaderGeo, this._matLeader);
    this._chevrons = new THREE.LineSegments(this._chevGeo,   this._matChev);

    for (const m of [this._near, this._far, this._leader, this._chevrons]) {
      m.frustumCulled = false;
      this._scene.add(m);
    }
  }

  onDetach() {
    for (const m of [this._near, this._far, this._leader, this._chevrons]) {
      if (m?.parent) m.parent.remove(m);
    }
    for (const g of [this._nearGeo, this._farGeo, this._leaderGeo, this._chevGeo]) g?.dispose();
    for (const m of [this._mat, this._matFar, this._matLeader, this._matChev]) m?.dispose();
    this._near = this._far = this._leader = this._chevrons = null;
    this._nearGeo = this._farGeo = this._leaderGeo = this._chevGeo = this._chevBuf = null;
    this._mat = this._matFar = this._matLeader = this._matChev = null;
  }

  update(_dt, ctx) {
    if (!this._near) return;

    const phase   = ctx?.state?.round?.phase;
    const visible = phase === 'combat' || phase === 'boss_arena' || phase === 'arena_transition';
    for (const m of [this._near, this._far, this._leader, this._chevrons]) {
      if (m) m.visible = visible;
    }
    if (!visible) return;

    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    // ── Main crosshair: ship's actual aim direction (where bullets go) ──
    const yaw   = t.rotation.y ?? 0;
    const pitch = t.rotation.x ?? 0;
    _shipFwd.set(
      -Math.sin(yaw) * Math.cos(pitch),
       Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).normalize();
    _quat.setFromUnitVectors(_zAxis, _shipFwd);

    _nearP.copy(t.position).addScaledVector(_shipFwd, NEAR_DIST);
    this._near.position.copy(_nearP);
    this._near.quaternion.copy(_quat);
    this._far.position.copy(t.position).addScaledVector(_shipFwd, FAR_DIST);
    this._far.quaternion.copy(_quat);

    // ── Leader indicator: mouse aim direction ──
    const ma      = MouseAimTracker;
    const ySign   = this._settings?.invertYControls ? -1 : 1;
    const isArena = phase === 'boss_arena' || phase === 'arena_transition';
    const baseYaw = isArena ? yaw : 0;
    const aimYaw   = baseYaw - ma.x * PLAY_AREA.MOUSE_AIM_ANGLE;
    const aimPitch = ma.y * PLAY_AREA.MOUSE_AIM_ANGLE * ySign;

    _aimFwd.set(
      -Math.sin(aimYaw) * Math.cos(aimPitch),
       Math.sin(aimPitch),
      -Math.cos(aimYaw) * Math.cos(aimPitch),
    ).normalize();
    _quatA.setFromUnitVectors(_zAxis, _aimFwd);

    _leadP.copy(t.position).addScaledVector(_aimFwd, FAR_DIST);
    this._leader.position.copy(_leadP);
    this._leader.quaternion.copy(_quatA);

    // ── Chevrons: from main crosshair toward leader ──
    _diff.subVectors(_leadP, _nearP);
    const dist  = _diff.length();
    const nChev = Math.min(CHEV_MAX, Math.floor(dist / CHEV_SPACING));

    if (nChev < 1) {
      this._chevrons.visible = false;
      this._chevGeo.setDrawRange(0, 0);
      return;
    }
    this._chevrons.visible = true;

    _pathD.copy(_diff).normalize();

    // Perpendicular to path direction within the plane perpendicular to ship forward.
    // _diff is always roughly perpendicular to _shipFwd (both endpoints at same depth),
    // so this cross product is well-conditioned in practice.
    _perp.crossVectors(_pathD, _shipFwd).normalize();
    if (_perp.lengthSq() < 0.001) {
      _perp.crossVectors(_worldUp, _pathD).normalize();
    }

    const buf = this._chevBuf;
    let vi = 0;
    for (let i = 0; i < nChev; i++) {
      // Evenly space chevrons between the two crosshairs (not touching either end)
      const s  = (i + 1) / (nChev + 1);
      const cx = _nearP.x + _diff.x * s;
      const cy = _nearP.y + _diff.y * s;
      const cz = _nearP.z + _diff.z * s;

      // Tip pointing toward leader
      const tx = cx + _pathD.x * CHEV_ARM;
      const ty = cy + _pathD.y * CHEV_ARM;
      const tz = cz + _pathD.z * CHEV_ARM;

      // Upper back arm
      const ux = cx - _pathD.x * CHEV_ARM + _perp.x * CHEV_WIDTH;
      const uy = cy - _pathD.y * CHEV_ARM + _perp.y * CHEV_WIDTH;
      const uz = cz - _pathD.z * CHEV_ARM + _perp.z * CHEV_WIDTH;

      // Lower back arm
      const lx = cx - _pathD.x * CHEV_ARM - _perp.x * CHEV_WIDTH;
      const ly = cy - _pathD.y * CHEV_ARM - _perp.y * CHEV_WIDTH;
      const lz = cz - _pathD.z * CHEV_ARM - _perp.z * CHEV_WIDTH;

      buf[vi++] = tx; buf[vi++] = ty; buf[vi++] = tz;
      buf[vi++] = ux; buf[vi++] = uy; buf[vi++] = uz;
      buf[vi++] = tx; buf[vi++] = ty; buf[vi++] = tz;
      buf[vi++] = lx; buf[vi++] = ly; buf[vi++] = lz;
    }

    this._chevGeo.attributes.position.needsUpdate = true;
    this._chevGeo.setDrawRange(0, nChev * 4);
  }
}
