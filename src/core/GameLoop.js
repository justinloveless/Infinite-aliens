// requestAnimationFrame game loop
export class GameLoop {
  constructor() {
    this._running = false;
    this._lastTime = 0;
    this._callbacks = [];
    this._rafId = null;
  }

  onUpdate(fn) {
    this._callbacks.push(fn);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._tick(this._lastTime);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _tick(timestamp) {
    if (!this._running) return;
    const delta = Math.min((timestamp - this._lastTime) / 1000, 0.1); // cap at 100ms
    this._lastTime = timestamp;
    this._callbacks.forEach(fn => fn(delta));
    this._rafId = requestAnimationFrame(ts => this._tick(ts));
  }
}
