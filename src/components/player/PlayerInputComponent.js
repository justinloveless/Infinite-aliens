import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { PLAY_AREA } from '../../constants.js';
import { isOpenCombatPhase } from '../../core/phaseUtil.js';
import { MouseAimTracker } from '../../core/MouseAimTracker.js';

const ARROW_ALTS = {
  moveUp:    'ArrowUp',
  moveDown:  'ArrowDown',
  moveLeft:  'ArrowLeft',
  moveRight: 'ArrowRight',
};

const X_MIN = PLAY_AREA.X_MIN + 2;
const X_MAX = PLAY_AREA.X_MAX - 2;

/**
 * Mouse-aim flight: the crosshair follows the mouse; a spring force pulls the
 * ship toward it. W/Shift = boost, S = brake, A/D = strafe X, Space/Ctrl = strafe Y.
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

    const isBoosting     = this._keys['ShiftLeft'] || this._keys['ShiftRight'] || this._isDown('moveUp');
    const isBraking      = this._isDown('moveDown');
    const isStrafingLeft  = this._isDown('moveLeft');
    const isStrafingRight = this._isDown('moveRight');
    const isStrafingUp    = this._keys['Space'];
    const isStrafingDown  = this._keys['ControlLeft'] || this._keys['ControlRight'];

    const ma = MouseAimTracker;
    const ySign = this._settings?.invertYControls ? -1 : 1;
    const aimAngle = PLAY_AREA.MOUSE_AIM_ANGLE;

    // Mouse position maps to a target velocity via trigonometric scaling so the
    // response feels proportional rather than linearly dead-zone-free.
    const boostMult = isBoosting ? PLAY_AREA.BOOST_MULT : 1;
    const mouseVx = Math.sin(ma.x * aimAngle) * speed * boostMult;
    const mouseVy = Math.sin(ma.y * aimAngle * ySign) * speed * boostMult;

    // Keyboard strafe: additive bias on the mouse-driven spring target.
    let targetVx = mouseVx;
    let targetVy = mouseVy;
    if (isStrafingLeft)  targetVx -= speed * boostMult;
    if (isStrafingRight) targetVx += speed * boostMult;
    if (isStrafingUp)    targetVy += speed * boostMult;
    if (isStrafingDown)  targetVy -= speed * boostMult;

    // Spring drives velocity toward the mouse-derived target; Shift doubles the
    // spring rate so the ship snaps faster when boosting.
    const spring = PLAY_AREA.MOUSE_SPRING * (isBoosting ? 2 : 1);
    this._vx += (targetVx - this._vx) * spring * dt;
    this._vy += (targetVy - this._vy) * spring * dt;

    // S applies heavy damping for a quick stop.
    if (isBraking) {
      this._vx += (0 - this._vx) * PLAY_AREA.BRAKE_DRAG * dt;
      this._vy += (0 - this._vy) * PLAY_AREA.BRAKE_DRAG * dt;
    }

    this._vz += (0 - this._vz) * dt * 10;

    t.position.x = THREE.MathUtils.clamp(t.position.x + this._vx * dt, X_MIN, X_MAX);
    t.position.y = THREE.MathUtils.clamp(t.position.y + this._vy * dt, PLAY_AREA.Y_MIN, PLAY_AREA.Y_MAX);

    // Rotation follows mouse aim only — strafe moves the ship without tilting it.
    const speedNorm = Math.max(0.01, speed);
    const targetYaw   = -(mouseVx / speedNorm) * 0.45;
    const targetPitch =  (mouseVy / speedNorm) * 0.35;
    const targetBank  = -(mouseVx / speedNorm) * 0.15;
    t.rotation.y = THREE.MathUtils.lerp(t.rotation.y, targetYaw,   dt * 7);
    t.rotation.x = THREE.MathUtils.lerp(t.rotation.x, targetPitch, dt * 7);
    t.rotation.z = THREE.MathUtils.lerp(t.rotation.z, targetBank,  dt * 7);
  }

  /** Exposed for world-motion scaling and camera sway in main.js. */
  getVelocity() { return { x: this._vx, y: this._vy, z: this._vz }; }
}
