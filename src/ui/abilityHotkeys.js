/**
 * Active abilities use keys 1–4 in a fixed priority order (see main.js trigger).
 * Hangar labels and the HUD action bar must follow the same ordering.
 */

export const ABILITY_COMPONENT_NAMES = [
  'SpeedBoostComponent',
  'EmpAbilityComponent',
  'WarpDriveComponent',
  'GravityBombComponent',
  'DecoyAbilityComponent',
];

/** Parallel to ABILITY_COMPONENT_NAMES — catalog item ids for meshes / labels. */
export const ABILITY_ITEM_IDS = [
  'speed_booster',
  'emp',
  'warp_drive',
  'gravity_bomb',
  'decoy',
];

export const GRANTS_NODE_ID_TO_UNLOCK_STAT = {
  speed_booster: 'speedBoosterUnlocked',
  emp: 'empUnlocked',
  warp_drive: 'warpDriveUnlocked',
  gravity_bomb: 'gravityBombUnlocked',
  decoy: 'decoyUnlocked',
};

/**
 * @param {object} stats - `UpgradeApplier` preview / computed stats
 * @returns {string[]} unlock stat keys that are true, in hotkey order
 */
export function getOrderedEquippedAbilityUnlockStats(stats) {
  if (!stats) return [];
  const out = [];
  for (let i = 0; i < ABILITY_ITEM_IDS.length; i++) {
    const stat = GRANTS_NODE_ID_TO_UNLOCK_STAT[ABILITY_ITEM_IDS[i]];
    if (stat && stats[stat]) out.push(stat);
  }
  return out;
}

/**
 * @param {{ slotType?: string, grantsNodeId?: string }|null} item
 * @param {object} stats - preview or computed stats from UpgradeApplier
 * @returns {number|null} 1–4 or null
 */
export function getHotkeyDigitForAbilityItem(item, stats) {
  if (!item || item.slotType !== 'ability' || !item.grantsNodeId || !stats) return null;
  const stat = GRANTS_NODE_ID_TO_UNLOCK_STAT[item.grantsNodeId];
  if (!stat || !stats[stat]) return null;
  const equipped = getOrderedEquippedAbilityUnlockStats(stats);
  const idx = equipped.indexOf(stat);
  return idx >= 0 ? idx + 1 : null;
}

/** @param {object|null} playerEntity */
export function getActiveAbilityComponentsInHotkeyOrder(playerEntity) {
  if (!playerEntity) return [];
  const out = [];
  for (const name of ABILITY_COMPONENT_NAMES) {
    const c = playerEntity.get(name);
    if (c) out.push(c);
  }
  return out;
}
