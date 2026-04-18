import * as THREE from 'three';

const DEFAULT_CAPACITY = 24;

/**
 * A fixed pool of PointLights kept permanently in the scene graph. Consumers
 * `acquire()` a light, mutate its `color`/`distance`/`intensity`/`position`,
 * and `release()` it when done. Because the light count in the scene graph
 * never changes, `MeshStandardMaterial` shader programs are never invalidated
 * -> no mid-game shader recompilation hitches.
 *
 * If the pool is exhausted (too many effects at once), `acquire()` returns
 * null and the caller should render without a dynamic light this frame.
 */
export class LightPool {
  constructor({ scene, capacity = DEFAULT_CAPACITY } = {}) {
    this._scene = scene;
    this._lights = [];
    this._free = [];

    for (let i = 0; i < capacity; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1);
      light.position.set(0, -9999, 0);
      scene.add(light);
      this._lights.push(light);
      this._free.push(i);
    }
  }

  /** Grab a light. Returns the THREE.PointLight or null if the pool is full. */
  acquire(color = 0xffffff, intensity = 1, distance = 5) {
    const idx = this._free.pop();
    if (idx === undefined) return null;
    const light = this._lights[idx];
    light.color.setHex(color);
    light.intensity = intensity;
    light.distance = distance;
    light.userData.__poolIdx = idx;
    return light;
  }

  /** Return a light to the pool. Safe to call with null. */
  release(light) {
    if (!light) return;
    const idx = light.userData.__poolIdx;
    if (idx === undefined) return;
    light.intensity = 0;
    light.position.set(0, -9999, 0);
    light.userData.__poolIdx = undefined;
    this._free.push(idx);
  }

  get size() { return this._lights.length; }
  get available() { return this._free.length; }
}
