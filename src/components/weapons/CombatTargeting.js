/** Shared target-picking helper used by weapon components. */

/**
 * @param {World} world
 * @param {Vector3} playerPos
 * @param {PlayerStatsComponent} stats
 * @param {{ manualFocusEnemyId?: string | null }} [round]
 * @returns {Entity | null}
 */
export function resolveTarget(world, playerPos, stats, round) {
  const range = stats?.targetingRange ?? Infinity;
  const r2 = range * range;
  // Cached per-frame list; skips the active-filter cost and is reused by
  // every weapon + AoE querying enemies this tick.
  const enemies = world.getFrameEnemies();

  const manualId = stats?.manualTargetFocusEnabled && round?.manualFocusEnemyId
    ? round.manualFocusEnemyId : null;
  if (manualId) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.id === manualId) return e;
    }
    if (round) round.manualFocusEnemyId = null;
  }

  let nearest = null;
  let minD2 = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const t = e.get('TransformComponent');
    if (!t) continue;
    const dx = t.position.x - playerPos.x;
    const dy = t.position.y - playerPos.y;
    const dz = t.position.z - playerPos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < minD2 && d2 <= r2) {
      minD2 = d2;
      nearest = e;
    }
  }
  return nearest;
}
