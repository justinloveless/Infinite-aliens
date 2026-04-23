import * as THREE from 'three';
import { getShipClass, getDefaultShipId } from '../components/ships/ShipRegistry.js';

/**
 * Build a standalone Three.js group for a ship hull.
 *
 * `variant` is a ship id registered in ShipRegistry ('allrounder', 'heavy',
 * 'fighter', …). The actual hull geometry lives on the corresponding
 * ShipComponent subclass (e.g. AllrounderShipComponent.buildHull), so this
 * function is a thin dispatcher that keeps non-ECS callers (the hangar
 * preview, legacy code) insulated from the component registry.
 *
 * `withLights` toggles in-hull point lights (skipped for the hangar preview
 * which brings its own lighting).
 *
 * Every variant writes the primary meshes onto `group.userData` under the
 * keys `hull`, `wingL`, `wingR`, `engine`, `cockpit`. ShipVisualsComponent +
 * the visual-modifier system rely on these names.
 */
export function buildShipHull({ variant = 'allrounder', withLights = false } = {}) {
  const Cls = getShipClass(variant) || getShipClass(getDefaultShipId());
  return Cls.buildHull({ withLights });
}

/** Wireframe indicator shown when a slot is empty or highlighted. */
export function buildSlotIndicator(slot, { color = 0x39ff14, opacity = 0.85 } = {}) {
  const group = new THREE.Group();
  const size = slot?.size ?? 0.35;
  const shape = getWireframeShapeForSlot(slot);
  const material = new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
    depthTest: false,
  });

  if (shape === 'box') {
    const geo = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(geo);
    geo.dispose();
    group.add(new THREE.LineSegments(edges, material));
  } else {
    const segments = 32;
    const r = size * 0.5;
    const ringGeo1 = new THREE.BufferGeometry();
    const ringGeo2 = new THREE.BufferGeometry();
    const ringGeo3 = new THREE.BufferGeometry();
    const pts1 = [], pts2 = [], pts3 = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts1.push(Math.cos(t) * r, Math.sin(t) * r, 0);
      pts2.push(Math.cos(t) * r, 0, Math.sin(t) * r);
      pts3.push(0, Math.cos(t) * r, Math.sin(t) * r);
    }
    ringGeo1.setAttribute('position', new THREE.Float32BufferAttribute(pts1, 3));
    ringGeo2.setAttribute('position', new THREE.Float32BufferAttribute(pts2, 3));
    ringGeo3.setAttribute('position', new THREE.Float32BufferAttribute(pts3, 3));
    group.add(new THREE.Line(ringGeo1, material));
    group.add(new THREE.Line(ringGeo2, material));
    group.add(new THREE.Line(ringGeo3, material));
  }
  group.renderOrder = 10;
  return group;
}

function getWireframeShapeForSlot(slot) {
  if (slot?.type === 'weapon') return 'box';
  if (slot?.type === 'defense' || slot?.type === 'utility') return 'circle';
  return slot?.shape || 'box';
}

function parseColor(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseInt(raw.replace('#', '0x'), 16);
  return 0xffffff;
}
