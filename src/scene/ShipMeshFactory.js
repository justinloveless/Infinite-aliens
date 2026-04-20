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

/**
 * Build a simple visible-marker mesh for an item installed in a slot.
 * Shape + color come from the item def; shape matches slot.shape.
 */
export function buildItemMarker(item, slot) {
  const color = parseColor(item?.color ?? 0xffffff);
  const group = new THREE.Group();
  const shape = slot?.shape || 'box';
  const size = slot?.size ?? 0.35;

  if (shape === 'box') {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.9, size * 0.9, size * 1.3),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.8,
        metalness: 0.4, roughness: 0.35,
      }),
    );
    group.add(mesh);
  } else {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.55, 16, 12),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.9,
        metalness: 0.3, roughness: 0.4,
      }),
    );
    group.add(mesh);
  }
  group.add(new THREE.PointLight(color, 0.6, 2.0));
  return group;
}

/** Wireframe indicator shown when a slot is empty or highlighted. */
export function buildSlotIndicator(slot, { color = 0x39ff14, opacity = 0.85 } = {}) {
  const group = new THREE.Group();
  const size = slot?.size ?? 0.35;
  const shape = slot?.shape || 'box';
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

function parseColor(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseInt(raw.replace('#', '0x'), 16);
  return 0xffffff;
}
