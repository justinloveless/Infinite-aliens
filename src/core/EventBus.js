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
};
