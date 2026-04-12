import { Projectile } from './Projectile.js';

export class ProjectilePool {
  constructor(scene, size = 200) {
    this._pool = [];
    this._active = [];
    this._visualOverrides = new Map(); // type -> ProjectileVisual spec
    const group = scene.groups.projectiles;

    for (let i = 0; i < size; i++) {
      const proj = new Projectile();
      group.add(proj.mesh);
      this._pool.push(proj);
    }
  }

  spawn(pos, dir, damage, isCrit, type = 'laser', isPlayer = true, target = null) {
    let proj = this._pool.pop();
    if (!proj) {
      // Expand pool if needed
      proj = new Projectile();
    }
    // Resolve visual override: exact type match, or 'all' fallback
    const override = this._visualOverrides.get(type) || this._visualOverrides.get('all') || null;
    proj.activate(pos, dir, damage, isCrit, type, isPlayer, target, isPlayer ? override : null);
    this._active.push(proj);
    return proj;
  }

  // Called from _rebuildComputed() when upgrades change
  applyProjectileVisual(visuals) {
    this._visualOverrides.clear();
    if (!visuals) return;
    for (const [type, spec] of visuals) {
      this._visualOverrides.set(type, spec);
    }
  }

  update(delta) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const proj = this._active[i];
      proj.update(delta);
      if (!proj.active) {
        this._active.splice(i, 1);
        this._pool.push(proj);
      }
    }
  }

  get active() { return this._active; }

  clear() {
    this._active.forEach(p => p.deactivate());
    this._pool.push(...this._active);
    this._active.length = 0;
  }
}
