import { getCorridorBaseEnemyTypes } from '../components/enemy/EnemyDefs.js';

/**
 * Base tier spawn table plus any counter types unlocked by prior galaxy scans.
 * Counter becomes eligible starting the galaxy *after* the scan (scan.galaxyIndex < current campaign galaxy).
 *
 * @param {number} tier
 * @param {object} state
 * @returns {string[]}
 */
export function getSpawnableEnemyTypes(tier, state) {
  const galaxyIndex = state?.campaign?.galaxyIndex ?? 0;
  const types = [...getCorridorBaseEnemyTypes(tier, galaxyIndex)];
  const c = state?.campaign;
  if (!c) return types;

  const scans = c.scannedItems ?? [];
  for (const scan of scans) {
    if (scan.galaxyIndex < galaxyIndex && scan.counterType && !types.includes(scan.counterType)) {
      types.push(scan.counterType);
    }
  }

  if (c.returnJourney?.active && !types.includes('ship_clone')) {
    types.push('ship_clone');
  }

  return types;
}
