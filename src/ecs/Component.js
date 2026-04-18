import { eventBus } from '../core/EventBus.js';

/**
 * Base class for all components.
 *
 * Components own their own data, behavior, meshes, and event subscriptions.
 * Lifecycle hooks (all optional):
 *   onAttach(ctx)  — attached to an entity inside a world. Build meshes, listen to events.
 *   onDetach()     — removed or entity destroyed. Clean up everything from onAttach.
 *   update(dt,ctx) — per-frame tick.
 *
 * Use `this.listen(event, handler)` in onAttach so the subscription is torn down
 * automatically on detach.
 */
export class Component {
  constructor() {
    /** @type {import('./Entity.js').Entity | null} */
    this.entity = null;
    /** @type {import('./World.js').World | null} */
    this.world = null;
    this._unsubs = [];
    this._attached = false;
  }

  static get componentName() {
    return this.name;
  }

  /** Subscribe to the global event bus — auto unsubscribed on detach. */
  listen(eventKey, handler) {
    const unsub = eventBus.on(eventKey, handler);
    this._unsubs.push(unsub);
    return unsub;
  }

  onAttach(_ctx) {}
  onDetach() {}

  _attach() {
    if (this._attached) return;
    this._attached = true;
    this.onAttach(this.world?.ctx);
  }

  _detach() {
    if (!this._attached) return;
    this._attached = false;
    for (const u of this._unsubs) {
      try { u(); } catch (_) { /* noop */ }
    }
    this._unsubs.length = 0;
    try { this.onDetach(); } catch (e) { console.warn('Component onDetach error', e); }
    this.entity = null;
    this.world = null;
  }
}
