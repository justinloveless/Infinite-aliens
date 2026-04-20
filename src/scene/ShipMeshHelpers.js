import * as THREE from 'three';

/**
 * In-hull point lights used by the combat ShipVisualsComponent to keep the
 * player ship readable against the dark skybox. Skipped for the hangar preview
 * which brings its own lighting.
 */
export function addHangarLights(group) {
  const keyLight = new THREE.PointLight(0xc8e0ff, 6, 14);
  keyLight.position.set(2, 5, 3);
  group.add(keyLight);
  const rimLight = new THREE.PointLight(0x4466aa, 2, 8);
  rimLight.position.set(-2, -2, 2);
  group.add(rimLight);
}
