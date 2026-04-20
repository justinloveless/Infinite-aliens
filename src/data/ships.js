import {
  getAllShipDefs,
  getShipDef as _getShipDef,
  getDefaultShipId as _getDefaultShipId,
  getShipClass,
} from '../components/ships/ShipRegistry.js';

/**
 * Thin facade over the ECS ship registry. All ship data + behavior live on
 * the per-variant component classes in src/components/ships/*. These helpers
 * exist so legacy call sites (HangarSystem, SaveManager, HangarUI) can keep
 * consuming plain POJO descriptors without knowing about the component layer.
 *
 * When writing new code, prefer:
 *   - `getShipClass(id)` from ShipRegistry for static ops (mesh build, stats calc)
 *   - `createShipComponent(id)` for attaching to an entity
 *   - `entity.get('ShipComponent')` for reading the active ship's data at runtime
 */

export function getAllShips() { return getAllShipDefs(); }
export function getShipDef(id) { return _getShipDef(id); }
export function getDefaultShipId() { return _getDefaultShipId(); }

export function getActiveShipId(state) {
  return state?.ships?.selectedId || _getDefaultShipId();
}

export function getActiveShipDef(state) {
  return _getShipDef(getActiveShipId(state));
}

export function getActiveShipSlots(state) {
  return getActiveShipDef(state)?.slots || [];
}

export function getShipSlotById(shipDef, slotId) {
  return shipDef?.slots?.find(s => s.id === slotId) || null;
}

export function getActiveShipSlotById(state, slotId) {
  return getShipSlotById(getActiveShipDef(state), slotId);
}

/** Map a ship's BASE_* override map onto the state.player stat shape. */
export function getShipBasePlayerValues(shipDef) {
  const cls = getShipClass(shipDef?.id);
  if (cls) return cls.getBasePlayerValues();
  // Fallback: unknown id → starter ship values.
  const starter = getShipClass(_getDefaultShipId());
  return starter ? starter.getBasePlayerValues() : {};
}

/** Write a ship's base stats into state.player, refilling HP / shield. */
export function applyShipBaseStatsToState(state, shipDef) {
  if (!state?.player || !shipDef) return;
  const vals = getShipBasePlayerValues(shipDef);
  const p = state.player;
  p.maxHp = vals.maxHp;
  p.hp = vals.maxHp;
  p.damage = vals.damage;
  p.attackSpeed = vals.attackSpeed;
  p.projectileCount = vals.projectileCount;
  p.projectileSpeed = vals.projectileSpeed;
  p.critChance = vals.critChance;
  p.critMultiplier = vals.critMultiplier;
  p.maxShieldHp = vals.shield;
  p.shieldHp = Math.min(p.shieldHp ?? 0, vals.shield);
  p.shieldRegen = vals.shieldRegen;
  p.hpRegen = vals.hpRegen;
  p.armor = vals.armor;
  p.speed = vals.speed;
  p.magnetRange = vals.magnetRange;
  p.visionRange = vals.visionRange;
  p.targetingRange = vals.targetingRange;
  p.lootMultiplier = vals.lootMultiplier;
}

/** Build a fresh per-ship loadout using the ship's defaults. */
export function createLoadoutForShip(shipDef) {
  const cls = getShipClass(shipDef?.id);
  if (cls) return cls.createLoadout();
  return { slots: {}, unlockedSlots: [], research: {}, researchMastery: {} };
}

/**
 * (Re)bind the `state.ship` runtime alias to point at the currently-selected
 * loadout and share the global owned-items array. Call this after load and
 * after switching ships.
 */
export function rebindShipAlias(state) {
  if (!state) return;
  const selectedId = getActiveShipId(state);
  const loadout = state.ships?.loadouts?.[selectedId];
  if (!loadout) return;
  if (!state.inventory) state.inventory = { ownedItems: [] };
  if (!Array.isArray(state.inventory.ownedItems)) state.inventory.ownedItems = [];
  loadout.ownedItems = state.inventory.ownedItems;
  state.ship = loadout;
}
