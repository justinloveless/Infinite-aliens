import * as THREE from 'three';

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
    this._arenaLerp = 5;
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

      let shakeX = 0, shakeY = 0;
      if (this._shakeTimer > 0) {
        const s = this._shakeTimer / 0.25;
        shakeX = (Math.random() - 0.5) * this._shakeIntensity * s;
        shakeY = (Math.random() - 0.5) * this._shakeIntensity * s;
      }

      const desired = new THREE.Vector3(
        t.position.x - fx * this._arenaBack + shakeX,
        t.position.y + this._arenaUp + shakeY,
        t.position.z - fz * this._arenaBack,
      );
      this._camera.position.lerp(desired, Math.min(1, delta * this._arenaLerp));
      this._camera.lookAt(
        t.position.x + fx * this._arenaLead + shakeX * 0.3,
        t.position.y + 0.5 + shakeY * 0.3,
        t.position.z + fz * this._arenaLead,
      );
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

    this._camera.position.set(
      this._basePos.x + floatX + shakeX,
      this._basePos.y + floatY + shakeY,
      this._basePos.z
    );
    this._camera.lookAt(
      this._baseLookAt.x + shakeX,
      this._baseLookAt.y + shakeY * 0.5,
      this._baseLookAt.z
    );
  }
}
