/**
 * The World owns all entities and drives per-frame updates.
 *
 * `ctx` is a shared object passed to every component onAttach/update call so
 * components can reach scene/audio/state without being handed a system
 * dependency graph.
 */
export class World {
  constructor(ctx = {}) {
    this.ctx = { ...ctx, world: this };
    this._entities = new Set();
    this._byTag = new Map();        // tag -> Set<Entity>
    this._byComponent = new Map();  // componentName -> Set<Entity>
    this._pendingDestroy = new Set();

    // Per-frame cached enemy list. Built lazily on the first call after
    // update() starts, reused by targeting + AoE components, and invalidated
    // at the start of every update() tick.
    this._frameEnemies = [];
    this._frameEnemiesDirty = true;
  }

  /**
   * Returns a shared array of currently active enemies for this frame. The
   * array is reused; do not mutate it. Consumers that need to store a
   * reference should copy.
   */
  getFrameEnemies() {
    if (!this._frameEnemiesDirty) return this._frameEnemies;
    const out = this._frameEnemies;
    out.length = 0;
    const pool = this._byTag.get('enemy');
    if (pool) {
      for (const e of pool) {
        if (e.active) out.push(e);
      }
    }
    this._frameEnemiesDirty = false;
    return out;
  }

  setContext(patch) {
    Object.assign(this.ctx, patch);
  }

  spawn(entity) {
    entity.world = this;
    this._entities.add(entity);
    for (const t of entity.tags) this._indexTag(entity, t);
    for (const c of entity.components.values()) {
      this._indexComponent(entity, c);
      c.world = this;
      c._attach();
    }
    this._frameEnemiesDirty = true;
    return entity;
  }

  destroyAll() {
    for (const e of this._entities) e.destroy();
    this._sweep();
  }

  /** @param {string} tag */
  query(tag) {
    return this._byTag.get(tag) || EMPTY_SET;
  }

  /** @param {Function|string} componentRef */
  queryByComponent(componentRef) {
    const name = typeof componentRef === 'string' ? componentRef : (componentRef.componentName || componentRef.name);
    return this._byComponent.get(name) || EMPTY_SET;
  }

  /** Entities within radius of a THREE.Vector3-like position. */
  queryNearby(position, radius, tag = null) {
    const out = [];
    const pool = tag ? this.query(tag) : this._entities;
    const r2 = radius * radius;
    for (const e of pool) {
      if (!e.active) continue;
      const t = e.get('TransformComponent');
      if (!t) continue;
      const dx = t.position.x - position.x;
      const dy = t.position.y - position.y;
      const dz = t.position.z - position.z;
      if (dx * dx + dy * dy + dz * dz <= r2) out.push(e);
    }
    return out;
  }

  update(dt) {
    this._frameEnemiesDirty = true;
    for (const e of this._entities) {
      if (e.active) e.update(dt, this.ctx);
    }
    this._sweep();
  }

  _sweep() {
    if (this._pendingDestroy.size === 0) return;
    for (const e of this._pendingDestroy) {
      for (const t of e.tags) this._unindexTag(e, t);
      for (const c of e.components.values()) this._unindexComponent(e, c);
      e._teardown();
      this._entities.delete(e);
      e.world = null;
    }
    this._pendingDestroy.clear();
    this._frameEnemiesDirty = true;
  }

  _markDestroyed(entity) {
    this._pendingDestroy.add(entity);
    this._frameEnemiesDirty = true;
  }

  _onEntityTagsChanged(entity) {
    this._frameEnemiesDirty = true;
    // Re-sync tag indices for this entity. Simple and robust.
    for (const [tag, set] of this._byTag) {
      if (entity.tags.has(tag)) set.add(entity);
      else set.delete(entity);
    }
    for (const t of entity.tags) this._indexTag(entity, t);
  }

  _onComponentAdded(entity, component) {
    this._indexComponent(entity, component);
  }

  _onComponentRemoved(entity, component) {
    this._unindexComponent(entity, component);
  }

  _indexTag(entity, tag) {
    let set = this._byTag.get(tag);
    if (!set) { set = new Set(); this._byTag.set(tag, set); }
    set.add(entity);
  }
  _unindexTag(entity, tag) {
    const set = this._byTag.get(tag);
    if (set) set.delete(entity);
  }
  _indexComponent(entity, component) {
    const name = component.constructor.componentName || component.constructor.name;
    let set = this._byComponent.get(name);
    if (!set) { set = new Set(); this._byComponent.set(name, set); }
    set.add(entity);
  }
  _unindexComponent(entity, component) {
    const name = component.constructor.componentName || component.constructor.name;
    const set = this._byComponent.get(name);
    if (set) set.delete(entity);
  }

  get entityCount() { return this._entities.size; }
  get entities() { return this._entities; }
}

const EMPTY_SET = new Set();
