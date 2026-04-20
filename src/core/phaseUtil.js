/**
 * Phase predicates. Kept here so weapons, AoE, and enemy AI can share one
 * definition of "combat-like" phases without repeating the literal strings.
 *
 * Canonical phases live on `state.round.phase`:
 *   'start' | 'combat' | 'arena_transition' | 'boss_arena' | 'dead'
 */

/** True for phases where weapons should fire and collisions should apply. */
export function isCombatPhase(phase) {
  return phase === 'combat' || phase === 'boss_arena' || phase === 'arena_transition';
}

/** True only for the classic open-space combat phase (no arena). */
export function isOpenCombatPhase(phase) {
  return phase === 'combat';
}
