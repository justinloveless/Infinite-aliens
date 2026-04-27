let _canvas = null, _x = 0, _y = 0;

function onMove(e) {
  if (!_canvas) return;
  const r = _canvas.getBoundingClientRect();
  _x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width  *  2 - 1));
  _y = Math.max(-1, Math.min(1, -((e.clientY - r.top)  / r.height * 2 - 1)));
}

export const MouseAimTracker = {
  get x() { return _x; },
  get y() { return _y; },
  init(canvas) {
    _canvas = canvas;
    window.addEventListener('pointermove', onMove);
  },
  dispose() {
    window.removeEventListener('pointermove', onMove);
    _canvas = null;
    _x = 0;
    _y = 0;
  },
};
