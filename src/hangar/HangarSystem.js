import itemsData from '../data/items.json';
import upgradesData from '../data/upgrades.json';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { createItemInstance } from '../core/GameState.js';
import {
  getAllShips, getShipDef, getActiveShipDef, getActiveShipSlots, getActiveShipSlotById,
  createLoadoutForShip, rebindShipAlias, applyShipBaseStatsToState,
} from '../data/ships.js';

// ─── Static catalog lookups ────────────────────────────────────────────────

const _itemsById = new Map(itemsData.items.map(i => [i.id, i]));
const _nodesById = new Map(upgradesData.nodes.map(n => [n.id, n]));

const _grantedByItems = new Set(itemsData.items.map(i => i.grantsNodeId).filter(Boolean));

// Forward adjacency: nodeId → [child nodeIds that list it in their prereqs]
const _forwardAdj = new Map();
for (const node of upgradesData.nodes) {
  for (const pid of node.prereqs || []) {
    if (!_forwardAdj.has(pid)) _forwardAdj.set(pid, []);
    _forwardAdj.get(pid).push(node.id);
  }
}

export function getAllItems() { return itemsData.items; }
/** All slot defs for the currently-active ship. */
export function getAllSlots(state) { return getActiveShipSlots(state); }
export function getItem(id) { return _itemsById.get(id) || null; }
/** Slot def (for the active ship). Returns null for unknown ids. */
export function getSlot(state, id) { return getActiveShipSlotById(state, id); }
export function getNodeTemplate(id) { return _nodesById.get(id) || null; }

/** True if this node's `id` is the grant node of some item. */
export function isItemGrantedNode(nodeId) { return _grantedByItems.has(nodeId); }

// ─── Slot helpers ──────────────────────────────────────────────────────────

/** Is a slot def currently unlocked (installable) for this ship? */
export function isSlotUnlocked(state, slotId) {
  const def = getActiveShipSlotById(state, slotId);
  if (!def) return false;
  if (def.unlockCondition === 'always') return true;
  const unlocked = state?.ship?.unlockedSlots || [];
  return unlocked.includes(slotId);
}

/** All slot defs that are currently unlocked (installable). */
export function listActiveSlots(state) {
  return getActiveShipSlots(state).filter(def => isSlotUnlocked(state, def.id));
}

/** Every slot def on the active ship, including locked ones (for hangar UI). */
export function listAllSlots(state) {
  return getActiveShipSlots(state);
}

/** Slots that exist on the active ship but are not yet unlocked. */
export function listLockedSlots(state) {
  return getActiveShipSlots(state).filter(def => !isSlotUnlocked(state, def.id));
}

/** Credit/other cost to unlock a given slot. Returns an empty object if free/always-on. */
export function getSlotUnlockCost(state, slotId) {
  const def = getActiveShipSlotById(state, slotId);
  return def?.unlockCost ? { ...def.unlockCost } : {};
}

/** Purchase a slot unlock. Returns true on success. Emits UPGRADE_PURCHASED. */
export function unlockSlot(state, currency, slotId) {
  const def = getActiveShipSlotById(state, slotId);
  if (!def) return false;
  if (isSlotUnlocked(state, slotId)) return false;
  const cost = def.unlockCost || {};
  if (Object.keys(cost).length && !currency.canAfford(cost)) return false;
  if (Object.keys(cost).length) currency.subtract(cost);
  state.ship.unlockedSlots ||= [];
  if (!state.ship.unlockedSlots.includes(slotId)) state.ship.unlockedSlots.push(slotId);
  if (!state.ship.slots[slotId]) state.ship.slots[slotId] = { installedInstanceId: null };
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { slotId, slotUnlock: true });
  return true;
}

// ─── Inventory / instance helpers ─────────────────────────────────────────

/** All item instances in the shared inventory. */
export function getInventoryInstances(state) {
  return state?.inventory?.ownedItems || [];
}

/** Lookup a specific instance by id. */
export function getInstance(state, instanceId) {
  return getInventoryInstances(state).find(i => i.instanceId === instanceId) || null;
}

/** Installed instance object for a slot (null if empty). */
export function getInstalledInstance(state, slotId) {
  const ship = state?.ship;
  if (!ship) return null;
  const entry = ship.slots[slotId];
  if (!entry?.installedInstanceId) return null;
  return getInstance(state, entry.installedInstanceId);
}

export function listInstalledItems(state) {
  const ship = state?.ship;
  if (!ship) return [];
  const items = [];
  for (const slot of listActiveSlots(state)) {
    const instance = getInstalledInstance(state, slot.id);
    if (instance) {
      const item = _itemsById.get(instance.itemId);
      if (item) items.push({ slot, item, instance });
    }
  }
  return items;
}

export function hasItemInstalled(state, itemId) {
  if (!state?.ship) return false;
  for (const slot of listActiveSlots(state)) {
    const inst = getInstalledInstance(state, slot.id);
    if (inst?.itemId === itemId) return true;
  }
  return false;
}

/**
 * Runtime map for combat visuals: which ship slot(s) each weapon fires from.
 * - `primary` is a single slotId string (nose-aligned main cannon / auto turret)
 *   used by `AutoFireWeaponComponent` and primary-muzzle visuals.
 * - `manualSlots` is an array of slotIds hosting a main cannon. `ManualGunComponent`
 *   spawns one projectile per slot, so installing a second main cannon on
 *   another hardpoint fires both on every trigger pull.
 * - Every other key (`laser`, `missile`, `plasma`, `beam`, …) is an array of
 *   slotIds — one entry per installed item whose grant node produces an
 *   `add_weapon` effect for that type. Installing two laser turrets yields
 *   `{ laser: ['weapon_port', 'weapon_starboard'] }` so each physical slot
 *   gets its own turret mesh and projectile spawn.
 */
export function getWeaponSlotAssignments(state) {
  const weaponSlotByFireType = { primary: 'weapon_mid', manualSlots: [] };
  if (!state?.ship) return weaponSlotByFireType;

  for (const { slot, item } of listInstalledItems(state)) {
    if (slot.type !== 'weapon') continue;

    // Track main-cannon slots independently of the grant-node lookup so the
    // manual fire pipeline works even when the cannon item's node is missing
    // from upgrades.json.
    if (item.id === 'main_cannon' || item.grantsNodeId === 'auto_turret') {
      if (!weaponSlotByFireType.manualSlots.includes(slot.id)) {
        weaponSlotByFireType.manualSlots.push(slot.id);
      }
    }

    const node = getNodeTemplate(item.grantsNodeId);
    if (!node) continue;

    for (const eff of node.effects || []) {
      if (eff.type === 'add_weapon' && eff.value) {
        const arr = weaponSlotByFireType[eff.value] || (weaponSlotByFireType[eff.value] = []);
        if (!arr.includes(slot.id)) arr.push(slot.id);
      }
    }
  }

  if (weaponSlotByFireType.manualSlots.length) {
    weaponSlotByFireType.primary = weaponSlotByFireType.manualSlots[0];
  }
  return weaponSlotByFireType;
}

/** Resolve a fire-type entry to a slotId list. Accepts legacy scalar values. */
export function getSlotsForFireType(slotMap, type) {
  if (!slotMap) return [];
  const v = slotMap[type];
  if (!v) return [];
  return Array.isArray(v) ? v.slice() : [v];
}

// ─── Actions ───────────────────────────────────────────────────────────────

/** Buy a catalog item. Creates a new instance — duplicates allowed. Returns true on success. */
export function buyItem(state, currency, itemId) {
  const item = _itemsById.get(itemId);
  if (!item) return false;
  const cost = item.cost || {};
  if (!currency.canAfford(cost)) return false;
  currency.subtract(cost);
  const inst = createItemInstance(itemId);
  state.inventory.ownedItems.push(inst);
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { itemId, instanceId: inst.instanceId });
  return true;
}

/** Install an instance into a slot. Pass `null` to uninstall. */
export function installItem(state, slotId, instanceId) {
  const slot = getActiveShipSlotById(state, slotId);
  if (!slot) return false;
  if (!state.ship.slots[slotId]) state.ship.slots[slotId] = { installedInstanceId: null };

  if (instanceId === null) {
    state.ship.slots[slotId].installedInstanceId = null;
    eventBus.emit(EVENTS.UPGRADE_PURCHASED, { slotId, instanceId: null });
    return true;
  }

  const inst = getInstance(state, instanceId);
  if (!inst) return false;
  const item = _itemsById.get(inst.itemId);
  if (!item) return false;
  if (item.slotType !== slot.type) return false;

  // Uninstall from any other slot first (one instance occupies one slot at a time).
  for (const [sid, entry] of Object.entries(state.ship.slots)) {
    if (sid !== slotId && entry?.installedInstanceId === instanceId) {
      entry.installedInstanceId = null;
    }
  }

  state.ship.slots[slotId].installedInstanceId = instanceId;
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { slotId, instanceId });
  return true;
}

// ─── Item upgrade system ───────────────────────────────────────────────────

/**
 * All upgrade nodes purchasable for a given item: forward BFS from
 * item.grantsNodeId through the prereq graph. The grant node itself is
 * excluded (auto-applied on install). Traversal stops at other items'
 * grant nodes.
 */
export function getUpgradesForItem(itemId) {
  const item = _itemsById.get(itemId);
  if (!item?.grantsNodeId) return [];

  const result = [];
  const visited = new Set([item.grantsNodeId]);
  const queue = [...(_forwardAdj.get(item.grantsNodeId) || [])];

  while (queue.length) {
    const nid = queue.shift();
    if (visited.has(nid)) continue;
    visited.add(nid);
    const node = _nodesById.get(nid);
    if (!node) continue;
    // Do not cross into another item's grant subtree.
    if (_grantedByItems.has(nid)) continue;
    result.push(node);
    for (const child of _forwardAdj.get(nid) || []) {
      if (!visited.has(child)) queue.push(child);
    }
  }
  return result;
}

export function getInstanceUpgradeLevel(state, instanceId, nodeId) {
  const inst = getInstance(state, instanceId);
  return inst?.upgrades?.[nodeId] ?? 0;
}

function _instancePrereqsMet(inst, item, node) {
  if (!node.prereqs?.length) return true;
  return node.prereqs.every(pid => {
    if (pid === item.grantsNodeId) return true;
    return (inst.upgrades?.[pid] ?? 0) >= 1;
  });
}

export function canPurchaseInstanceUpgrade(state, instanceId, nodeId) {
  const inst = getInstance(state, instanceId);
  if (!inst) return false;
  const item = _itemsById.get(inst.itemId);
  if (!item) return false;
  const node = _nodesById.get(nodeId);
  if (!node) return false;
  const level = getInstanceUpgradeLevel(state, instanceId, nodeId);
  if (level >= (node.maxLevel ?? 1)) return false;
  return _instancePrereqsMet(inst, item, node);
}

function _costForInstanceLevel(node, level) {
  const mult = Math.pow(1.4, level);
  const out = {};
  for (const [k, v] of Object.entries(node.baseCost || {})) {
    out[k] = Math.ceil(v * mult);
  }
  return out;
}

/** Buy one upgrade level on a specific item instance. Returns true on success. */
export function purchaseInstanceUpgrade(state, currency, instanceId, nodeId) {
  if (!canPurchaseInstanceUpgrade(state, instanceId, nodeId)) return false;
  const inst = getInstance(state, instanceId);
  const node = _nodesById.get(nodeId);
  const level = getInstanceUpgradeLevel(state, instanceId, nodeId);
  const cost = _costForInstanceLevel(node, level);
  if (!currency.canAfford(cost)) return false;
  currency.subtract(cost);
  if (!inst.upgrades) inst.upgrades = {};
  inst.upgrades[nodeId] = level + 1;
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { instanceId, nodeId, level: level + 1 });
  return true;
}

/** Sell one upgrade level back for a partial refund. Returns true on success. */
export function sellInstanceUpgrade(state, currency, instanceId, nodeId, refundRatio = 0.5) {
  const inst = getInstance(state, instanceId);
  if (!inst) return false;
  const node = _nodesById.get(nodeId);
  if (!node) return false;
  const level = getInstanceUpgradeLevel(state, instanceId, nodeId);
  if (level <= 0) return false;
  const paid = _costForInstanceLevel(node, level - 1);
  const refund = Object.fromEntries(
    Object.entries(paid)
      .map(([k, v]) => [k, Math.floor(v * refundRatio)])
      .filter(([, v]) => v > 0)
  );
  inst.upgrades[nodeId] = level - 1;
  if (inst.upgrades[nodeId] <= 0) delete inst.upgrades[nodeId];
  currency.addCosts(refund);
  eventBus.emit(EVENTS.UPGRADE_SOLD, { instanceId, nodeId, level: level - 1, refund });
  return true;
}

/**
 * Build the pseudo-unlocked node list for UpgradeApplier.
 * For each installed instance: grant node at level 1, plus all instance.upgrades.
 * Levels for the same nodeId are summed across all instances (multi-copy stacking).
 */
export function buildHangarUnlockedNodes(state) {
  if (!state?.ship) return [];
  const levelMap = new Map();

  for (const { item, instance } of listInstalledItems(state)) {
    if (item.grantsNodeId) {
      levelMap.set(item.grantsNodeId, (levelMap.get(item.grantsNodeId) || 0) + 1);
    }
    for (const [nodeId, level] of Object.entries(instance.upgrades || {})) {
      if (level > 0) levelMap.set(nodeId, (levelMap.get(nodeId) || 0) + level);
    }
  }

  const out = [];
  for (const [nodeId, level] of levelMap) {
    const node = _nodesById.get(nodeId);
    if (node && level > 0) out.push(_materializeNode(node, level));
  }
  return out;
}

// ─── Item Fusion ──────────────────────────────────────────────────────────

const _recipesById = new Map((itemsData.recipes || []).map(r => [r.id, r]));

/**
 * Returns all fusion recipes whose ingredients are all present in inventory
 * (installed or not). Does not check upgrade requirements.
 */
export function getAvailableRecipes(state) {
  const owned = getInventoryInstances(state);
  return (itemsData.recipes || []).filter(recipe => {
    return recipe.ingredients.every(ing => {
      const hasInInventory = owned.some(inst => inst.itemId === ing.itemId);
      if (!hasInInventory) return false;
      if (!ing.requiredUpgrades) return true;
      const inst = owned.find(i => i.itemId === ing.itemId);
      return Object.entries(ing.requiredUpgrades).every(
        ([nodeId, minLevel]) => (inst?.upgrades?.[nodeId] ?? 0) >= minLevel
      );
    });
  });
}

/**
 * Fuse items per a recipe. Validates all ingredients are owned, removes them
 * from inventory (uninstalling from any slot first), then creates the output
 * item instance. Returns true on success.
 */
export function fuseItems(state, currency, recipeId) {
  const recipe = _recipesById.get(recipeId);
  if (!recipe) return false;

  const owned = getInventoryInstances(state);

  // Collect one matching instance per ingredient (earliest match).
  const toConsume = [];
  for (const ing of recipe.ingredients) {
    const inst = owned.find(
      i => i.itemId === ing.itemId && !toConsume.includes(i)
    );
    if (!inst) return false;
    if (ing.requiredUpgrades) {
      const ok = Object.entries(ing.requiredUpgrades).every(
        ([nodeId, minLevel]) => (inst.upgrades?.[nodeId] ?? 0) >= minLevel
      );
      if (!ok) return false;
    }
    toConsume.push(inst);
  }

  // Optional additional cost.
  if (recipe.additionalCost && Object.keys(recipe.additionalCost).length) {
    if (!currency.canAfford(recipe.additionalCost)) return false;
    currency.subtract(recipe.additionalCost);
  }

  // Uninstall ingredients from any slot, then remove from inventory.
  for (const inst of toConsume) {
    for (const [slotId, entry] of Object.entries(state.ship.slots || {})) {
      if (entry?.installedInstanceId === inst.instanceId) {
        entry.installedInstanceId = null;
      }
    }
    const idx = state.inventory.ownedItems.indexOf(inst);
    if (idx !== -1) state.inventory.ownedItems.splice(idx, 1);
  }

  // Create output.
  const output = createItemInstance(recipe.outputItemId);
  state.inventory.ownedItems.push(output);
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { fused: true, recipeId, instanceId: output.instanceId });
  return true;
}

// ─── Ship roster ───────────────────────────────────────────────────────────

export function listShips() { return getAllShips(); }

export function listOwnedShipIds(state) {
  return state?.ships?.ownedIds || [];
}

export function isShipOwned(state, shipId) {
  return listOwnedShipIds(state).includes(shipId);
}

export function getActiveShip(state) { return getActiveShipDef(state); }

export function getShipUnlockCost(shipId) {
  const def = getShipDef(shipId);
  return def?.cost ? { ...def.cost } : {};
}

/** Purchase a locked ship with the roster-default loadout. Returns true on success. */
export function purchaseShip(state, currency, shipId) {
  const def = getShipDef(shipId);
  if (!def) return false;
  if (isShipOwned(state, shipId)) return false;
  const cost = def.cost || {};
  if (Object.keys(cost).length && !currency.canAfford(cost)) return false;
  if (Object.keys(cost).length) currency.subtract(cost);
  if (!state.ships) state.ships = { selectedId: shipId, ownedIds: [], loadouts: {} };
  if (!state.ships.ownedIds.includes(shipId)) state.ships.ownedIds.push(shipId);
  if (!state.ships.loadouts[shipId]) state.ships.loadouts[shipId] = createLoadoutForShip(def);
  eventBus.emit(EVENTS.SHIP_PURCHASED, { shipId });
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { shipId, shipPurchase: true });
  return true;
}

/**
 * Make `shipId` the active ship. Rebinds the `state.ship` alias, reseeds the
 * player's base stats from the ship profile, and emits SHIP_SELECTED so
 * listeners (main.js) can rebuild the player entity / visuals.
 */
export function selectShip(state, shipId) {
  if (!isShipOwned(state, shipId)) return false;
  if (state.ships.selectedId === shipId) return false;
  state.ships.selectedId = shipId;
  rebindShipAlias(state);
  applyShipBaseStatsToState(state, getShipDef(shipId));
  eventBus.emit(EVENTS.SHIP_SELECTED, { shipId });
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { shipId, shipSelect: true });
  return true;
}

function _materializeNode(nodeData, level, masteryLevel = 0) {
  return {
    id: nodeData.id,
    templateId: nodeData.id,
    tier: 0,
    category: nodeData.category,
    name: nodeData.name,
    description: nodeData.description,
    effects: nodeData.effects || [],
    triggers: nodeData.triggers || [],
    synergies: nodeData.synergies || [],
    visual: nodeData.visual || null,
    maxLevel: nodeData.maxLevel ?? 1,
    currentLevel: level,
    masteryLevel,
    isUnlocked: level > 0,
    isMaxed: level >= (nodeData.maxLevel ?? 1),
  };
}
