// Node template pool organized by category
// Each template: { name, description, icon, maxLevel, effects[], baseCost{}, category }

// Starter nodes: one per non-special category. These sit at the 4 cardinal
// positions of ring 0 and are free to pick — they let the player choose which
// direction to branch into first.
export const STARTER_NODES = {
  weapon: {
    id: 'starter_weapon',
    name: 'Combat Training',
    description: 'Basic military doctrine sharpens your weapon systems.',
    icon: '⚔',
    maxLevel: 1,
    effects: [{ type: 'multiply', stat: 'damage', value: 1.1, statLabel: 'Damage' }],
    baseCost: {},
  },
  defense: {
    id: 'starter_defense',
    name: 'Reinforced Frame',
    description: 'A sturdier chassis gives your hull extra structural integrity.',
    icon: '🛡',
    maxLevel: 1,
    effects: [{ type: 'add', stat: 'maxHp', value: 20, statLabel: 'Max Hull' }],
    baseCost: {},
  },
  utility: {
    id: 'starter_utility',
    name: 'Field Engineer',
    description: 'Practical engineering extends the reach of your loot tether.',
    icon: '⊕',
    maxLevel: 1,
    effects: [{ type: 'add', stat: 'magnetRange', value: 2, statLabel: 'Magnet Range' }],
    baseCost: {},
  },
  passive: {
    id: 'starter_passive',
    name: 'Cosmic Attunement',
    description: 'Attune your sensors to begin passively collecting Stellar Dust.',
    icon: '✦',
    maxLevel: 1,
    effects: [{ type: 'add', stat: 'stellarDustRate', value: 0.1, statLabel: 'Stellar/sec' }],
    baseCost: {},
  },
};

export const NODE_TEMPLATES = {
  weapon: [
    {
      id: 'kinetic_damage',
      name: 'Kinetic Mass Drivers',
      description: 'Solid slug throwers boost impact damage. Paid in scrap only.',
      icon: '⬡',
      maxLevel: 10,
      effects: [{ type: 'multiply', stat: 'damage', value: 1.09, statLabel: 'Damage' }],
      baseCost: { scrapMetal: 11 },
    },
    {
      id: 'damage_up',
      name: 'Plasma Cannons',
      description: 'Reinforced energy weapons deal more damage per shot.',
      icon: '⚡',
      maxLevel: 10,
      effects: [{ type: 'multiply', stat: 'damage', value: 1.12, statLabel: 'Damage' }],
      baseCost: { plasmaCrystals: 8 },
    },
    {
      id: 'attack_speed',
      name: 'Fire Control',
      description: 'Servo-linked triggers and belts increase fire rate.',
      icon: '🎯',
      maxLevel: 8,
      effects: [{ type: 'multiply', stat: 'attackSpeed', value: 1.1, statLabel: 'Fire Rate' }],
      baseCost: { scrapMetal: 14 },
    },
    {
      id: 'multi_shot',
      name: 'Multi-Barrel',
      description: 'Fire one additional projectile per shot.',
      icon: '↑↑',
      maxLevel: 4,
      effects: [{ type: 'add', stat: 'projectileCount', value: 1, statLabel: 'Projectiles' }],
      baseCost: { plasmaCrystals: 20, scrapMetal: 15 },
    },
    {
      id: 'crit_chance',
      name: 'Targeting Matrix',
      description: 'Precision optics increase critical hit chance.',
      icon: '◎',
      maxLevel: 6,
      effects: [{ type: 'add', stat: 'critChance', value: 0.06, statLabel: 'Crit Chance' }],
      baseCost: { plasmaCrystals: 12, bioEssence: 6 },
    },
    {
      id: 'crit_damage',
      name: 'Overclocked Cells',
      description: 'Critical hits deal significantly more damage.',
      icon: '💥',
      maxLevel: 5,
      effects: [{ type: 'multiply', stat: 'critMultiplier', value: 1.2, statLabel: 'Crit Damage' }],
      baseCost: { scrapMetal: 20 },
    },
    {
      id: 'laser_type',
      name: 'Plasma Beam',
      description: 'Switches weapons to fast-moving plasma beams.',
      icon: '━',
      maxLevel: 1,
      effects: [{ type: 'set', stat: 'projectileType', value: 'laser', statLabel: 'Plasma Beam' }],
      baseCost: { scrapMetal: 8 },
    },
    {
      id: 'missile_type',
      name: 'Homing Missiles',
      description: 'Slower but homing missiles track their targets.',
      icon: '🚀',
      maxLevel: 1,
      effects: [{ type: 'set', stat: 'projectileType', value: 'missile', statLabel: 'Homing Missiles' }],
      baseCost: { scrapMetal: 25, plasmaCrystals: 10 },
    },
    {
      id: 'plasma_type',
      name: 'Dark Plasma',
      description: 'Volatile plasma orbs deal massive damage.',
      icon: '◉',
      maxLevel: 1,
      effects: [{ type: 'set', stat: 'projectileType', value: 'plasma', statLabel: 'Dark Plasma' }],
      baseCost: { darkMatter: 2, plasmaCrystals: 20 },
    },
    {
      id: 'proj_speed',
      name: 'Accelerator Coils',
      description: 'Electromagnetic coils increase projectile velocity.',
      icon: '⇒',
      maxLevel: 5,
      effects: [{ type: 'multiply', stat: 'projectileSpeed', value: 1.15, statLabel: 'Projectile Speed' }],
      baseCost: { scrapMetal: 15 },
    },
  ],

  defense: [
    {
      id: 'hull_plating',
      name: 'Hull Plating',
      description: 'Reinforced hull plating increases maximum hull integrity.',
      icon: '🛡',
      maxLevel: 10,
      effects: [{ type: 'add', stat: 'maxHp', value: 25, statLabel: 'Max Hull' }],
      baseCost: { scrapMetal: 10 },
    },
    {
      id: 'shield_gen',
      name: 'Shield Generator',
      description: 'Electromagnetic shields absorb incoming damage.',
      icon: '◯',
      maxLevel: 6,
      effects: [{ type: 'add', stat: 'maxShieldHp', value: 30, statLabel: 'Shield HP' }],
      baseCost: { plasmaCrystals: 18, scrapMetal: 8 },
    },
    {
      id: 'shield_regen',
      name: 'Shield Capacitors',
      description: 'Improved capacitors regenerate shields over time.',
      icon: '↺',
      maxLevel: 5,
      effects: [{ type: 'add', stat: 'shieldRegen', value: 2, statLabel: 'Shield/sec' }],
      baseCost: { plasmaCrystals: 15, scrapMetal: 10 },
    },
    {
      id: 'armor',
      name: 'Composite Armor',
      description: 'Dense alloy layers reduce all incoming damage.',
      icon: '▦',
      maxLevel: 8,
      effects: [{ type: 'add', stat: 'armor', value: 3, statLabel: 'Armor' }],
      baseCost: { scrapMetal: 15 },
    },
    {
      id: 'hp_regen',
      name: 'Nanobots',
      description: 'Self-replicating nanobots slowly repair hull damage.',
      icon: '⬡',
      maxLevel: 5,
      effects: [{ type: 'add', stat: 'hpRegen', value: 1, statLabel: 'HP/sec' }],
      baseCost: { bioEssence: 12, scrapMetal: 8 },
    },
  ],

  utility: [
    {
      id: 'salvage_winch',
      name: 'Salvage Winch',
      description: 'Mechanical tow lines pull in debris from farther away.',
      icon: '⊗',
      maxLevel: 6,
      effects: [{ type: 'add', stat: 'magnetRange', value: 1.8, statLabel: 'Magnet Range' }],
      baseCost: { scrapMetal: 13 },
    },
    {
      id: 'magnet',
      name: 'Gravity Tether',
      description: 'Increases the range at which loot is auto-collected.',
      icon: '⊕',
      maxLevel: 6,
      effects: [{ type: 'add', stat: 'magnetRange', value: 2.5, statLabel: 'Magnet Range' }],
      baseCost: { scrapMetal: 12, bioEssence: 5 },
    },
    {
      id: 'speed',
      name: 'Thruster Upgrade',
      description: 'Enhanced thrusters increase ship agility.',
      icon: '▶',
      maxLevel: 5,
      effects: [{ type: 'multiply', stat: 'speed', value: 1.15, statLabel: 'Speed' }],
      baseCost: { scrapMetal: 14 },
    },
    {
      id: 'loot_mult',
      name: 'Salvage Protocols',
      description: 'Advanced salvage algorithms extract more resources.',
      icon: '⊞',
      maxLevel: 8,
      effects: [{ type: 'multiply', stat: 'lootMultiplier', value: 1.15, statLabel: 'Loot' }],
      baseCost: { bioEssence: 10, scrapMetal: 8 },
    },
  ],

  passive: [
    {
      id: 'stellar_gen',
      name: 'Stellar Collector',
      description: 'Cosmic array passively generates Stellar Dust.',
      icon: '★',
      maxLevel: 8,
      effects: [{ type: 'add', stat: 'stellarDustRate', value: 0.15, statLabel: 'Stellar/sec' }],
      baseCost: { plasmaCrystals: 20, stellarDust: 5 },
    },
    {
      id: 'scrap_boost',
      name: 'Scrap Magnet',
      description: 'Enhanced salvage systems extract more Scrap Metal.',
      icon: '⚙+',
      maxLevel: 6,
      effects: [{ type: 'multiply', stat: 'lootMultiplier', value: 1.08, statLabel: 'Loot Mult' }],
      baseCost: { scrapMetal: 20 },
    },
    {
      id: 'plasma_boost',
      name: 'Plasma Refinery',
      description: 'Crystal resonators amplify Plasma Crystal yields.',
      icon: '◆+',
      maxLevel: 6,
      effects: [{ type: 'multiply', stat: 'lootMultiplier', value: 1.1, statLabel: 'Loot Mult' }],
      baseCost: { plasmaCrystals: 15, bioEssence: 8 },
    },
    {
      id: 'bio_boost',
      name: 'Bio Harvester',
      description: 'Organic extractors collect more Bio Essence.',
      icon: '✦+',
      maxLevel: 6,
      effects: [{ type: 'multiply', stat: 'lootMultiplier', value: 1.1, statLabel: 'Loot Mult' }],
      baseCost: { bioEssence: 18 },
    },
  ],

  special: [
    {
      id: 'drone',
      name: 'Drone Companion',
      description: 'A loyal combat drone fights alongside your ship.',
      icon: '🤖',
      maxLevel: 1,
      effects: [{ type: 'special', stat: 'hasDrone', value: true, specialDesc: 'Unlocks combat drone' }],
      baseCost: { darkMatter: 2, scrapMetal: 40, plasmaCrystals: 20 },
    },
    {
      id: 'overcharge',
      name: 'Overcharge',
      description: 'Every 10th shot deals massive burst damage.',
      icon: '⚡⚡',
      maxLevel: 1,
      effects: [{ type: 'special', stat: 'hasOvercharge', value: true, specialDesc: 'Every 10th shot deals 5x damage' }],
      baseCost: { darkMatter: 1, plasmaCrystals: 30 },
    },
    {
      id: 'vampire',
      name: 'Vampiric Rounds',
      description: 'Each shot heals the ship for 2% of damage dealt.',
      icon: '♥',
      maxLevel: 1,
      effects: [{ type: 'special', stat: 'hasVampire', value: true, specialDesc: 'Heal 2% of damage dealt' }],
      baseCost: { darkMatter: 1, bioEssence: 35 },
    },
    {
      id: 'reflect',
      name: 'Damage Reflection',
      description: 'Deflector plating reflects 20% of contact damage.',
      icon: '↩',
      maxLevel: 1,
      effects: [{ type: 'special', stat: 'hasDamageReflect', value: true, specialDesc: 'Reflect 20% contact damage' }],
      baseCost: { darkMatter: 1, scrapMetal: 50 },
    },
    {
      id: 'stellar_burst',
      name: 'Stellar Nova',
      description: 'Periodically releases a burst of stellar energy.',
      icon: '✸',
      maxLevel: 3,
      effects: [{ type: 'add', stat: 'damage', value: 8, statLabel: 'Damage' }],
      baseCost: { stellarDust: 20, darkMatter: 1 },
    },
  ],
};

// Category metadata
export const CATEGORY_META = {
  weapon:  { label: 'Weapon',   color: '#ff4444', glowColor: '#ff0000' },
  defense: { label: 'Defense',  color: '#4488ff', glowColor: '#0044ff' },
  utility: { label: 'Utility',  color: '#ffcc00', glowColor: '#aa8800' },
  passive: { label: 'Passive',  color: '#44ff88', glowColor: '#00aa44' },
  special: { label: 'Special',  color: '#cc44ff', glowColor: '#8800cc' },
};

// Category spawn weights per tier depth
export function getCategoryWeights(tier, unlockedCounts) {
  // Base weights
  const base = { weapon: 30, defense: 20, utility: 18, passive: 18, special: 8 };

  // Reduce weight of over-represented categories for variety
  const total = Object.values(unlockedCounts).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const cat of Object.keys(base)) {
      const frac = (unlockedCounts[cat] || 0) / total;
      if (frac > 0.4) base[cat] = Math.floor(base[cat] * 0.6);
    }
  }

  // Special only unlocks at tier >= 4
  if (tier < 4) base.special = 0;

  return base;
}
