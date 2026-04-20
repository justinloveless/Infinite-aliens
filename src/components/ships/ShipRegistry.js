import { AllrounderShipComponent } from './AllrounderShipComponent.js';
import { HeavyShipComponent } from './HeavyShipComponent.js';
import { FighterShipComponent } from './FighterShipComponent.js';

/**
 * Registry of every ship ECS component class available for purchase / spawn.
 *
 * The order here is the order they appear in the hangar selector carousel.
 * Adding a new ship = create a `FooShipComponent` subclass and append it here.
 */
const SHIP_CLASSES = [
  AllrounderShipComponent,
  HeavyShipComponent,
  FighterShipComponent,
];

const _byId = new Map(SHIP_CLASSES.map(cls => [cls.id, cls]));

/** Every registered ship component class, in canonical display order. */
export function getAllShipClasses() {
  return [...SHIP_CLASSES];
}

/** Lookup a ship component class by id. Returns `null` if missing. */
export function getShipClass(id) {
  return _byId.get(id) || null;
}

/** POJO descriptor for every ship — in the shape the old ships.json exposed. */
export function getAllShipDefs() {
  return SHIP_CLASSES.map(cls => cls.def);
}

/** POJO descriptor for one ship id. Returns `null` if missing. */
export function getShipDef(id) {
  const cls = _byId.get(id);
  return cls ? cls.def : null;
}

/** Id of the default starter ship (`ownedByDefault: true`). */
export function getDefaultShipId() {
  const starter = SHIP_CLASSES.find(cls => cls.ownedByDefault);
  return starter?.id || SHIP_CLASSES[0]?.id || 'allrounder';
}

/** Instantiate a fresh ship component for `id` so it can be attached to an entity. */
export function createShipComponent(id) {
  const Cls = _byId.get(id);
  return Cls ? new Cls() : null;
}
