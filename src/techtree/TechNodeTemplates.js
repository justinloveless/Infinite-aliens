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
      description: 'Mounts a secondary plasma beam cannon that fires independently from your main weapon.',
      icon: '━',
      maxLevel: 1,
      effects: [{ type: 'add_weapon', value: 'laser', statLabel: 'Plasma Beam' }],
      baseCost: { scrapMetal: 8 },
    },
    {
      id: 'missile_type',
      name: 'Homing Missiles',
      description: 'Adds a homing missile launcher that fires independently from your main weapon.',
      icon: '🚀',
      maxLevel: 1,
      effects: [{ type: 'add_weapon', value: 'missile', statLabel: 'Homing Missiles' }],
      baseCost: { scrapMetal: 25, plasmaCrystals: 10 },
    },
    {
      id: 'plasma_type',
      name: 'Dark Plasma',
      description: 'Adds a dark plasma cannon that fires independently from your main weapon.',
      icon: '◉',
      maxLevel: 1,
      effects: [{ type: 'add_weapon', value: 'plasma', statLabel: 'Dark Plasma' }],
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
      description: 'A loyal combat drone orbits your ship and assists in battle.',
      icon: '🤖',
      maxLevel: 1,
      effects: [{ type: 'special', stat: 'hasDrone', value: true, specialDesc: 'Unlocks combat drone' }],
      baseCost: { darkMatter: 2, scrapMetal: 40, plasmaCrystals: 20 },
      synergies: [
        {
          requires: ['drone', 'vampire'],
          label: 'Drone Vampire',
          desc: 'Drone kills also trigger vampiric healing.',
          effects: [{ type: 'add', stat: 'hpRegen', value: 0.5, scaleMode: 'fixed', statLabel: 'HP/sec (Drone Vamp)' }],
        },
      ],
      presentation: {
        rarity: 'epic',
        badge: 'DRN',
        flavorText: 'It was lonely out here. Not anymore.',
        synergyHints: ['vampire'],
      },
      visual: {
        attachments: [
          {
            id: 'drone_companion',
            anchor: 'ship',
            orbit: { radius: 2.5, speed: 1.2, tilt: 0.3 },
            mesh: {
              geometry: { type: 'octahedron', params: [0.3] },
              material: { type: 'standard', color: '#0088ff', emissive: '#0044aa', emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 },
              light: { color: '#0088ff', intensity: 0.8, distance: 3.0 },
              children: [
                {
                  geometry: { type: 'sphere', params: [0.08, 6, 6] },
                  material: { type: 'basic', color: '#aaffff' },
                },
              ],
            },
          },
        ],
      },
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
      description: 'On-kill: restore hull integrity equal to 3% of the enemy\'s max HP. Bonus heal at low hull.',
      icon: '♥',
      maxLevel: 3,
      effects: [{ type: 'special', stat: 'hasVampire', value: true, scaleMode: 'fixed', specialDesc: 'On-kill: heal 3% of enemy max HP' }],
      baseCost: { darkMatter: 1, bioEssence: 35 },
      triggers: [
        {
          event: 'enemy:killed',
          action: {
            type: 'heal_player',
            value: { base: 2, perLevel: 1 },
          },
          cooldown: 0,
        },
      ],
      presentation: {
        rarity: 'rare',
        badge: 'VMP',
        flavorText: 'Death feeds the living.',
        synergyHints: ['drone'],
      },
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

    // ── Showcase nodes demonstrating the full grammar ──────────────────────
    {
      id: 'crit_mastery',
      name: 'Crit Mastery',
      description: 'Advanced targeting theory pushes critical hit capability to its physical limit.',
      icon: '◎+',
      maxLevel: 5,
      effects: [
        {
          type: 'add',
          stat: 'critChance',
          value: 0.05,
          scaleMode: 'diminishing',
          diminishingBase: 0.18,
          statLabel: 'Crit Chance',
        },
        {
          type: 'multiply',
          stat: 'critMultiplier',
          value: 1.08,
          scaleMode: 'exponential',
          statLabel: 'Crit Mult',
        },
      ],
      baseCost: { plasmaCrystals: 25, bioEssence: 10 },
      synergies: [
        {
          requires: ['crit_mastery', 'crit_damage'],
          label: 'Precision Carnage',
          desc: 'Crits also trigger a small AoE blast.',
          effects: [
            { type: 'add', stat: 'damage', value: 5, scaleMode: 'fixed', statLabel: 'AoE Crit Dmg' },
          ],
        },
      ],
      presentation: {
        rarity: 'rare',
        badge: 'CRT',
        borderAnim: 'pulse',
        flavorText: 'Precision is a state of mind.',
        synergyHints: ['crit_damage'],
      },
    },
    {
      id: 'anti_scout_doctrine',
      name: 'Anti-Scout Doctrine',
      description: 'Scouts move slower and your weapons punch through their thin hulls.',
      icon: '⊘',
      maxLevel: 3,
      effects: [
        { type: 'multiply', stat: 'scout.speedMult',          value: 0.75, target: 'enemy', scaleMode: 'fixed', statLabel: 'Scout Speed' },
        { type: 'multiply', stat: 'scout.damageReceivedMult', value: 1.3,  target: 'enemy', scaleMode: 'exponential', statLabel: 'Scout Vuln' },
      ],
      baseCost: { scrapMetal: 18, bioEssence: 8 },
      presentation: {
        rarity: 'uncommon',
        badge: 'ASD',
        flavorText: 'Fast ships die fastest when you know where to aim.',
      },
    },
    {
      id: 'round_accelerator',
      name: 'Round Accelerator',
      description: 'Enemy spawns are faster and more plentiful, but loot pours in proportionally.',
      icon: '⏩',
      maxLevel: 3,
      effects: [
        { type: 'multiply', stat: 'spawnInterval',  value: 0.85, target: 'round', scaleMode: 'exponential', statLabel: 'Spawn Interval' },
        { type: 'multiply', stat: 'maxConcurrent',  value: 1.2,  target: 'round', scaleMode: 'exponential', statLabel: 'Max Enemies' },
        { type: 'multiply', stat: 'lootMultiplier', value: 1.1,  statLabel: 'Loot Mult' },
      ],
      baseCost: { darkMatter: 1, stellarDust: 15 },
      costModifiers: [
        { type: 'round_scale', factor: 0.12 },
      ],
      presentation: {
        rarity: 'rare',
        badge: 'ACL',
        borderAnim: 'pulse',
        flavorText: 'More targets. More glory. More scrap.',
      },
    },
    {
      id: 'bio_harvester_mk2',
      name: 'Bio Harvester Mk II',
      description: 'Next-generation bio extractors massively increase Bio Essence yields. Synergy discount with Bio Boost.',
      icon: '✦⬆',
      maxLevel: 5,
      effects: [
        { type: 'multiply', stat: 'loot.bioEssence', value: 1.25, target: 'currency', statLabel: 'Bio Essence Loot' },
        {
          type: 'add',
          stat: 'loot.bioEssence',
          value: 0.15,
          target: 'currency',
          scaleMode: 'linear',
          condition: { type: 'round_gte', threshold: 10 },
          statLabel: 'Bio Rate (Round 10+)',
        },
      ],
      baseCost: { bioEssence: 30, plasmaCrystals: 12 },
      costModifiers: [
        {
          type: 'synergy_discount',
          requires: ['bio_boost'],
          discount: 0.25,
          altLabel: '25% off with Bio Boost',
        },
      ],
      presentation: {
        rarity: 'uncommon',
        badge: 'BIO',
        flavorText: 'Life, compressed and monetized.',
        synergyHints: ['bio_boost'],
      },
    },
    {
      id: 'nova_core',
      name: 'Nova Core',
      description: 'A miniature stellar core that amplifies all combat and triggers powerful on-kill chain reactions.',
      icon: '✺',
      maxLevel: 1,
      effects: [
        { type: 'multiply', stat: 'damage',              value: 1.35,  scaleMode: 'fixed', statLabel: 'Damage' },
        { type: 'multiply', stat: 'all.hpMult',          value: 0.8,   target: 'enemy',    scaleMode: 'fixed', statLabel: 'Enemy HP' },
        { type: 'add',      stat: 'critChance',          value: 0.1,   scaleMode: 'fixed', statLabel: 'Crit Chance' },
      ],
      baseCost: { darkMatter: 4, stellarDust: 50, plasmaCrystals: 40 },
      triggers: [
        {
          event: 'enemy:killed',
          action: {
            type: 'emit_damage',
            value: 30,
            radius: 3.5,
          },
          cooldown: 0.4,
          chance: 0.5,
        },
        {
          event: 'round:started',
          action: {
            type: 'add_currency',
            currency: 'stellarDust',
            value: 5,
          },
        },
      ],
      presentation: {
        rarity: 'legendary',
        badge: '★',
        borderAnim: 'rainbow',
        flavorText: 'You carry a dying star. It is not at peace.',
      },
    },
    {
      id: 'plasma_core',
      name: 'Plasma Core',
      description: 'A supercharged plasma cell amplifies your dark plasma cannon with visibly larger, brighter bolts.',
      icon: '◉+',
      maxLevel: 3,
      effects: [
        { type: 'multiply', stat: 'damage', value: 1.15, statLabel: 'Damage' },
      ],
      baseCost: { plasmaCrystals: 22, darkMatter: 1 },
      presentation: {
        rarity: 'rare',
        badge: 'PLS',
        flavorText: 'The bolts leave scorch-light even after impact.',
      },
      visual: {
        projectile: {
          type: 'plasma',
          geometry: { type: 'sphere', params: [0.22, 8, 8] },
          color: '#ff00ff',
          emissive: '#880088',
          emissiveIntensity: 2.0,
          scale: 1.5,
        },
      },
    },
    {
      id: 'wing_cannons',
      name: 'Wing Cannons',
      description: 'Reinforced wing struts mount heavy forward cannons, visibly widening the ship profile.',
      icon: '⟺',
      maxLevel: 2,
      effects: [
        { type: 'multiply', stat: 'damage', value: 1.12, statLabel: 'Damage' },
      ],
      baseCost: { scrapMetal: 35, plasmaCrystals: 15 },
      presentation: {
        rarity: 'uncommon',
        badge: 'WNG',
        flavorText: 'More wing. More firepower. Simple math.',
      },
      visual: {
        modifiers: [
          { target: 'wing_left',  property: 'scale_x', op: 'multiply', value: 1.2 },
          { target: 'wing_right', property: 'scale_x', op: 'multiply', value: 1.2 },
          { target: 'wing_left',  property: 'emissive', op: 'set', value: '#aa6600' },
          { target: 'wing_right', property: 'emissive', op: 'set', value: '#aa6600' },
          { target: 'wing_left',  property: 'emissiveIntensity', op: 'set', value: 0.9 },
          { target: 'wing_right', property: 'emissiveIntensity', op: 'set', value: 0.9 },
        ],
        attachments: [
          {
            id: 'wing_cannon_left',
            anchor: 'wing_left',
            offset: { x: -0.3, y: 0, z: -0.2 },
            mesh: {
              geometry: { type: 'cylinder', params: [0.06, 0.06, 0.55, 6] },
              material: { type: 'standard', color: '#886633', emissive: '#ff8800', emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.3 },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
            },
          },
          {
            id: 'wing_cannon_right',
            anchor: 'wing_right',
            offset: { x: 0.3, y: 0, z: -0.2 },
            mesh: {
              geometry: { type: 'cylinder', params: [0.06, 0.06, 0.55, 6] },
              material: { type: 'standard', color: '#886633', emissive: '#ff8800', emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.3 },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
            },
          },
        ],
      },
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
