/**
 * Per-weapon multipliers on top of {@link PlayerStatsComponent} base stats
 * (damage, crit chance, crit multiplier from upgrades). All are multiplicative.
 */
export const WEAPON_COMBAT_MODS = {
  auto: { damageMult: 1, critChanceMult: 1, critMultiplierMult: 1 },
  manual: { damageMult: 1, critChanceMult: 1, critMultiplierMult: 1 },
  laser: { damageMult: 1, critChanceMult: 1, critMultiplierMult: 1 },
  missile: { damageMult: 1, critChanceMult: 1, critMultiplierMult: 1 },
  plasma: { damageMult: 1, critChanceMult: 1, critMultiplierMult: 1 },
  beam: { damageMult: 1, critChanceMult: 1, critMultiplierMult: 1 },
  railgun: { damageMult: 4, critChanceMult: 1, critMultiplierMult: 1.5 },
};

/** @param {keyof typeof WEAPON_COMBAT_MODS} id */
export function getWeaponCombatMods(id) {
  return WEAPON_COMBAT_MODS[id] ?? {
    damageMult: 1, critChanceMult: 1, critMultiplierMult: 1,
  };
}
