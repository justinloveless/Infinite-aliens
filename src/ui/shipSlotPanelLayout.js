/**
 * Shared layout helper for hangar slot info-panels.
 *
 * Panel placement is fully data-driven off each slot's `panel` object:
 *
 *   { anchor, offsetX, offsetY }
 *
 * where `anchor` is one of:
 *
 *   top | top-left | top-right | left | right | bottom | bottom-left | bottom-right | center | free
 *
 * For preset anchors (everything except `free`) offsetX/offsetY are pixels
 * pulling the panel away from the anchored edge(s).
 *
 * For `anchor: 'free'` the offsets are interpreted as percent-of-stage (0..100)
 * with a translate(-50%, -50%) so the panel is centered on the given point.
 * This is the mode the Ship Slot Designer writes when the user drags a panel.
 *
 * Used by the live hangar UI and the standalone ship slot designer dev page.
 */
export const PANEL_ANCHORS = [
  'top',
  'top-left',
  'top-right',
  'left',
  'right',
  'bottom',
  'bottom-left',
  'bottom-right',
  'center',
  'free',
];

const DEFAULT_PANEL = { anchor: 'center', offsetX: 0, offsetY: 0 };

export function applySlotPanelLayout(panelEl, panelCfg) {
  if (!panelEl) return;
  const cfg = panelCfg && typeof panelCfg === 'object' ? panelCfg : DEFAULT_PANEL;
  const anchor = cfg.anchor || 'center';
  const ox = Number.isFinite(cfg.offsetX) ? cfg.offsetX : 0;
  const oy = Number.isFinite(cfg.offsetY) ? cfg.offsetY : 0;

  panelEl.style.left = '';
  panelEl.style.right = '';
  panelEl.style.top = '';
  panelEl.style.bottom = '';
  panelEl.style.transform = '';

  switch (anchor) {
    case 'top':
      panelEl.style.left = '50%';
      panelEl.style.top = `${oy}px`;
      panelEl.style.transform = `translateX(calc(-50% + ${ox}px))`;
      return;
    case 'bottom':
      panelEl.style.left = '50%';
      panelEl.style.bottom = `${oy}px`;
      panelEl.style.transform = `translateX(calc(-50% + ${ox}px))`;
      return;
    case 'left':
      panelEl.style.left = `${ox}px`;
      panelEl.style.top = '50%';
      panelEl.style.transform = `translateY(calc(-50% + ${oy}px))`;
      return;
    case 'right':
      panelEl.style.right = `${ox}px`;
      panelEl.style.top = '50%';
      panelEl.style.transform = `translateY(calc(-50% + ${oy}px))`;
      return;
    case 'top-left':
      panelEl.style.left = `${ox}px`;
      panelEl.style.top = `${oy}px`;
      return;
    case 'top-right':
      panelEl.style.right = `${ox}px`;
      panelEl.style.top = `${oy}px`;
      return;
    case 'bottom-left':
      panelEl.style.left = `${ox}px`;
      panelEl.style.bottom = `${oy}px`;
      return;
    case 'bottom-right':
      panelEl.style.right = `${ox}px`;
      panelEl.style.bottom = `${oy}px`;
      return;
    case 'free': {
      const clampedX = Math.max(0, Math.min(100, ox));
      const clampedY = Math.max(0, Math.min(100, oy));
      panelEl.style.left = `${clampedX}%`;
      panelEl.style.top = `${clampedY}%`;
      panelEl.style.transform = 'translate(-50%, -50%)';
      return;
    }
    case 'center':
    default:
      panelEl.style.left = '50%';
      panelEl.style.top = '50%';
      panelEl.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
  }
}

/**
 * Convert an {x, y} pixel point inside a stage rect to a `{ anchor: 'free', offsetX%, offsetY% }`
 * panel config. Used by the designer's drag-to-position interaction.
 */
export function pixelToFreePanel(stageRect, clientX, clientY) {
  const w = Math.max(1, stageRect.width);
  const h = Math.max(1, stageRect.height);
  const px = ((clientX - stageRect.left) / w) * 100;
  const py = ((clientY - stageRect.top) / h) * 100;
  return {
    anchor: 'free',
    offsetX: Math.max(0, Math.min(100, Math.round(px * 100) / 100)),
    offsetY: Math.max(0, Math.min(100, Math.round(py * 100) / 100)),
  };
}
