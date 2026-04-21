import itemsData from './items.json';

// Maps from item id -> its grantsNodeId (so research can resolve gating by category).
const _itemByNode = new Map();
for (const it of itemsData.items) {
  if (it.grantsNodeId) _itemByNode.set(it.grantsNodeId, it.id);
}

/**
 * Returns the item id required to keep a research node's effects active,
 * or null if the node is always-on (generic ship-wide upgrade).
 *
 * MVP heuristic:
 *  - Nodes whose effects push `add_weapon: X` require the item that grants
 *    the matching starter node.
 *  - Nodes whose IDs start with a known item-specific prefix require that item.
 *  - Nodes whose stat mentions a subsystem only meaningful with that item
 *    installed (shield*, manualGun*, railgun*, stellarNova*, etc.) require
 *    the corresponding item (if one exists in items.json).
 *  - Everything else is unrestricted (HP, speed, magnet, damage, crit, …).
 *
 * `itemIds` (optional) is the set of item ids currently in the catalog; we
 * only return a gate pointing at an item that actually exists.
 */
export function getRequiredItemForNode(node, itemIds = null) {
  if (!node) return null;
  const id = node.id;

  // Explicit override on the node
  if (node.requiresItem) return node.requiresItem;

  // The item's "grants" node never gates itself.
  if (_itemByNode.has(id)) return null;

  // Explicit ID-prefix map
  const prefixMap = [
    { prefix: 'cannon_', item: 'main_cannon' },
    { prefix: 'laser_', item: 'laser_turret' },
    { prefix: 'missile_', item: 'missile_turret' },
    { prefix: 'plasma_', item: 'plasma_turret' },
    { prefix: 'beam_', item: 'beam_laser' },
    { prefix: 'shield_', item: 'shield_generator' },
    { prefix: 'armor_', item: 'composite_armor' },
    { prefix: 'hull_', item: 'hull_plating' },
    { prefix: 'magnet_', item: 'magnet_coil' },
    { prefix: 'thruster_', item: 'thrusters' },
    { prefix: 'nanobot_', item: 'nanobots' },
  ];
  for (const { prefix, item } of prefixMap) {
    if (id.startsWith(prefix) && (!itemIds || itemIds.has(item))) return item;
  }

  // Weapon-type inference: if this node adds a specific extra weapon.
  for (const eff of node.effects || []) {
    if (eff.type === 'add_weapon') {
      const map = {
        laser: 'laser_turret', missile: 'missile_turret',
        plasma: 'plasma_turret', beam: 'beam_laser',
      };
      const item = map[eff.value];
      if (item && (!itemIds || itemIds.has(item))) return item;
    }
  }

  return null;
}
