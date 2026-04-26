import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { PLAY_AREA } from '../../constants.js';
import { isOpenCombatPhase } from '../../core/phaseUtil.js';

const ARROW_ALTS = {
  moveUp:    'ArrowUp',
  moveDown:  'ArrowDown',
  moveLeft:  'ArrowLeft',
  moveRight: 'ArrowRight',
};

const X_MIN = PLAY_AREA.X_MIN + 2;
const X_MAX = PLAY_AREA.X_MAX - 2;

/**
 * Reads keyboard input and writes velocity into the player's TransformComponent.
 * W/S → vertical pitch (Y-axis). A/D → lateral (X-axis).
 * Shift → boost (speed ×BOOST_MULT). Ctrl → brakes (high drag).
 */
export class PlayerInputComponent extends Component {
  constructor({ settings = null } = {}) {
    super();
    this._settings = settings;
    this._keys = {};
    this._vx = 0;
    this._vy = 0;
    this._vz = 0;
    this._onKeyDown = e => { this._keys[e.code] = true; };
    this._onKeyUp = e => { this._keys[e.code] = false; };
  }

  onAttach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  onDetach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  _isDown(action) {
    const kb = this._settings;
    return this._keys[kb ? kb.getKeybind(action) : null] || this._keys[ARROW_ALTS[action]];
  }

  update(dt, ctx) {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    const player = this.entity.get('PlayerStatsComponent');
    let speed = (player?.speed ?? 3) * (player?.jammerSlowMult ?? 1);
    const boost = this.entity.get('SpeedBoostAbilityComponent');
    if (boost?.isActive()) speed *= boost.boostMult;

    // Arena phases use the dedicated flight controller in main.js; don't
    // touch position/rotation here or the PLAY_AREA clamp will drag the ship
    // back into the narrow combat corridor.
    const phase = ctx?.state?.round?.phase;
    if (!isOpenCombatPhase(phase)) {
      this._vx += (0 - this._vx) * dt * 10;
      this._vy += (0 - this._vy) * dt * 10;
      this._vz += (0 - this._vz) * dt * 10;
      return;
    }

    const isBoosting = this._keys['ShiftLeft'] || this._keys['ShiftRight'];
    const isBraking  = this._keys['ControlLeft'] || this._keys['ControlRight'];

    if (isBoosting) speed *= PLAY_AREA.BOOST_MULT;

    const decelRate = isBraking ? PLAY_AREA.BRAKE_DRAG : 10;
    const accel = dt * decelRate;

    const rawX = (this._isDown('moveRight') ? 1 : 0) - (this._isDown('moveLeft') ? 1 : 0);
    const ySign = this._settings?.invertYControls ? -1 : 1;
    const rawY = ((this._isDown('moveUp') ? 1 : 0) - (this._isDown('moveDown') ? 1 : 0)) * ySign;
    const inputLen = Math.hypot(rawX, rawY);
    const inputX = inputLen > 0 ? rawX / inputLen : 0;
    const inputY = inputLen > 0 ? rawY / inputLen : 0;

    this._vx += (inputX * speed - this._vx) * accel;
    this._vy += (inputY * speed - this._vy) * accel;
    this._vz += (0 - this._vz) * dt * 10;

    t.position.x = THREE.MathUtils.clamp(t.position.x + this._vx * dt, X_MIN, X_MAX);
    t.position.y = THREE.MathUtils.clamp(t.position.y + this._vy * dt, PLAY_AREA.Y_MIN, PLAY_AREA.Y_MAX);

    const speedNorm = Math.max(0.01, speed);
    const targetYaw   = -(this._vx / speedNorm) * 0.45;
    const targetPitch =  (this._vy / speedNorm) * 0.35;
    const targetBank  = -(this._vx / speedNorm) * 0.15;
    t.rotation.y = THREE.MathUtils.lerp(t.rotation.y, targetYaw,   dt * 7);
    t.rotation.x = THREE.MathUtils.lerp(t.rotation.x, targetPitch, dt * 7);
    t.rotation.z = THREE.MathUtils.lerp(t.rotation.z, targetBank,  dt * 7);
  }

  /** Exposed for world-motion scaling and camera sway in main.js. */
  getVelocity() { return { x: this._vx, y: this._vy, z: this._vz }; }
}
