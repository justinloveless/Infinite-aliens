export class World {
  constructor() {
    this._nextId = 1;
    this._store = new Map(); // entityId → { compName → data }
  }

  createEntity() {
    this._store.set(this._nextId, {});
    return this._nextId++;
  }

  addComponent(id, name, data = {}) {
    this._store.get(id)[name] = data;
    return this;
  }

  removeComponent(id, name) {
    const comps = this._store.get(id);
    if (comps) delete comps[name];
  }

  getComponent(id, name) {
    return this._store.get(id)?.[name];
  }

  hasComponent(id, name) {
    return name in (this._store.get(id) ?? {});
  }

  destroyEntity(id) {
    this._store.delete(id);
  }
}
