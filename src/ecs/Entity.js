let _idCounter = 0;

/**
 * Entity is a thin bag of components + tags.
 * All data and behavior lives inside the components it hosts.
 * The World holds entities and drives their update loop.
 */
export class Entity {
  constructor(tags = []) {
    this.id = `e_${++_idCounter}`;
    this.active = true;
    this.tags = new Set(tags);
    this.components = new Map(); // name -> Component
    this.world = null;
    this._destroyed = false;
  }

  hasTag(tag) { return this.tags.has(tag); }
  addTag(tag) { this.tags.add(tag); if (this.world) this.world._onEntityTagsChanged(this); }
  removeTag(tag) { this.tags.delete(tag); if (this.world) this.world._onEntityTagsChanged(this); }

  add(component) {
    if (!component) return null;
    const name = component.constructor.componentName || component.constructor.name;
    const existing = this.components.get(name);
    if (existing) {
      existing._detach();
    }
    component.entity = this;
    component.world = this.world;
    this.components.set(name, component);
    if (this.world) {
      this.world._onComponentAdded(this, component);
      component._attach();
    }
    return component;
  }

  /** @param {string | Function} ref - component class or its static componentName string */
  remove(ref) {
    const name = typeof ref === 'string' ? ref : (ref.componentName || ref.name);
    const c = this.components.get(name);
    if (!c) return false;
    c._detach();
    this.components.delete(name);
    if (this.world) this.world._onComponentRemoved(this, c);
    return true;
  }

  get(ref) {
    const name = typeof ref === 'string' ? ref : (ref.componentName || ref.name);
    return this.components.get(name) || null;
  }

  has(ref) {
    const name = typeof ref === 'string' ? ref : (ref.componentName || ref.name);
    return this.components.has(name);
  }

  /** Run per-frame update hooks on every component with one. */
  update(dt, ctx) {
    if (!this.active) return;
    for (const c of this.components.values()) {
      if (typeof c.update === 'function') c.update(dt, ctx);
    }
  }

  /** Marks for destruction; World sweeps it next tick. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.active = false;
    if (this.world) this.world._markDestroyed(this);
  }

  /** Called by World during destroy sweep — detaches all components. */
  _teardown() {
    for (const c of this.components.values()) {
      c._detach();
    }
    this.components.clear();
  }
}
