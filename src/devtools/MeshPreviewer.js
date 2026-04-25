import * as THREE from 'three';
import { buildShipHull } from '../scene/ShipMeshFactory.js';
import { getAllShipDefs } from '../components/ships/ShipRegistry.js';
import { ENEMY_DEFS } from '../components/enemy/EnemyDefs.js';

const CSS = {
  toolbar: 'position:absolute;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:10px;z-index:10;',
  select:  'background:#050a14;border:1px solid #2a3648;color:#cde;font-size:12px;padding:5px 10px;border-radius:3px;font-family:Courier New,monospace;cursor:pointer;flex:1;max-width:360px;',
  label:   'color:#5af;font-size:11px;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;',
  info:    'position:absolute;bottom:16px;left:16px;color:#8899aa;font-size:11px;line-height:1.7;pointer-events:none;',
  title:   'position:absolute;top:16px;right:16px;color:#7df;font-size:13px;letter-spacing:2px;text-transform:uppercase;pointer-events:none;',
  hint:    'position:absolute;bottom:16px;right:16px;color:#445566;font-size:10px;text-align:right;pointer-events:none;',
};

// Build the full list of previewable entries
function buildEntries() {
  const entries = [];

  // Ships
  const ships = getAllShipDefs();
  for (const def of ships) {
    entries.push({ group: 'Ships', label: def.displayName || def.id, kind: 'ship', id: def.id, variant: def.meshVariant || def.id });
  }

  // Enemies (non-boss first, then bosses)
  const bossEntries = [];
  for (const [key, def] of Object.entries(ENEMY_DEFS)) {
    if (!def || !def.type) continue;
    const isBoss = def.behavior === 'boss' || key.endsWith('_boss');
    const entry = { group: isBoss ? 'Bosses' : 'Enemies', label: key, kind: 'enemy', def };
    if (isBoss) bossEntries.push(entry);
    else entries.push(entry);
  }
  entries.push(...bossEntries);

  return entries;
}

function buildEnemyGroup(def) {
  const grp = new THREE.Group();
  if (def.buildGroup) {
    grp.add(def.buildGroup());
  } else {
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: new THREE.Color(def.color).multiplyScalar(0.5),
      metalness: 0.5,
      roughness: 0.4,
    });
    grp.add(new THREE.Mesh(def.geometry.clone(), mat));
  }
  return grp;
}

export class MeshPreviewer {
  constructor() {
    this._raf = 0;
    this._last = 0;
    this._yaw = 0;
    this._pitch = 0.2;
    this._zoom = 18;
    this._zoomMin = 4;
    this._zoomMax = 60;
    this._autoRotate = true;
    this._idleTimer = 0;
    this._drag = false;
    this._lastMX = 0;
    this._lastMY = 0;
    this._current = null;
    this._entries = buildEntries();
  }

  open() {
    this._root = document.createElement('div');
    this._root.style.cssText = 'position:fixed;inset:0;';
    document.body.appendChild(this._root);

    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this._root.appendChild(this._canvas);

    this._initThree();
    this._buildUI();
    this._initEvents();
    this._selectEntry(0);
    this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  _initThree() {
    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    this._scene = new THREE.Scene();
    this._scene.fog = new THREE.FogExp2(0x060018, 0.012);

    // Lighting (same as HangarUI)
    this._scene.add(new THREE.HemisphereLight(0xaaccff, 0x221133, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 5, 2);
    this._scene.add(key);
    const fill = new THREE.DirectionalLight(0xff66ff, 0.4);
    fill.position.set(-3, -1, -2);
    this._scene.add(fill);
    const rim = new THREE.DirectionalLight(0x4488ff, 0.3);
    rim.position.set(0, -3, 4);
    this._scene.add(rim);

    this._camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 500);
    this._pivot = new THREE.Group();
    this._scene.add(this._pivot);
  }

  _buildUI() {
    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = CSS.toolbar;

    const lbl = document.createElement('span');
    lbl.style.cssText = CSS.label;
    lbl.textContent = 'Preview:';
    toolbar.appendChild(lbl);

    this._select = document.createElement('select');
    this._select.style.cssText = CSS.select;

    let lastGroup = null;
    this._entries.forEach((entry, i) => {
      if (entry.group !== lastGroup) {
        const og = document.createElement('optgroup');
        og.label = entry.group;
        this._select.appendChild(og);
        lastGroup = entry.group;
      }
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = entry.label;
      this._select.lastChild.appendChild(opt);
    });

    this._select.addEventListener('change', () => this._selectEntry(parseInt(this._select.value)));
    toolbar.appendChild(this._select);

    this._root.appendChild(toolbar);

    // Title badge
    const title = document.createElement('div');
    title.style.cssText = CSS.title;
    title.textContent = 'Mesh Preview [DEV]';
    this._root.appendChild(title);

    // Info overlay
    this._infoEl = document.createElement('div');
    this._infoEl.style.cssText = CSS.info;
    this._root.appendChild(this._infoEl);

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = CSS.hint;
    hint.innerHTML = 'Drag to rotate &nbsp;|&nbsp; Scroll to zoom';
    this._root.appendChild(hint);
  }

  _selectEntry(index) {
    const entry = this._entries[index];
    if (!entry) return;

    // Clear previous mesh
    while (this._pivot.children.length) this._pivot.remove(this._pivot.children[0]);
    this._current = null;

    let grp;
    if (entry.kind === 'ship') {
      grp = buildShipHull({ variant: entry.variant, withLights: false });
    } else {
      grp = buildEnemyGroup(entry.def);
    }

    this._pivot.add(grp);
    this._current = entry;

    // Auto-fit zoom based on bounding sphere
    const box = new THREE.Box3().setFromObject(grp);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius || 1;
    this._zoom = Math.min(this._zoomMax, Math.max(this._zoomMin, r * 3.5));
    this._zoomMin = r * 1.2;
    this._zoomMax = r * 12;

    this._updateInfo(entry, sphere);
    this._yaw = 0;
    this._pitch = 0.2;
    this._autoRotate = true;
  }

  _updateInfo(entry, sphere) {
    const lines = [`<b style="color:#cde">${entry.label}</b>`, `Group: ${entry.group}`];
    if (entry.kind === 'enemy') {
      const d = entry.def;
      lines.push(`Color: #${d.color.toString(16).padStart(6, '0')}`);
      lines.push(`Collision radius: ${d.collisionRadius}`);
      lines.push(`Composite mesh: ${d.buildGroup ? 'yes' : 'no'}`);
    } else {
      lines.push(`Variant: ${entry.variant}`);
    }
    lines.push(`Bounding radius: ${sphere.radius.toFixed(2)}`);
    this._infoEl.innerHTML = lines.join('<br>');
  }

  _initEvents() {
    const c = this._canvas;

    c.addEventListener('mousedown', e => {
      this._drag = true;
      this._autoRotate = false;
      this._idleTimer = 0;
      this._lastMX = e.clientX;
      this._lastMY = e.clientY;
    });

    window.addEventListener('mousemove', e => {
      if (!this._drag) return;
      const dx = e.clientX - this._lastMX;
      const dy = e.clientY - this._lastMY;
      this._yaw -= dx * 0.008;
      this._pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this._pitch + dy * 0.006));
      this._lastMX = e.clientX;
      this._lastMY = e.clientY;
    });

    window.addEventListener('mouseup', () => { this._drag = false; });

    c.addEventListener('wheel', e => {
      e.preventDefault();
      this._zoom = Math.max(this._zoomMin, Math.min(this._zoomMax, this._zoom + e.deltaY * 0.04));
      this._autoRotate = false;
      this._idleTimer = 0;
    }, { passive: false });

    window.addEventListener('resize', () => {
      this._renderer.setSize(window.innerWidth, window.innerHeight);
      this._camera.aspect = window.innerWidth / window.innerHeight;
      this._camera.updateProjectionMatrix();
    });
  }

  _tick(now) {
    this._raf = requestAnimationFrame(this._tick.bind(this));
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;

    if (!this._drag) {
      this._idleTimer += dt;
      if (this._idleTimer > 2.5) this._autoRotate = true;
    }
    if (this._autoRotate) this._yaw += dt * 0.4;

    // Orbit camera
    const cy = Math.cos(this._pitch);
    const sy = Math.sin(this._pitch);
    const cx = Math.cos(this._yaw);
    const sx = Math.sin(this._yaw);
    this._camera.position.set(sx * cy * this._zoom, sy * this._zoom, cx * cy * this._zoom);
    this._camera.lookAt(0, 0, 0);

    this._renderer.render(this._scene, this._camera);
  }
}
