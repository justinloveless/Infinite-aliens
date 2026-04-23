import * as THREE from 'three';
import { ItemMeshRegistry } from '../scene/itemMeshes/ItemMeshRegistry.js';
import { getItem } from '../hangar/HangarSystem.js';

export const PREVIEW_SIZE = 168;

/** Bump when static snapshot lighting/size changes so thumbnails regenerate. */
const STATIC_PREVIEW_CACHE_TAG = 3;
const _cache = new Map();

function _staticCacheKey(itemId) {
  return `${itemId}\0s${STATIC_PREVIEW_CACHE_TAG}`;
}

let _renderer;
let _scene;
let _camera;
let _inited = false;

/** @type {{ host: HTMLElement, itemId: string, raf: number, inst: import('../scene/itemMeshes/ItemMesh.js').ItemMesh, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera } | null} */
let _live = null;

function _addPreviewLights(scene) {
  scene.add(new THREE.AmbientLight(0xc8d8ff, 0.35));
  const hemi = new THREE.HemisphereLight(0xaaccff, 0x1c1a24, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(1.1, 1.35, 1.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8899ff, 0.55);
  fill.position.set(-1.2, 0.4, -0.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.45);
  rim.position.set(-0.4, -0.8, 1.8);
  scene.add(rim);
}

function _ensureStaticRenderer() {
  if (_inited) return;
  _inited = true;
  ItemMeshRegistry.registerDefaults();
  _renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  _renderer.setPixelRatio(1);
  _renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
  _renderer.setClearColor(0x0a0d14, 1);
  _renderer.outputColorSpace = THREE.SRGBColorSpace;
  _renderer.toneMapping = THREE.ACESFilmicToneMapping;
  _renderer.toneMappingExposure = 1.12;

  _scene = new THREE.Scene();
  _camera = new THREE.PerspectiveCamera(38, 1, 0.04, 80);
  _addPreviewLights(_scene);
}

function _frameObject(camera, root) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) {
    camera.position.set(0.35, 0.28, 0.65);
    camera.lookAt(0, 0, 0);
    camera.near = 0.05;
    camera.far = 20;
    camera.updateProjectionMatrix();
    return;
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.12);
  const dist = maxDim * 2.35;
  camera.position.set(
    center.x + dist * 0.55,
    center.y + dist * 0.38,
    center.z + dist * 0.72,
  );
  camera.lookAt(center);
  camera.near = Math.max(0.02, dist / 120);
  camera.far = dist * 24;
  camera.updateProjectionMatrix();
}

/**
 * Renders the procedural item mesh to a PNG data URL (cached per item id).
 * @param {string} itemId
 * @returns {Promise<string | null>}
 */
export function getStoreItemPreviewDataUrl(itemId) {
  const ck = _staticCacheKey(itemId);
  if (_cache.has(ck)) return Promise.resolve(_cache.get(ck));
  const item = getItem(itemId);
  if (!item) return Promise.resolve(null);

  let inst;
  try {
    _ensureStaticRenderer();
    const slot = { type: item.slotType || 'utility', size: 0.38 };
    const ctx = { phase: 'hangar', state: {} };
    inst = ItemMeshRegistry.create(item, slot, ctx);
  } catch {
    return Promise.resolve(null);
  }

  try {
    inst.root.position.set(0, 0, 0);
    inst.root.rotation.set(0.18, 0.55, 0);
    inst.update(0.05, { phase: 'hangar', state: {} });
    _scene.add(inst.root);
    _frameObject(_camera, inst.root);
    _renderer.render(_scene, _camera);
    const url = _renderer.domElement.toDataURL('image/png');
    _cache.set(ck, url);
    return Promise.resolve(url);
  } catch {
    return Promise.resolve(null);
  } finally {
    if (inst?.root?.parent) _scene.remove(inst.root);
    inst?.dispose?.();
  }
}

function _disposeLive() {
  if (!_live) return;
  cancelAnimationFrame(_live.raf);
  if (_live.inst?.root?.parent) _live.scene.remove(_live.inst.root);
  _live.inst?.dispose?.();
  _live.renderer.dispose();
  const { host, itemId } = _live;
  _live = null;

  const url = _cache.get(_staticCacheKey(itemId));
  if (host.isConnected) {
    host.innerHTML = url
      ? `<img src="${url}" alt="" draggable="false" loading="lazy" />`
      : '';
  }
}

function _liveTick(now) {
  if (!_live) return;
  const t = _live;
  const dt = Math.min(0.05, (now - t._lastT) / 1000);
  t._lastT = now;
  t.inst.root.rotation.y += dt * 0.42;
  t.inst.update(dt, { phase: 'hangar', state: {} });
  t.renderer.render(t.scene, t.camera);
  t.raf = requestAnimationFrame(_liveTick);
}

/**
 * @param {HTMLElement} host `.store-card-preview`
 * @param {string} itemId
 * @param {boolean} active
 */
export function setStorePreviewHover(host, itemId, active) {
  if (!active) {
    if (_live && _live.host === host) _disposeLive();
    return;
  }
  if (_live?.host === host) return;

  _disposeLive();

  const item = getItem(itemId);
  if (!item) return;

  let inst;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.04, 80);
  _addPreviewLights(scene);

  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  canvas.className = 'store-card-preview-canvas';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
  renderer.setClearColor(0x0a0d14, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  try {
    const slot = { type: item.slotType || 'utility', size: 0.38 };
    const ctx = { phase: 'hangar', state: {} };
    inst = ItemMeshRegistry.create(item, slot, ctx);
  } catch {
    renderer.dispose();
    return;
  }

  inst.root.position.set(0, 0, 0);
  inst.root.rotation.set(0.18, 0.55, 0);
  inst.update(0.05, { phase: 'hangar', state: {} });
  scene.add(inst.root);
  _frameObject(camera, inst.root);

  host.innerHTML = '';
  host.appendChild(canvas);

  _live = {
    host,
    itemId,
    inst,
    renderer,
    scene,
    camera,
    raf: 0,
    _lastT: performance.now(),
  };
  _live.raf = requestAnimationFrame(_liveTick);
}

export function disposeAllStorePreviewHover() {
  _disposeLive();
}

export function clearStoreItemPreviewCache() {
  _cache.clear();
}
