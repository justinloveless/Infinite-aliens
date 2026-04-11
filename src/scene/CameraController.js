import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this._camera = camera;
    this._basePos = new THREE.Vector3(0, 9, 13);
    this._baseLookAt = new THREE.Vector3(0, 0, -5);
    this._shakeTimer = 0;
    this._shakeIntensity = 0;
    this._floatTime = 0;
  }

  shake(intensity = 0.4, duration = 0.25) {
    this._shakeTimer = duration;
    this._shakeIntensity = intensity;
  }

  update(delta) {
    this._floatTime += delta;
    this._shakeTimer = Math.max(0, this._shakeTimer - delta);

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
