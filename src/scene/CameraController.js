import * as THREE from 'three';

const FOV_SPEED_BONUS = 10;      // degrees of extra FOV at max speed
const FOV_LERP_RATE   = 3;       // per-sec lerp for FOV toward target
const ROLL_FACTOR     = 0.75;    // camera roll as fraction of ship's rotation.z
const ROLL_LERP_RATE  = 8;       // per-sec lerp for camera roll
const SWING_AMOUNT    = 3.2;     // lateral camera offset at full yaw input (world units)
const SWING_LERP_RATE = 5;       // per-sec lerp for swing offset

// Combat-corridor "screen tilt" — subtler version of the arena cinematic so
// the static-camera corridor phase still reads as flight instead of a fixed
// camera over a moving ship.
const COMBAT_ROLL_FACTOR   = 0.125;  // camera roll as fraction of ship's rotation.z
const COMBAT_ROLL_LERP     = 6;
const COMBAT_SWAY_PER_VEL  = 0.125;  // world units of camera-X offset per unit of vx
const COMBAT_SWAY_MAX      = 1.6;   // clamp on the lateral sway
const COMBAT_SWAY_LERP     = 4;

export class CameraController {
  constructor(camera) {
    this._camera = camera;
    this._basePos = new THREE.Vector3(0, 9, 13);
    this._baseLookAt = new THREE.Vector3(0, 0, -5);
    this._shakeTimer = 0;
    this._shakeIntensity = 0;
    this._floatTime = 0;
    this._arenaMode = false;
    this._trackT = null;

    // Arena follow tunables — overridden by transition controller via
    // setArenaOffset() to drive the "camera pulls back" moment.
    this._arenaBack = 14;
    this._arenaUp = 6;
    this._arenaLead = 6;
    this._arenaLerp = 7;

    // Cinematic state.
    this._baseFov = camera.fov;
    this._speedRatio = 0;       // 0..1 from main loop
    this._yawInput = 0;         // -1..1 from main loop
    this._fov = camera.fov;
    this._roll = 0;
    this._swing = 0;

    // Combat-corridor screen tilt state. Targets are pushed from main loop;
    // smoothed values are what actually drive the camera this frame.
    this._combatRollTarget = 0;
    this._combatRoll = 0;
    this._combatSwayTarget = 0;
    this._combatSway = 0;
  }

  shake(intensity = 0.4, duration = 0.25) {
    this._shakeTimer = duration;
    this._shakeIntensity = intensity;
  }

  /**
   * Switch to arena-follow mode. Camera follows the ship's position and yaw
   * (ship-local -Z is forward), sitting behind and above it and looking ahead.
   * @param {boolean} on
   * @param {object|null} trackTransform - TransformComponent-like with position + rotation.y
   */
  setArenaMode(on, trackTransform = null) {
    this._arenaMode = on;
    this._trackT = trackTransform;
    if (!on) {
      // Snap FOV and cinematic state back to baseline when leaving arena.
      this._speedRatio = 0;
      this._yawInput = 0;
      this._roll = 0;
      this._swing = 0;
      this._fov = this._baseFov;
      if (this._camera.fov !== this._baseFov) {
        this._camera.fov = this._baseFov;
        this._camera.updateProjectionMatrix();
      }
      this._camera.up.set(0, 1, 0);
    }
  }

  /**
   * Adjust the arena follow camera offset. Pass a subset; missing keys keep
   * current values. Used by the arena transition to animate pull-back.
   */
  setArenaOffset({ back, up, lead, lerp } = {}) {
    if (typeof back === 'number') this._arenaBack = back;
    if (typeof up === 'number') this._arenaUp = up;
    if (typeof lead === 'number') this._arenaLead = lead;
    if (typeof lerp === 'number') this._arenaLerp = lerp;
  }

  /** Drives speed-based FOV pulse. 0 = base FOV, 1 = base + FOV_SPEED_BONUS. */
  setSpeedRatio(r) {
    this._speedRatio = Math.max(0, Math.min(1, r || 0));
  }

  /** Drives the chase swing. -1..1; sign matches yaw direction. */
  setYawInput(y) {
    this._yawInput = Math.max(-1, Math.min(1, y || 0));
  }

  /**
   * Feed the combat-corridor screen tilt each frame.
   * @param {{roll?: number, vx?: number}} opts
   *   roll — target roll in radians (usually the player ship's rotation.z)
   *   vx   — player lateral velocity in world units/sec (for parallax sway)
   *
   * Pass zeroes when not in combat phase to let the camera relax to level.
   */
  setCombatSway({ roll = 0, vx = 0 } = {}) {
    this._combatRollTarget = roll;
    const clamped = Math.max(-COMBAT_SWAY_MAX, Math.min(COMBAT_SWAY_MAX, vx * COMBAT_SWAY_PER_VEL));
    this._combatSwayTarget = clamped;
  }

  /** Immediately snap the camera to the current arena follow pose. */
  snapToArenaPose() {
    if (!this._arenaMode || !this._trackT) return;
    const t = this._trackT;
    const yaw = t.rotation?.y ?? 0;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    this._camera.position.set(
      t.position.x - fx * this._arenaBack,
      t.position.y + this._arenaUp,
      t.position.z - fz * this._arenaBack,
    );
    this._camera.up.set(0, 1, 0);
    this._camera.lookAt(
      t.position.x + fx * this._arenaLead,
      t.position.y + 0.5,
      t.position.z + fz * this._arenaLead,
    );
  }

  update(delta) {
    this._floatTime += delta;
    this._shakeTimer = Math.max(0, this._shakeTimer - delta);

    if (this._arenaMode && this._trackT) {
      const t = this._trackT;
      const yaw = t.rotation?.y ?? 0;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      // Ship-right vector in world (perpendicular to forward, in XZ plane).
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      let shakeX = 0, shakeY = 0;
      if (this._shakeTimer > 0) {
        const s = this._shakeTimer / 0.25;
        shakeX = (Math.random() - 0.5) * this._shakeIntensity * s;
        shakeY = (Math.random() - 0.5) * this._shakeIntensity * s;
      }

      // Chase swing: lerp toward yawInput * SWING_AMOUNT, applied along
      // ship-right so the camera appears to swing wide opposite the turn.
      const swingTarget = this._yawInput * SWING_AMOUNT;
      this._swing += (swingTarget - this._swing) * Math.min(1, delta * SWING_LERP_RATE);
      const swingX = rx * this._swing;
      const swingZ = rz * this._swing;

      const desired = new THREE.Vector3(
        t.position.x - fx * this._arenaBack + swingX + shakeX,
        t.position.y + this._arenaUp + shakeY,
        t.position.z - fz * this._arenaBack + swingZ,
      );
      this._camera.position.lerp(desired, Math.min(1, delta * this._arenaLerp));

      // Roll with ship bank. Build an "up" vector tilted about the forward
      // axis (which is (fx, 0, fz) in world), then call lookAt so THREE
      // composes the camera basis accordingly.
      const shipRoll = t.rotation?.z ?? 0;
      const targetRoll = shipRoll * ROLL_FACTOR;
      this._roll += (targetRoll - this._roll) * Math.min(1, delta * ROLL_LERP_RATE);
      const forward = new THREE.Vector3(fx, 0, fz).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(forward, this._roll);
      this._camera.up.copy(up);

      this._camera.lookAt(
        t.position.x + fx * this._arenaLead + shakeX * 0.3,
        t.position.y + 0.5 + shakeY * 0.3,
        t.position.z + fz * this._arenaLead,
      );

      // Speed-based FOV pulse.
      const targetFov = this._baseFov + this._speedRatio * FOV_SPEED_BONUS;
      this._fov += (targetFov - this._fov) * Math.min(1, delta * FOV_LERP_RATE);
      if (Math.abs(this._camera.fov - this._fov) > 0.01) {
        this._camera.fov = this._fov;
        this._camera.updateProjectionMatrix();
      }
      return;
    }

    const floatY = Math.sin(this._floatTime * 0.4) * 0.08;
    const floatX = Math.sin(this._floatTime * 0.25) * 0.05;

    let shakeX = 0, shakeY = 0;
    if (this._shakeTimer > 0) {
      const t = this._shakeTimer / 0.25;
      shakeX = (Math.random() - 0.5) * this._shakeIntensity * t;
      shakeY = (Math.random() - 0.5) * this._shakeIntensity * t;
    }

    // Combat screen tilt: lerp roll + lateral sway toward whatever the main
    // loop last fed us (zeroed automatically outside combat phase).
    this._combatRoll += (this._combatRollTarget - this._combatRoll) * Math.min(1, delta * COMBAT_ROLL_LERP);
    this._combatSway += (this._combatSwayTarget - this._combatSway) * Math.min(1, delta * COMBAT_SWAY_LERP);

    // Sign is negated vs. ship rotation.z because the combat camera looks
    // down at the ship (forward has a large -Y component), which inverts the
    // apparent roll direction relative to the arena chase cam.
    const rollAngle = -this._combatRoll * COMBAT_ROLL_FACTOR;
    const swayX = this._combatSway;

    const camX = this._basePos.x + floatX + shakeX + swayX;
    const camY = this._basePos.y + floatY + shakeY;
    const camZ = this._basePos.z;
    this._camera.position.set(camX, camY, camZ);

    const lookX = this._baseLookAt.x + shakeX + swayX * 0.5;
    const lookY = this._baseLookAt.y + shakeY * 0.5;
    const lookZ = this._baseLookAt.z;

    if (Math.abs(rollAngle) > 0.0001) {
      // Roll the camera about its forward axis by rotating the `up` vector.
      // THREE.Object3D.lookAt reads `up` each call so this just works.
      const forward = new THREE.Vector3(lookX - camX, lookY - camY, lookZ - camZ).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyAxisAngle(forward, rollAngle);
      this._camera.up.copy(up);
    } else {
      this._camera.up.set(0, 1, 0);
    }

    this._camera.lookAt(lookX, lookY, lookZ);
  }
}
