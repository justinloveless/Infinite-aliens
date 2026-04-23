import { ItemMeshRegistry } from './ItemMeshRegistry.js';

ItemMeshRegistry.registerDefaults();

export { ItemMesh } from './ItemMesh.js';
export { AimingItemMesh } from './AimingItemMesh.js';
export { GenericItemMesh } from './GenericItemMesh.js';
export { ItemMeshRegistry } from './ItemMeshRegistry.js';

export function createItemMesh(item, slot, ctx) {
  return ItemMeshRegistry.create(item, slot, ctx);
}
