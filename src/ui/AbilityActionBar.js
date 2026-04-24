import * as THREE from 'three';
import { createItemMesh } from '../scene/itemMeshes/index.js';
import { getItem } from '../hangar/HangarSystem.js';
import { ABILITY_ITEM_IDS, ABILITY_COMPONENT_NAMES } from './abilityHotkeys.js';

const SLOT_PX = 52;
const GAP_PX = 8;
const HUD_SLOT = {
  id: 'hud_ability',
  type: 'ability',
  shape: 'circle',
  size: 0.35,
  position: [0, 0, 0],
};

/**
 * Bottom HUD strip: procedural item meshes + per-slot cooldown overlays.
 * One WebGL canvas sits behind the DOM slot frames.
 */
export class AbilityActionBar {
  constructor() {
    this._bar = document.getElementById('ability-bar');
    this._canvas = document.getElementById('ability-meshes-canvas');
    this._slotEls = [...document.querySelectorAll('#ability-slots .ability-slot')];
    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._lights = null;
    /** @type {{ root: THREE.Group, mesh: ReturnType<typeof createItemMesh> }[]} */
    this._entries = [];
    this._n = 0;
    this._lastTotalW = 0;
  }

  /** Rebuild meshes from the player entity (call after UpgradeApplier.apply). */
  sync(playerEntity) {
    this._clearMeshes();
    if (!this._bar || !this._canvas || !playerEntity) {
      this._setVisible(false);
      return;
    }

    const active = [];
    for (let i = 0; i < ABILITY_COMPONENT_NAMES.length; i++) {
      if (playerEntity.get(ABILITY_COMPONENT_NAMES[i])) {
        active.push(ABILITY_ITEM_IDS[i]);
      }
    }
    this._n = active.length;

    if (this._n === 0) {
      this._setVisible(false);
      return;
    }

    this._setVisible(true);
    this._ensureRenderer();
    this._layoutCanvas();

    const spacing = 1.05;
    const half = (this._n - 1) * spacing * 0.5;
    for (let i = 0; i < this._n; i++) {
      const itemId = active[i];
      const item = getItem(itemId);
      if (!item) continue;
      const root = new THREE.Group();
      root.position.x = -half + i * spacing;
      const mesh = createItemMesh(item, HUD_SLOT, { phase: 'hangar' });
      mesh.phase = 'hangar';
      root.add(mesh.root);
      this._scene.add(root);
      this._entries.push({ root, mesh });
    }

    const margin = 0.5;
    const span = this._n * spacing + margin * 2;
    this._camera.left = -span / 2;
    this._camera.right = span / 2;
    this._camera.top = 0.85;
    this._camera.bottom = -0.85;
    this._camera.updateProjectionMatrix();

    for (let i = 0; i < this._slotEls.length; i++) {
      const el = this._slotEls[i];
      const keyEl = el.querySelector('.ability-key');
      const overlay = el.querySelector('.ability-cooldown-overlay');
      if (i < this._n) {
        el.classList.remove('hidden', 'ability-slot-empty');
        if (keyEl) keyEl.textContent = String(i + 1);
        if (overlay) overlay.style.transform = 'scaleY(0)';
      } else {
        el.classList.add('hidden', 'ability-slot-empty');
      }
    }
  }

  update(dt, playerEntity) {
    if (!this._n || !this._bar || this._bar.classList.contains('hidden')) return;
    if (!playerEntity || !this._renderer || !this._scene || !this._camera) return;

    const active = [];
    for (const name of ABILITY_COMPONENT_NAMES) {
      const c = playerEntity.get(name);
      if (c) active.push(c);
    }
    if (active.length !== this._n) {
      this.sync(playerEntity);
      return;
    }

    for (let i = 0; i < this._entries.length; i++) {
      this._entries[i].mesh.update(dt, { phase: 'hangar' });
    }

    for (let i = 0; i < this._n; i++) {
      const comp = active[i];
      const el = this._slotEls[i];
      if (!el) continue;
      const overlay = el.querySelector('.ability-cooldown-overlay');
      if (overlay && comp.cooldown > 0) {
        const t = Math.min(1, comp.remaining / comp.cooldown);
        overlay.style.transform = `scaleY(${t})`;
      } else if (overlay) {
        overlay.style.transform = 'scaleY(0)';
      }
      el.classList.toggle('ready', !!comp?.canTrigger?.());
    }

    this._renderer.render(this._scene, this._camera);
  }

  dispose() {
    this._clearMeshes();
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }
    this._scene = null;
    this._camera = null;
    this._lights = null;
  }

  _setVisible(on) {
    if (!this._bar) return;
    this._bar.classList.toggle('hidden', !on);
  }

  _layoutCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const totalW = this._n * SLOT_PX + (this._n - 1) * GAP_PX;
    this._lastTotalW = totalW;
    const h = SLOT_PX;
    this._canvas.style.width = `${totalW}px`;
    this._canvas.style.height = `${h}px`;
    this._canvas.width = Math.floor(totalW * dpr);
    this._canvas.height = Math.floor(h * dpr);
    if (this._renderer) {
      this._renderer.setPixelRatio(dpr);
      this._renderer.setSize(this._canvas.width, this._canvas.height, false);
    }
  }

  _ensureRenderer() {
    if (this._renderer) return;
    this._scene = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 20);
    this._camera.position.set(0, 0, 4);
    this._camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xaaccff, 0x221133, 0.85);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(2, 3, 2);
    this._scene.add(hemi, dir);
    this._lights = [hemi, dir];

    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  _clearMeshes() {
    for (const { mesh, root } of this._entries) {
      this._scene?.remove(root);
      mesh.dispose?.();
    }
    this._entries = [];
  }
}
