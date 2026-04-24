/**
 * Campaign counter-enemies: one per scanned item + ship clone for return journey.
 * `mothershipType` is the ENEMY_DEFS key used as arena boss for that galaxy.
 */

export const COUNTER_ENEMY_DEFS = {
  zigzagger: {
    itemId: 'main_cannon',
    label: 'Zigzagger',
    mothershipType: 'zigzagger_boss',
    description: 'Erratic lateral drift — hard for fixed-forward fire to track.',
  },
  mirror_drone: {
    itemId: 'laser_turret',
    label: 'Mirror Drone',
    mothershipType: 'mirror_drone_boss',
    description: 'Reflects most laser energy back as hostile bolts.',
  },
  flare_ship: {
    itemId: 'missile_turret',
    label: 'Flare Ship',
    mothershipType: 'flare_ship_boss',
    description: 'Launches flares that intercept incoming missiles.',
  },
  plasma_eater: {
    itemId: 'plasma_turret',
    label: 'Plasma Eater',
    mothershipType: 'plasma_eater_boss',
    description: 'Converts plasma hits into healing — glow intensifies when fed.',
  },
  prism_shard: {
    itemId: 'beam_laser',
    label: 'Prism Shard',
    mothershipType: 'prism_shard_boss',
    description: 'Splits sustained beams into harmful stray fragments.',
  },
  fortress: {
    itemId: 'rail_gun',
    label: 'Fortress',
    mothershipType: 'fortress_boss',
    description: 'Massive plating shrugs off burst rail impacts.',
  },
  titan: {
    itemId: 'hull_plating',
    label: 'Titan',
    mothershipType: 'titan_boss',
    description: 'Hull contacts ignore your armor mitigation entirely.',
  },
  corroder: {
    itemId: 'composite_armor',
    label: 'Corroder',
    mothershipType: 'corroder_boss',
    description: 'Stacks hull corrosion — each stack shaves effective armor.',
  },
  nullifier: {
    itemId: 'shield_generator',
    label: 'Nullifier',
    mothershipType: 'nullifier_boss',
    description: 'EMP bolts strip shields to zero on contact.',
  },
  scatter_drone: {
    itemId: 'magnet_coil',
    label: 'Scatter Drone',
    mothershipType: 'scatter_drone_boss',
    description: 'Inverted polarity field pushes loot away from your ship.',
  },
  anchor_mine: {
    itemId: 'thrusters',
    label: 'Anchor Mine',
    mothershipType: 'anchor_mine_boss',
    description: 'Deploys gravity anchors that carve slow zones.',
  },
  repair_jammer: {
    itemId: 'nanobots',
    label: 'Repair Jammer',
    mothershipType: 'repair_jammer_boss',
    description: 'Aura severely dampens passive hull regeneration.',
  },
  gravity_anchor: {
    itemId: 'repulser',
    label: 'Gravity Anchor',
    mothershipType: 'gravity_anchor_boss',
    description: 'Pulls you inward harder than your repulser pushes away.',
  },
  ghost_ship: {
    itemId: 'scanner',
    label: 'Ghost Ship',
    mothershipType: 'ghost_ship_boss',
    description: 'Nearly invisible — omitted from combat scanner lists.',
  },
  wreck_animator: {
    itemId: 'salvaging_beam',
    label: 'Wreck Animator',
    mothershipType: 'wreck_animator_boss',
    description: 'Reanimates fresh kills as short-lived hostiles.',
  },
  rock_slinger: {
    itemId: 'mining_laser',
    label: 'Rock Slinger',
    mothershipType: 'rock_slinger_boss',
    description: 'Lobs mineral debris; leaves no crystal drops when destroyed.',
  },
  power_siphon: {
    itemId: 'stellar_gen',
    label: 'Power Siphon',
    mothershipType: 'power_siphon_boss',
    description: 'Leeches passive Stellar Dust generation while alive.',
  },
  overloader: {
    itemId: 'reactor',
    label: 'Overloader',
    mothershipType: 'overloader_boss',
    description: 'Contact surge can briefly knock an auto-turret offline.',
  },
  eclipser: {
    itemId: 'solar_cells',
    label: 'Eclipser',
    mothershipType: 'eclipser_boss',
    description: 'Shadow umbra nullifies solar regen inside its radius.',
  },
  viral_agent: {
    itemId: 'bio_lab',
    label: 'Viral Agent',
    mothershipType: 'viral_agent_boss',
    description: 'Bio-agent inverts bio-lab income into ticking poison.',
  },
  crystal_leech: {
    itemId: 'plasma_farm',
    label: 'Crystal Leech',
    mothershipType: 'crystal_leech_boss',
    description: 'Contact siphons plasma crystals to fuel self-repair.',
  },
  dampener: {
    itemId: 'particle_collider',
    label: 'Dampener',
    mothershipType: 'dampener_boss',
    description: 'Projection field weakens all outgoing projectile damage.',
  },
  emp_reflector: {
    itemId: 'emp',
    label: 'EMP Reflector',
    mothershipType: 'emp_reflector_boss',
    description: 'Reflects your EMP into a weapon-bus reset pulse.',
  },
  warp_disruptor: {
    itemId: 'warp_drive',
    label: 'Warp Disruptor',
    mothershipType: 'warp_disruptor_boss',
    description: 'Proximity jam — warp drive refuses to fire while in range.',
  },
  dense_core: {
    itemId: 'gravity_bomb',
    label: 'Dense Core',
    mothershipType: 'dense_core_boss',
    description: 'Immune to gravity-well pulls; detonations enrage a short rush.',
  },
  target_analyzer: {
    itemId: 'decoy',
    label: 'Target Analyzer',
    mothershipType: 'target_analyzer_boss',
    description: 'Ignores holographic decoys — always homes on the real hull.',
  },
  speed_matcher: {
    itemId: 'speed_booster',
    label: 'Speed Matcher',
    mothershipType: 'speed_matcher_boss',
    description: 'Velocity locks to yours — cannot be outrun in a straight chase.',
  },
  ship_clone: {
    itemId: null,
    label: 'Ship Clone',
    mothershipType: 'ship_clone_boss',
    description: 'Alien copy of your vessel — floods space during the return run.',
  },
};

/** @type {Record<string, string | string[]>} */
export const ITEM_TO_COUNTER = {
  main_cannon: 'zigzagger',
  laser_turret: 'mirror_drone',
  missile_turret: 'flare_ship',
  plasma_turret: 'plasma_eater',
  beam_laser: 'prism_shard',
  rail_gun: 'fortress',
  hull_plating: 'titan',
  composite_armor: 'corroder',
  shield_generator: 'nullifier',
  magnet_coil: 'scatter_drone',
  thrusters: 'anchor_mine',
  nanobots: 'repair_jammer',
  repulser: 'gravity_anchor',
  scanner: 'ghost_ship',
  salvaging_beam: 'wreck_animator',
  mining_laser: 'rock_slinger',
  stellar_gen: 'power_siphon',
  reactor: 'overloader',
  solar_cells: 'eclipser',
  bio_lab: 'viral_agent',
  plasma_farm: 'crystal_leech',
  particle_collider: 'dampener',
  emp: 'emp_reflector',
  warp_drive: 'warp_disruptor',
  gravity_bomb: 'dense_core',
  decoy: 'target_analyzer',
  speed_booster: 'speed_matcher',
  // Fused: random pick at scan time
  wing_cannons: ['zigzagger', 'titan'],
  phoenix_drive: ['nullifier', 'titan'],
  juggernaut: ['titan', 'corroder'],
  gravity_well: ['nullifier', 'scatter_drone'],
  stellar_burst: ['power_siphon', 'plasma_eater'],
  nova_core: ['power_siphon', 'overloader'],
  drone: ['zigzagger', 'ghost_ship'],
};

/**
 * @param {{ id: string }} item - catalog item (Hangar `getItem`)
 * @returns {string | null}
 */
export function getCounterTypeForItem(item) {
  if (!item?.id) return null;
  const key = ITEM_TO_COUNTER[item.id];
  if (Array.isArray(key)) return key[Math.floor(Math.random() * key.length)];
  return key ?? null;
}
