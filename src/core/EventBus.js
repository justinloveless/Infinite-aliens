// Simple pub/sub event bus for decoupled system communication
class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => cb(data));
  }

  clear() {
    this._listeners = {};
  }
}

export const eventBus = new EventBus();

// Event name constants
export const EVENTS = {
  ENEMY_SPAWNED:       'enemy:spawned',
  ENEMY_DAMAGED:       'enemy:damaged',
  ENEMY_KILLED:        'enemy:killed',
  PROJECTILE_FIRED:    'projectile:fired',
  LOOT_COLLECTED:      'loot:collected',
  ROUND_STARTED:       'round:started',
  ROUND_COMPLETE:      'round:complete',
  UPGRADE_PURCHASED:   'upgrade:purchased',
  UPGRADE_SOLD:        'upgrade:sold',
  CURRENCY_CHANGED:    'currency:changed',
  PLAYER_DAMAGED:      'player:damaged',
  /** Shield absorbed all or part of a hit. { absorbed: number, hp, maxHp } */
  SHIELD_DAMAGED:      'player:shield_damaged',
  /** Shield HP reached 0 from damage. { maxHp } */
  SHIELD_BROKEN:       'player:shield_broken',
  PLAYER_HEALED:       'player:healed',
  PLAYER_DIED:         'player:died',
  STATS_UPDATED:       'stats:updated',
  GAME_SAVED:          'game:saved',
  STELLAR_NOVA:        'stellar:nova',
  MANUAL_FIRED:        'manual:fired',
  ASTEROID_BROKEN:     'asteroid:broken',    // { position }
  ASTEROID_HIT_ENEMY:  'asteroid:hitEnemy',  // { position, damage }
  EMP_FIRED:           'emp:fired',          // { duration, damage }
  PHOENIX_REVIVED:     'phoenix:revived',    // {}
  SHIP_PURCHASED:      'ship:purchased',     // { shipId }
  SHIP_SELECTED:       'ship:selected',      // { shipId }
  // Galaxy campaign
  GALAXY_BOSS_PENDING:       'galaxy:boss_pending',       // { galaxyIndex, tier } — arena transition
  ARENA_WARNING:             'arena:warning',             // { tier, galaxyIndex } — sector 9 heads-up
  ARENA_TRANSITION_STARTED:  'arena:transition_started',  // { galaxyIndex }
  ARENA_TRANSITION_ENDED:    'arena:transition_ended',    // { galaxyIndex }
  ARENA_PHASE_CHANGED:       'arena:phase_changed',       // { subPhase }
  ARENA_GATE_CLOSED:         'arena:gate_closed',         // { gateId }
  ARENA_COMPLETE:            'arena:complete',            // {}
  ARENA_LEAVE_REQUESTED:     'arena:leave_requested',     // {} — fired when player flies through their built warp gate
  GATE_CRYSTAL_DESTROYED:    'arena:gate_crystal_destroyed', // { gateId }
  CAMPAIGN_ADVANCED:         'campaign:advanced',         // { galaxyIndex, infiniteMode }
  BOSS_SCAN_READY:           'campaign:boss_scan_ready',  // { galaxyIndex } — alien gates closed, player gate building (galaxies 0–8)
  BOSS_GALAXY9_COMPLETE:     'campaign:boss_galaxy9',     // { galaxyIndex } — same moment, galaxy 9 (replication UI)
  RETURN_JOURNEY_STARTED:    'campaign:return_started', // {}
  RETURN_JOURNEY_COMPLETE:   'campaign:return_complete', // {}
  GRAVITY_BOMB_EXPLODED:     'ability:gravity_bomb_end', // { origin: Vector3, radius: number }
  EMP_SHIELD_ZERO:           'player:emp_shield_zero',  // {} — nullifier-style full shield strip
  WEAPONS_FORCE_DISABLED:    'player:weapons_disabled', // { seconds: number } — EMP reflect / similar
  // Infinite mastery
  MASTERY_PURCHASED:   'mastery:purchased',   // { nodeId, masteryLevel }
  // Energy system
  ENERGY_OFFLINE: 'player:energy_offline',   // systems shut down (current hit 0)
  ENERGY_ONLINE:  'player:energy_online',    // systems restored (current recovered above threshold)
};
