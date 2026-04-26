import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

const NEAR_DIST  = 8;    // world units ahead of ship
const FAR_DIST   = 18;   // world units ahead of ship
const NEAR_R     = 1.0;  // ring radius (near)
const FAR_R      = 0.55; // ring radius (far)
const TICK_LEN   = 0.38; // inward tick length on near ring
const CIRCLE_SEG = 48;
const COLOR      = 0x66d9ff;

function buildNearGeo() {
  const verts = [];

  // Circle
  for (let i = 0; i < CIRCLE_SEG; i++) {
    const a0 = (i / CIRCLE_SEG) * Math.PI * 2;
    const a1 = ((i + 1) / CIRCLE_SEG) * Math.PI * 2;
    verts.push(
      Math.cos(a0) * NEAR_R, Math.sin(a0) * NEAR_R, 0,
      Math.cos(a1) * NEAR_R, Math.sin(a1) * NEAR_R, 0,
    );
  }

  // 4 inward tick marks at cardinal positions
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
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

const _fwd   = new THREE.Vector3();
const _quat  = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);

export class PlayerCrosshairComponent extends Component {
  constructor() {
    super();
    this._scene  = null;
    this._near   = null;
    this._far    = null;
    this._nearGeo = null;
    this._farGeo  = null;
    this._mat     = null;
    this._matFar  = null;
  }

  onAttach(ctx) {
    this._scene = ctx?.scene?.groups?.effects ?? ctx?.scene ?? null;
    if (!this._scene) return;

    this._nearGeo = buildNearGeo();
    this._farGeo  = buildFarGeo();

    this._mat = new THREE.LineBasicMaterial({
      color: COLOR, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this._matFar = new THREE.LineBasicMaterial({
      color: COLOR, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });

    this._near = new THREE.LineSegments(this._nearGeo, this._mat);
    this._far  = new THREE.LineSegments(this._farGeo,  this._matFar);
    this._near.frustumCulled = false;
    this._far.frustumCulled  = false;

    this._scene.add(this._near);
    this._scene.add(this._far);
  }

  onDetach() {
    if (this._near?.parent) this._near.parent.remove(this._near);
    if (this._far?.parent)  this._far.parent.remove(this._far);
    this._nearGeo?.dispose();
    this._farGeo?.dispose();
    this._mat?.dispose();
    this._matFar?.dispose();
    this._near = this._far = this._nearGeo = this._farGeo = this._mat = this._matFar = null;
  }

  update(_dt, ctx) {
    if (!this._near) return;

    // Hide on non-gameplay screens
    const phase = ctx?.state?.round?.phase;
    const visible = phase === 'combat' || phase === 'boss_arena' || phase === 'arena_transition';
    this._near.visible = visible;
    this._far.visible  = visible;
    if (!visible) return;

    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    // Build forward direction from ship rotation (yaw + pitch; -Z is default nose)
    const yaw   = t.rotation.y ?? 0;
    const pitch = t.rotation.x ?? 0;
    _fwd.set(
      -Math.sin(yaw) * Math.cos(pitch),
       Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).normalize();

    // Quaternion that rotates ring plane (normal +Z) to face along forward
    _quat.setFromUnitVectors(_zAxis, _fwd);

    this._near.position.copy(t.position).addScaledVector(_fwd, NEAR_DIST);
    this._near.quaternion.copy(_quat);

    this._far.position.copy(t.position).addScaledVector(_fwd, FAR_DIST);
    this._far.quaternion.copy(_quat);
  }
}
