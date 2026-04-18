/**
 * Stateless coordinator that resolves collider overlaps each frame and calls
 * `ColliderComponent.onHit(otherEntity, selfEntity)` on each side of the pair.
 *
 * Uses a uniform spatial hash (cell size 4 units on the XZ plane) so per-frame
 * cost is roughly O(n) with small constants instead of the naive O(n^2) pair
 * loop. Each collider is binned into a single cell and only tested against
 * colliders in the 3x3 neighborhood around its cell.
 *
 * All hit behavior still lives in the components themselves: e.g.
 * ProjectileDamage, LootDrop, Asteroid, ContactDamage register their own
 * onHit callbacks.
 */

const CELL_SIZE = 4;
const INV_CELL_SIZE = 1 / CELL_SIZE;

export class CollisionCoordinator {
  constructor(world) {
    this.world = world;
    // Reused between frames to avoid reallocating the Map and cell arrays on
    // every tick. Each cell array is pushed to during the bin pass and length
    // reset to 0 at the start of the next frame.
    this._grid = new Map();
    this._cells = []; // track live cell arrays to reset them in O(k).
  }

  /** Resolve collisions for the current frame. */
  update() {
    const colliderSet = this.world.queryByComponent('ColliderComponent');
    if (!colliderSet || colliderSet.size < 2) return;

    this._clearGrid();

    // Bin colliders into cells. Pre-read transform/collider once for speed.
    for (const e of colliderSet) {
      if (!e.active) continue;
      const c = e.get('ColliderComponent');
      const t = e.get('TransformComponent');
      if (!c || !t) continue;
      const cx = Math.floor(t.position.x * INV_CELL_SIZE);
      const cz = Math.floor(t.position.z * INV_CELL_SIZE);
      const key = _cellKey(cx, cz);
      let bucket = this._grid.get(key);
      if (!bucket) {
        bucket = [];
        this._grid.set(key, bucket);
        this._cells.push(bucket);
      }
      // Inline entity + components to avoid repeated Map lookups below.
      bucket.push(e, c, t);
    }

    // For each collider, test against itself's cell and the 8 neighbors.
    // Pair de-dup: only test (a,b) when a's index < b's index in cell-iteration
    // order, using an increasing pair counter keyed off entity object identity.
    for (const bucket of this._cells) {
      const bn = bucket.length;
      // bucket layout: [e0, c0, t0, e1, c1, t1, ...]
      for (let i = 0; i < bn; i += 3) {
        const ea = bucket[i];
        if (!ea.active) continue;
        const ca = bucket[i + 1];
        const ta = bucket[i + 2];
        const cellX = Math.floor(ta.position.x * INV_CELL_SIZE);
        const cellZ = Math.floor(ta.position.z * INV_CELL_SIZE);
        // Same cell: only later indices to avoid double testing.
        for (let j = i + 3; j < bn; j += 3) {
          const eb = bucket[j];
          if (!eb.active) continue;
          this._testPair(ea, ca, ta, eb, bucket[j + 1], bucket[j + 2]);
          if (!ea.active) break;
        }
        if (!ea.active) continue;
        // Neighbor cells: include only cells with strictly greater (x,z) key
        // (lexicographic) to avoid double testing. 4 of 8 neighbors qualify.
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = cellX + dx;
            const nz = cellZ + dz;
            // Lex compare: (nx, nz) > (cellX, cellZ)?
            if (nx < cellX || (nx === cellX && nz <= cellZ)) continue;
            const nBucket = this._grid.get(_cellKey(nx, nz));
            if (!nBucket) continue;
            const nn = nBucket.length;
            for (let k = 0; k < nn; k += 3) {
              const eb = nBucket[k];
              if (!eb.active) continue;
              this._testPair(ea, ca, ta, eb, nBucket[k + 1], nBucket[k + 2]);
              if (!ea.active) break;
            }
            if (!ea.active) break;
          }
          if (!ea.active) break;
        }
      }
    }
  }

  _testPair(ea, ca, ta, eb, cb, tb) {
    const maskAB = ca.mask.has(cb.layer);
    const maskBA = cb.mask.has(ca.layer);
    if (!maskAB && !maskBA) return;

    if (ca.shouldCollide && !ca.shouldCollide(eb, ea)) return;
    if (cb.shouldCollide && !cb.shouldCollide(ea, eb)) return;

    const r = ca.radius + cb.radius;
    if (ta.position.distanceToSquared(tb.position) > r * r) return;

    if (maskAB && ca.onHit) ca.onHit(eb, ea);
    if (!ea.active || !eb.active) return;
    if (maskBA && cb.onHit) cb.onHit(ea, eb);
  }

  _clearGrid() {
    // Reset cell arrays in place and clear the map; recycling both avoids GC.
    for (const bucket of this._cells) bucket.length = 0;
    this._cells.length = 0;
    this._grid.clear();
  }
}

function _cellKey(x, z) {
  // Pack into a single number; 16-bit halves support +-32K cells (scene bounds
  // are far smaller). Fast path Map-lookup avoids string allocations.
  return ((x & 0xffff) << 16) | (z & 0xffff);
}
