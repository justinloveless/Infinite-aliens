import { Component } from '../../ecs/Component.js';
import { PLAYER } from '../../constants.js';

/**
 * Base class for per-ship ECS components.
 *
 * Each concrete ship (Vanguard, Bulwark, Stingray, …) is its own subclass
 * holding ALL of that ship's data and behavior:
 *
 *   - identity      → static `id`, `displayName`, `description`, `ownedByDefault`
 *   - store         → static `cost` (currency map)
 *   - stats         → static `baseStats` (BASE_* override map)
 *   - loadout       → static `slots`, `defaultUnlockedSlots`, `defaultLoadout`
 *   - visuals       → static `meshVariant`, static `buildHull({ withLights })`
 *   - per-frame     → instance `update(dt, ctx)` override (optional)
 *   - lifecycle     → instance `onAttach(ctx)` / `onDetach()` (optional)
 *
 * One instance is attached to the player entity at a time. Switching ships
 * destroys + rebuilds the player entity (see main.js#_rebuildPlayerEntityForShipChange),
 * so `onAttach` runs when the ship becomes active and `onDetach` runs when it
 * goes inactive — a natural hook point for ship-specific passives, telemetry,
 * or unique abilities that shouldn't cross variants.
 *
 * All subclasses share the same `componentName` so lookups work by base type:
 *   `entity.get('ShipComponent')` → whatever variant is currently active.
 */
export class ShipComponent extends Component {
  static get componentName() { return 'ShipComponent'; }

  // ─── Subclass-provided metadata ────────────────────────────────────────
  // Override these on each concrete ship class. Left empty here so missing
  // overrides throw loudly instead of silently picking Vanguard values.

  /** Canonical id used in save files and registries (e.g. 'allrounder'). */
  static id = '';
  /** Human-facing display name (e.g. 'Vanguard'). */
  static displayName = '';
  /** Short tooltip/description shown on the hangar selector card. */
  static description = '';
  /** Purchase cost as a { currencyKey: amount } map. Empty object = free. */
  static cost = {};
  /** `true` for the starter ship the player auto-owns from a fresh save. */
  static ownedByDefault = false;
  /** ShipMeshFactory variant key (matches static `id` by convention). */
  static meshVariant = 'allrounder';
  /** BASE_* stat overrides; omitted keys inherit from PLAYER.BASE_*. */
  static baseStats = {};
  /** Hardpoint definitions for this ship only. */
  static slots = [];
  /** Slot ids that start unlocked on a fresh loadout. */
  static defaultUnlockedSlots = [];
  /** { slotId: itemId } pre-installed on a fresh loadout. */
  static defaultLoadout = {};

  // ─── Runtime descriptor ────────────────────────────────────────────────

  /**
   * Plain POJO mirror of the class metadata, in the shape the rest of the
   * code (ships.js helpers, HangarUI, SaveManager) already consumes.
   */
  static get def() {
    return {
      id: this.id,
      name: this.displayName,
      description: this.description,
      meshVariant: this.meshVariant,
      cost: { ...this.cost },
      ownedByDefault: !!this.ownedByDefault,
      baseStats: { ...this.baseStats },
      defaultUnlockedSlots: [...this.defaultUnlockedSlots],
      defaultLoadout: { ...this.defaultLoadout },
      slots: this.slots,
    };
  }

  /**
   * Translate this ship's BASE_* override map into the player stat shape
   * used by `state.player`, falling back to global PLAYER constants.
   */
  static getBasePlayerValues() {
    const base = this.baseStats || {};
    return {
      maxHp: base.BASE_HP ?? PLAYER.BASE_HP,
      damage: base.BASE_DAMAGE ?? PLAYER.BASE_DAMAGE,
      attackSpeed: base.BASE_ATTACK_SPEED ?? PLAYER.BASE_ATTACK_SPEED,
      projectileCount: base.BASE_PROJECTILE_COUNT ?? PLAYER.BASE_PROJECTILE_COUNT,
      projectileSpeed: base.BASE_PROJECTILE_SPEED ?? PLAYER.BASE_PROJECTILE_SPEED,
      critChance: base.BASE_CRIT_CHANCE ?? PLAYER.BASE_CRIT_CHANCE,
      critMultiplier: base.BASE_CRIT_MULT ?? PLAYER.BASE_CRIT_MULT,
      shield: base.BASE_SHIELD ?? PLAYER.BASE_SHIELD,
      shieldRegen: base.BASE_SHIELD_REGEN ?? PLAYER.BASE_SHIELD_REGEN,
      hpRegen: base.BASE_HP_REGEN ?? PLAYER.BASE_HP_REGEN,
      armor: base.BASE_ARMOR ?? PLAYER.BASE_ARMOR,
      speed: base.BASE_SPEED ?? PLAYER.BASE_SPEED,
      magnetRange: base.BASE_MAGNET_RANGE ?? PLAYER.BASE_MAGNET_RANGE,
      visionRange: base.BASE_VISION_RANGE ?? PLAYER.BASE_VISION_RANGE,
      targetingRange: base.BASE_TARGETING_RANGE ?? PLAYER.BASE_TARGETING_RANGE,
      lootMultiplier: base.BASE_LOOT_MULT ?? PLAYER.BASE_LOOT_MULT,
      energyRegen: base.BASE_ENERGY_REGEN ?? PLAYER.BASE_ENERGY_REGEN,
    };
  }

  /** Build a fresh per-ship loadout using the subclass' defaults. */
  static createLoadout() {
    const slots = {};
    for (const def of this.slots) slots[def.id] = { installedInstanceId: null };
    return {
      slots,
      unlockedSlots: [...this.defaultUnlockedSlots],
    };
  }

  /**
   * Build the Three.js hull for this ship.
   *
   * Subclasses MUST override. Returning a `THREE.Group` is required; the
   * group's `userData` must expose `hull`, `wingL`, `wingR`, `engine`,
   * `cockpit` for the visual-modifier system.
   */
  static buildHull(_opts = {}) {
    throw new Error(
      `${this.name}.buildHull() must be overridden by the concrete ship subclass.`,
    );
  }

  // ─── Instance-level convenience shims ──────────────────────────────────
  // Makes an attached instance behave like an old `def` POJO for callers
  // that pull descriptor fields off the component directly.

  get id() { return this.constructor.id; }
  get displayName() { return this.constructor.displayName; }
  get description() { return this.constructor.description; }
  get meshVariant() { return this.constructor.meshVariant; }
  get cost() { return this.constructor.cost; }
  get baseStats() { return this.constructor.baseStats; }
  get slots() { return this.constructor.slots; }
  get defaultUnlockedSlots() { return this.constructor.defaultUnlockedSlots; }
  get defaultLoadout() { return this.constructor.defaultLoadout; }

  /** Build a hull mesh for this attached variant. */
  buildHull(opts) { return this.constructor.buildHull(opts); }
  /** Subclass-overridable per-frame hook. Default: no-op. */
  update(_dt, _ctx) {}
}
