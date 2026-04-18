/**
 * Stateless coordinator that resolves collider overlaps each frame and calls
 * `ColliderComponent.onHit(otherEntity, selfEntity)` on each side of the pair.
 *
 * All hit behavior lives in the components themselves: e.g. ProjectileDamage,
 * LootDrop, Asteroid, ContactDamage register their own onHit callbacks.
 */
export class CollisionCoordinator {
  constructor(world) {
    this.world = world;
  }

  /** Resolve collisions for the current frame. */
  update() {
    const entities = Array.from(this.world.queryByComponent('ColliderComponent'));
    const n = entities.length;
    if (n < 2) return;

    for (let i = 0; i < n; i++) {
      const ea = entities[i];
      if (!ea.active) continue;
      const ca = ea.get('ColliderComponent');
      const ta = ea.get('TransformComponent');
      if (!ca || !ta) continue;

      for (let j = i + 1; j < n; j++) {
        const eb = entities[j];
        if (!eb.active) continue;
        const cb = eb.get('ColliderComponent');
        const tb = eb.get('TransformComponent');
        if (!cb || !tb) continue;

        const maskAB = ca.mask?.has ? ca.mask.has(cb.layer) : ca.mask?.includes?.(cb.layer);
        const maskBA = cb.mask?.has ? cb.mask.has(ca.layer) : cb.mask?.includes?.(ca.layer);
        if (!maskAB && !maskBA) continue;

        if (ca.shouldCollide && !ca.shouldCollide(eb, ea)) continue;
        if (cb.shouldCollide && !cb.shouldCollide(ea, eb)) continue;

        const r = ca.radius + cb.radius;
        if (ta.position.distanceToSquared(tb.position) > r * r) continue;

        if (maskAB && ca.onHit) ca.onHit(eb, ea);
        if (!ea.active || !eb.active) continue;
        if (maskBA && cb.onHit) cb.onHit(ea, eb);
      }
    }
  }
}
