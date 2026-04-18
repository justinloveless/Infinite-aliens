import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { PLAY_AREA } from '../../constants.js';

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

/**
 * Reads keyboard input and writes velocity into the player's TransformComponent.
 * Owns its own input listeners.
 */
export class PlayerInputComponent extends Component {
  constructor({ settings = null } = {}) {
    super();
    this._settings = settings;
    this._keys = {};
    this._vx = 0;
    this._vz = 0;
    this._time = 0;
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
    this._time += dt;
    const t = this.entity?.get('TransformComponent');
    if (!t) return;

    const player = this.entity.get('PlayerStatsComponent');
    let speed = player?.speed ?? 3;
    // Apply active speed boost from ability
    const boost = this.entity.get('SpeedBoostAbilityComponent');
    if (boost?.isActive()) speed *= boost.boostMult;

    const inputX = (this._isDown('moveRight') ? 1 : 0) - (this._isDown('moveLeft') ? 1 : 0);
    const inputZ = (this._isDown('moveDown')  ? 1 : 0) - (this._isDown('moveUp')   ? 1 : 0);

    // Suspend input/movement while not in combat
    const phase = ctx?.state?.round?.phase;
    const combatActive = phase === 'combat';

    const accel = dt * 10;
    const targetVx = combatActive ? inputX * speed : 0;
    const targetVz = combatActive ? inputZ * speed : 0;
    this._vx += (targetVx - this._vx) * accel;
    this._vz += (targetVz - this._vz) * accel;

    t.position.x = THREE.MathUtils.clamp(t.position.x + this._vx * dt, X_MIN, X_MAX);
    t.position.z = THREE.MathUtils.clamp(t.position.z + this._vz * dt, Z_MIN, Z_MAX);
    t.position.y = Math.sin(this._time * 1.2) * 0.15;

    const bank = -(this._vx / Math.max(0.01, speed)) * 0.38;
    const pitch = (this._vz / Math.max(0.01, speed)) * 0.12;
    t.rotation.z = THREE.MathUtils.lerp(t.rotation.z, bank, dt * 7);
    t.rotation.x = THREE.MathUtils.lerp(t.rotation.x, pitch, dt * 7);
  }

  /** Exposed for world-motion scaling in main.js. */
  getVelocity() { return { x: this._vx, z: this._vz }; }
}
