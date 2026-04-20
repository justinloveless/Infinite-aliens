import * as THREE from 'three';

/**
 * Central renderer that batches all projectile meshes into InstancedMesh
 * buckets, one per (type, visualOverride) combination. Collapses hundreds of
 * draw calls into a handful.
 *
 * Lifecycle:
 *   - Components call `allocate(spec)` to claim a slot and receive a handle.
 *   - Each frame components call `handle.setTransform(pos, dir)` which writes
 *     the projectile's position + velocity-aligned rotation into the
 *     InstancedMesh's `instanceMatrix` (we defer the upload flag until
 *     `flush()` once per frame).
 *   - On destroy components call `handle.release()` which marks the slot free
 *     and hides it by parking the matrix far offscreen (cheap + no shader
 *     change needed).
 *
 * Bucket capacity grows geometrically (2x) if exhausted. Per-instance color
 * is supported via `handle.setColor(hex)` and is used by the manual-gun heat
 * visual.
 */

const MATRIX_STRIDE = 16;
const HIDDEN_MATRIX = new THREE.Matrix4().makeTranslation(1e6, 1e6, 1e6);
const _tmpMatrix = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpColor = new THREE.Color();
const _tmpDir = new THREE.Vector3();
// Cylinder/cone geometries default with their length along +Y. Aligning this
// axis to the projectile's velocity makes the projectile point in the
// direction of travel.
const PROJECTILE_UP_AXIS = new THREE.Vector3(0, 1, 0);
const DEFAULT_FORWARD = new THREE.Vector3(0, 0, -1);

const INITIAL_CAPACITY = 64;

export class ProjectileRenderer {
  constructor(scene) {
    this._scene = scene;
    /** @type {Map<string, Bucket>} */
    this._buckets = new Map();
  }

  /**
   * @param {{
   *   key: string,
   *   geometry: THREE.BufferGeometry,
   *   scale: number,
   *   rotateX?: boolean,
   *   color: number,
   * }} spec
   */
  allocate(spec) {
    const bucket = this._getOrCreateBucket(spec);
    if (bucket.freeSlots.length === 0) bucket.grow();
    const slot = bucket.freeSlots.pop();
    bucket.used[slot] = true;
    bucket.liveCount++;
    return new ProjectileHandle(bucket, slot);
  }

  /**
   * Called once per frame to push any queued instanceMatrix / instanceColor
   * changes to the GPU.
   */
  flush() {
    for (const bucket of this._buckets.values()) bucket.flush();
  }

  _getOrCreateBucket(spec) {
    let bucket = this._buckets.get(spec.key);
    if (bucket) return bucket;
    bucket = new Bucket(spec, this._scene);
    this._buckets.set(spec.key, bucket);
    return bucket;
  }
}

class Bucket {
  constructor(spec, scene) {
    this._spec = spec;
    this._scene = scene;
    this._material = new THREE.MeshBasicMaterial({ color: spec.color });
    // Projectiles orient to their velocity direction each frame, so no static
    // base rotation is needed. `spec.rotateX` is kept for bucket-key parity but
    // no longer applied.
    this._scale = spec.scale || 1;
    this.used = [];
    this.freeSlots = [];
    this.liveCount = 0;
    this.matrixDirty = false;
    this.colorDirty = false;
    this.mesh = null;
    this._resize(INITIAL_CAPACITY);
    scene.groups.projectiles.add(this.mesh);
  }

  _resize(newCapacity) {
    const prev = this.mesh;
    const mesh = new THREE.InstancedMesh(this._spec.geometry, this._material, newCapacity);
    mesh.frustumCulled = false; // projectiles cover a large range; avoid CPU cull work
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Enable per-instance color so manual-heat / override tints work.
    const colorArr = new Float32Array(newCapacity * 3);
    for (let i = 0; i < newCapacity; i++) {
      colorArr[i * 3] = 1;
      colorArr[i * 3 + 1] = 1;
      colorArr[i * 3 + 2] = 1;
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    const prevCapacity = this.capacity || 0;

    // Park every slot offscreen.
    for (let i = 0; i < newCapacity; i++) {
      mesh.setMatrixAt(i, HIDDEN_MATRIX);
    }

    // Copy any existing data from the previous mesh.
    if (prev) {
      for (let i = 0; i < prevCapacity; i++) {
        if (this.used[i]) {
          prev.getMatrixAt(i, _tmpMatrix);
          mesh.setMatrixAt(i, _tmpMatrix);
          if (prev.instanceColor) {
            const r = prev.instanceColor.array[i * 3];
            const g = prev.instanceColor.array[i * 3 + 1];
            const b = prev.instanceColor.array[i * 3 + 2];
            colorArr[i * 3] = r;
            colorArr[i * 3 + 1] = g;
            colorArr[i * 3 + 2] = b;
          }
        }
      }
    }

    // Add newly-minted free slots to the free-list (highest first so we pop low).
    for (let i = newCapacity - 1; i >= prevCapacity; i--) {
      this.used[i] = false;
      this.freeSlots.push(i);
    }

    this.capacity = newCapacity;
    this.matrixDirty = true;
    this.colorDirty = true;

    if (prev) {
      this._scene.groups.projectiles.remove(prev);
      prev.dispose();
    }
    this.mesh = mesh;
  }

  grow() {
    this._resize(this.capacity * 2);
  }

  setTransform(slot, x, y, z, dx, dy, dz) {
    _tmpPos.set(x, y, z);
    _tmpScale.set(this._scale, this._scale, this._scale);
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq > 1e-8) {
      const inv = 1 / Math.sqrt(lenSq);
      _tmpDir.set(dx * inv, dy * inv, dz * inv);
    } else {
      _tmpDir.copy(DEFAULT_FORWARD);
    }
    _tmpQuat.setFromUnitVectors(PROJECTILE_UP_AXIS, _tmpDir);
    _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
    this.mesh.setMatrixAt(slot, _tmpMatrix);
    this.matrixDirty = true;
  }

  setColorHex(slot, hex) {
    _tmpColor.setHex(hex);
    this.mesh.instanceColor.setXYZ(slot, _tmpColor.r, _tmpColor.g, _tmpColor.b);
    this.colorDirty = true;
  }

  release(slot) {
    if (!this.used[slot]) return;
    this.used[slot] = false;
    this.liveCount--;
    this.mesh.setMatrixAt(slot, HIDDEN_MATRIX);
    this.freeSlots.push(slot);
    this.matrixDirty = true;
  }

  flush() {
    if (this.matrixDirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.matrixDirty = false;
    }
    if (this.colorDirty) {
      this.mesh.instanceColor.needsUpdate = true;
      this.colorDirty = false;
    }
  }
}

class ProjectileHandle {
  constructor(bucket, slot) {
    this._bucket = bucket;
    this._slot = slot;
    this._released = false;
  }

  setTransform(pos, dir) {
    if (this._released) return;
    const dx = dir?.x ?? 0;
    const dy = dir?.y ?? 0;
    const dz = dir?.z ?? -1;
    this._bucket.setTransform(this._slot, pos.x, pos.y, pos.z, dx, dy, dz);
  }

  setColor(hex) {
    if (this._released) return;
    this._bucket.setColorHex(this._slot, hex);
  }

  release() {
    if (this._released) return;
    this._released = true;
    this._bucket.release(this._slot);
  }
}
