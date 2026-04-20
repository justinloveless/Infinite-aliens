import itemsData from '../data/items.json';
import upgradesData from '../data/upgrades.json';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { getRequiredItemForNode } from '../data/researchGating.js';
import {
  getAllShips, getShipDef, getActiveShipDef, getActiveShipSlots, getActiveShipSlotById,
  createLoadoutForShip, rebindShipAlias, applyShipBaseStatsToState,
} from '../data/ships.js';

// ─── Static catalog lookups ────────────────────────────────────────────────

const _itemsById = new Map(itemsData.items.map(i => [i.id, i]));
const _nodesById = new Map(upgradesData.nodes.map(n => [n.id, n]));

const _itemIdSet = new Set(itemsData.items.map(i => i.id));
const _grantedByItems = new Set(itemsData.items.map(i => i.grantsNodeId));

export function getAllItems() { return itemsData.items; }
/** All slot defs for the currently-active ship. */
export function getAllSlots(state) { return getActiveShipSlots(state); }
export function getItem(id) { return _itemsById.get(id) || null; }
/** Slot def (for the active ship). Returns null for unknown ids. */
export function getSlot(state, id) { return getActiveShipSlotById(state, id); }
export function getNodeTemplate(id) { return _nodesById.get(id) || null; }

/** True if this node's `id` is granted by an item (i.e. belongs in the Store, not the Research Lab). */
export function isItemGrantedNode(nodeId) { return _grantedByItems.has(nodeId); }

// ─── Slot / inventory helpers ──────────────────────────────────────────────

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
  if (!state.ship.slots[slotId]) state.ship.slots[slotId] = { installedItemId: null };
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { slotId, slotUnlock: true });
  return true;
}

export function listInstalledItems(state) {
  const ship = state?.ship;
  if (!ship) return [];
  const items = [];
  for (const slot of listActiveSlots(state)) {
    const entry = ship.slots[slot.id];
    if (entry?.installedItemId) {
      const item = _itemsById.get(entry.installedItemId);
      if (item) items.push({ slot, item });
    }
  }
  return items;
}

/**
 * Runtime map for combat visuals: which ship slot each weapon fires from.
 * Keys: `primary` (auto / nose-aligned), plus any `add_weapon` values (`laser`,
 * `missile`, `plasma`, `beam`) from the item installed in that weapon slot.
 */
export function getWeaponSlotAssignments(state) {
  const weaponSlotByFireType = { primary: 'weapon_mid' };
  if (!state?.ship) return weaponSlotByFireType;

  for (const { slot, item } of listInstalledItems(state)) {
    if (slot.type !== 'weapon') continue;
    const node = getNodeTemplate(item.grantsNodeId);
    if (!node) continue;

    if (item.grantsNodeId === 'auto_turret' || item.id === 'main_cannon') {
      weaponSlotByFireType.primary = slot.id;
    }
    for (const eff of node.effects || []) {
      if (eff.type === 'add_weapon' && eff.value) {
        weaponSlotByFireType[eff.value] = slot.id;
      }
    }
  }
  return weaponSlotByFireType;
}

export function hasItemInstalled(state, itemId) {
  const ship = state?.ship;
  if (!ship) return false;
  for (const slot of listActiveSlots(state)) {
    if (ship.slots[slot.id]?.installedItemId === itemId) return true;
  }
  return false;
}

// ─── Actions ───────────────────────────────────────────────────────────────

/** Buy a catalog item. Returns true on success. Emits UPGRADE_PURCHASED. */
export function buyItem(state, currency, itemId) {
  const item = _itemsById.get(itemId);
  if (!item) return false;
  if (state.ship.ownedItems.includes(itemId)) return false;
  const cost = item.cost || {};
  if (!currency.canAfford(cost)) return false;
  currency.subtract(cost);
  state.ship.ownedItems.push(itemId);
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { itemId });
  return true;
}

/** Install an owned item into a slot. Pass `null` to uninstall. */
export function installItem(state, slotId, itemId) {
  const slot = getActiveShipSlotById(state, slotId);
  if (!slot) return false;
  if (!state.ship.slots[slotId]) state.ship.slots[slotId] = { installedItemId: null };

  if (itemId === null) {
    state.ship.slots[slotId].installedItemId = null;
    eventBus.emit(EVENTS.UPGRADE_PURCHASED, { slotId, itemId: null });
    return true;
  }

  const item = _itemsById.get(itemId);
  if (!item) return false;
  if (item.slotType !== slot.type) return false;
  if (!state.ship.ownedItems.includes(itemId)) return false;

  // Uninstall this item from any other slot first (unique placement).
  for (const [sid, entry] of Object.entries(state.ship.slots)) {
    if (sid !== slotId && entry.installedItemId === itemId) entry.installedItemId = null;
  }

  state.ship.slots[slotId].installedItemId = itemId;
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { slotId, itemId });
  return true;
}

// ─── Research ──────────────────────────────────────────────────────────────

/** All nodes eligible for the flat research lab (excludes item-grant nodes). */
export function getResearchCatalog() {
  return upgradesData.nodes.filter(n => !_grantedByItems.has(n.id));
}

export function getResearchLevel(state, nodeId) {
  return state?.ship?.research?.[nodeId] ?? 0;
}

function _costForResearchLevel(node, level) {
  const mult = Math.pow(1.4, level);
  const out = {};
  for (const [k, v] of Object.entries(node.baseCost || {})) {
    out[k] = Math.ceil(v * mult);
  }
  return out;
}

export function canPurchaseResearch(state, nodeId) {
  const node = _nodesById.get(nodeId);
  if (!node) return false;
  const level = getResearchLevel(state, nodeId);
  if (level >= (node.maxLevel ?? 1)) return false;
  if (!_prereqsMet(state, node)) return false;
  return true;
}

// ─── Research Mastery ──────────────────────────────────────────────────────

export function getResearchMasteryLevel(state, nodeId) {
  return state?.ship?.researchMastery?.[nodeId] ?? 0;
}

export function getResearchMasteryCost(node, masteryLevel) {
  const maxLevel = node.maxLevel ?? 1;
  const baseMult = Math.pow(1.4, maxLevel - 1); // cost of the last regular level
  const masteryMult = Math.pow(2.5, masteryLevel);
  const out = {};
  for (const [k, v] of Object.entries(node.baseCost || {})) {
    out[k] = Math.ceil(v * baseMult * masteryMult);
  }
  return out;
}

export function purchaseResearchMastery(state, currency, nodeId) {
  const node = _nodesById.get(nodeId);
  if (!node) return false;
  const level = getResearchLevel(state, nodeId);
  if (level < (node.maxLevel ?? 1)) return false; // must be maxed first
  const masteryLevel = getResearchMasteryLevel(state, nodeId);
  const cost = getResearchMasteryCost(node, masteryLevel);
  if (!currency.canAfford(cost)) return false;
  currency.subtract(cost);
  if (!state.ship.researchMastery) state.ship.researchMastery = {};
  state.ship.researchMastery[nodeId] = masteryLevel + 1;
  eventBus.emit(EVENTS.MASTERY_PURCHASED, { nodeId, masteryLevel: masteryLevel + 1, source: 'research' });
  return true;
}

/** Buy one level of a research node. */
export function purchaseResearch(state, currency, nodeId) {
  const node = _nodesById.get(nodeId);
  if (!node) return false;
  const level = getResearchLevel(state, nodeId);
  if (level >= (node.maxLevel ?? 1)) return false;
  if (!_prereqsMet(state, node)) return false;
  const cost = _costForResearchLevel(node, level);
  if (!currency.canAfford(cost)) return false;
  currency.subtract(cost);
  state.ship.research[nodeId] = level + 1;
  eventBus.emit(EVENTS.UPGRADE_PURCHASED, { nodeId, level: level + 1, research: true });
  return true;
}

/** Sell one level back for a partial refund. */
export function sellResearchLevel(state, currency, nodeId, refundRatio = 0.5) {
  const node = _nodesById.get(nodeId);
  if (!node) return false;
  const level = getResearchLevel(state, nodeId);
  if (level <= 0) return false;
  const paid = _costForResearchLevel(node, level - 1);
  const refund = Object.fromEntries(
    Object.entries(paid)
      .map(([k, v]) => [k, Math.floor(v * refundRatio)])
      .filter(([, v]) => v > 0)
  );
  state.ship.research[nodeId] = level - 1;
  if (state.ship.research[nodeId] <= 0) delete state.ship.research[nodeId];
  currency.addCosts(refund);
  eventBus.emit(EVENTS.UPGRADE_SOLD, { nodeId, level: level - 1, refund, research: true });
  return true;
}

function _prereqsMet(state, node) {
  if (!node.prereqs?.length) return true;
  return node.prereqs.every(pid => {
    if (getResearchLevel(state, pid) > 0) return true;
    // Counts as met if a currently-installed item grants this prereq.
    for (const { item } of listInstalledItems(state)) {
      if (item.grantsNodeId === pid) return true;
    }
    return false;
  });
}

export function getRequiredItem(node) {
  return getRequiredItemForNode(node, _itemIdSet);
}

/**
 * Build the pseudo-unlocked node list for UpgradeApplier.
 * Returns TechNode-shaped plain objects with `currentLevel` set appropriately.
 * Nodes whose required item is missing are omitted (effects don't apply).
 */
export function buildHangarUnlockedNodes(state) {
  if (!state?.ship) return [];
  const out = [];
  const seen = new Set();

  // Installed items → their grant nodes at level 1
  for (const { item } of listInstalledItems(state)) {
    const node = _nodesById.get(item.grantsNodeId);
    if (node && !seen.has(node.id)) {
      out.push(_materializeNode(node, 1));
      seen.add(node.id);
    }
  }

  // Research purchases → gated by installed items
  for (const [nodeId, level] of Object.entries(state.ship.research || {})) {
    if (seen.has(nodeId)) continue;
    const node = _nodesById.get(nodeId);
    if (!node || level <= 0) continue;
    const requiredItem = getRequiredItem(node);
    if (requiredItem && !hasItemInstalled(state, requiredItem)) continue;
    const masteryLevel = getResearchMasteryLevel(state, nodeId);
    out.push(_materializeNode(node, level, masteryLevel));
    seen.add(nodeId);
  }

  return out;
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
