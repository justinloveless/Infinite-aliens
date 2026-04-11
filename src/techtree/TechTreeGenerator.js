import { TechNode } from './TechNode.js';
import { NODE_TEMPLATES, STARTER_NODES, getCategoryWeights } from './TechNodeTemplates.js';
import { TECH_TREE } from '../constants.js';

// Mulberry32 seeded PRNG - fast, deterministic
function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(weights, rng) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total === 0) return entries[0][0];
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// Early-game only scrap drops reliably, so we filter ring 1 (the first paid
// ring) down to scrap-only templates where possible.
function isScrapOnlyTemplate(template) {
  const keys = Object.keys(template.baseCost);
  return keys.length > 0 && keys.every((k) => k === 'scrapMetal');
}

function filterScrapOnlyPool(pool) {
  const scrapOnly = pool.filter(isScrapOnlyTemplate);
  return scrapOnly.length > 0 ? scrapOnly : pool;
}

// Normalize an angle to [0, 2π)
function normAngle(a) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

// Shortest angular distance between two angles (absolute)
function angularDist(a, b) {
  const d = Math.abs(normAngle(a) - normAngle(b));
  return Math.min(d, Math.PI * 2 - d);
}

// Ring 0 starter anchors: cardinal positions, one per non-special category.
// Top=weapon, Right=defense, Bottom=utility, Left=passive.
const STARTER_ANCHORS = [
  { category: 'weapon',  angle: -Math.PI / 2 },   // top
  { category: 'defense', angle: 0 },              // right
  { category: 'utility', angle: Math.PI / 2 },    // bottom
  { category: 'passive', angle: Math.PI },        // left
];

export class TechTreeGenerator {
  constructor(baseSeed) {
    this._baseSeed = baseSeed;
    this._generatedNodes = {}; // nodeId -> TechNode
    this._tiers = [];          // tiers[ring] = [nodeId, ...]
    this._angles = {};         // nodeId -> angle on its ring
  }

  // Generate all rings up to (and including) the given ring
  generateUpToTier(targetRing, unlockedCounts = {}) {
    const startRing = this._tiers.length;
    for (let ring = startRing; ring <= targetRing; ring++) {
      this._generateRing(ring, unlockedCounts);
    }
    return this._generatedNodes;
  }

  _generateRing(ring, unlockedCounts) {
    const rng = makePRNG(this._baseSeed + ring * TECH_TREE.TIER_PRIME);

    if (ring === 0) {
      this._generateStarterRing();
      return;
    }

    // Determine node count for this ring
    const count = TECH_TREE.MIN_NODES_PER_RING +
      Math.floor(rng() * (TECH_TREE.MAX_NODES_PER_RING - TECH_TREE.MIN_NODES_PER_RING + 1));

    const radius = TECH_TREE.CENTER_RADIUS + ring * TECH_TREE.RING_SPACING;
    // Offset each ring by a fraction of its slot so rings don't form straight radial lines
    const angleOffset = -Math.PI / 2 + ring * 0.37 + (rng() - 0.5) * 0.3;

    const prevRing = this._tiers[ring - 1] || [];
    const ringNodes = [];
    const ringAngles = [];
    const usedTemplateIds = new Set();

    // First pass: create nodes with template + position
    for (let i = 0; i < count; i++) {
      const angle = angleOffset + (i / count) * Math.PI * 2;

      // Pick category with sector bias
      const category = this._pickCategoryForAngle(angle, ring, rng, unlockedCounts, ringNodes);

      // Pick template (avoid duplicates within this ring)
      let pool = NODE_TEMPLATES[category].filter(t => !usedTemplateIds.has(t.id));
      // Ring 1 is the first paid ring and only scrap drops reliably that early,
      // so prefer scrap-only templates there.
      if (ring === 1) pool = filterScrapOnlyPool(pool);
      const template = pool.length > 0
        ? pickRandom(pool, rng)
        : pickRandom(NODE_TEMPLATES[category], rng);
      usedTemplateIds.add(template.id);

      const position = this._polarToPosition(radius, angle);
      const node = this._createNode(ring, i, template, category, position);
      this._angles[node.id] = angle;
      ringNodes.push(node.id);
      ringAngles.push(angle);
    }

    // Second pass: assign inward connections (each node to nearest-angle node on prev ring)
    if (prevRing.length > 0) {
      const prevAngles = prevRing.map(id => this._angles[id]);
      for (let i = 0; i < ringNodes.length; i++) {
        const node = this._generatedNodes[ringNodes[i]];
        const angle = ringAngles[i];

        // Closest inward neighbor by angular distance
        const closestIdx = this._closestAngleIndex(angle, prevAngles);
        node.prerequisites.push(prevRing[closestIdx]);

        // Optional second inward neighbor (creates crossing/branching paths)
        if (prevRing.length > 1 && rng() < TECH_TREE.CROSS_CONNECT_CHANCE) {
          const secondIdx = this._closestAngleIndex(angle, prevAngles, closestIdx);
          if (secondIdx !== closestIdx) {
            node.prerequisites.push(prevRing[secondIdx]);
          }
        }
      }
    }

    // Third pass: lateral connections around the ring (bidirectional)
    if (ringNodes.length > 1) {
      for (let i = 0; i < ringNodes.length; i++) {
        if (rng() < TECH_TREE.LATERAL_CONNECT_CHANCE) {
          const nextI = (i + 1) % ringNodes.length;
          const a = this._generatedNodes[ringNodes[i]];
          const b = this._generatedNodes[ringNodes[nextI]];
          if (!a.prerequisites.includes(b.id)) a.prerequisites.push(b.id);
          if (!b.prerequisites.includes(a.id)) b.prerequisites.push(a.id);
        }
      }
    }

    this._tiers.push(ringNodes);
  }

  _generateStarterRing() {
    const radius = TECH_TREE.CENTER_RADIUS;
    const ringNodes = [];

    STARTER_ANCHORS.forEach((anchor, idx) => {
      const template = STARTER_NODES[anchor.category];
      if (!template) return;

      const position = this._polarToPosition(radius, anchor.angle);
      // Starters use their own id namespace so seed collisions can't rename them
      const id = `starter_${anchor.category}`;

      const node = new TechNode({
        id,
        tier: 0,
        name: template.name,
        description: template.description,
        category: anchor.category,
        effects: template.effects.map(e => ({ ...e })),
        maxLevel: template.maxLevel,
        currentLevel: 0,
        baseCost: { ...template.baseCost }, // empty = free
        prerequisites: [],                   // always available
        position,
        icon: template.icon,
      });

      this._generatedNodes[id] = node;
      this._angles[id] = anchor.angle;
      ringNodes.push(id);
    });

    // Connect neighboring starters so the center hub feels connected
    for (let i = 0; i < ringNodes.length; i++) {
      const nextI = (i + 1) % ringNodes.length;
      const a = this._generatedNodes[ringNodes[i]];
      const b = this._generatedNodes[ringNodes[nextI]];
      if (!a.prerequisites.includes(b.id)) a.prerequisites.push(b.id);
      if (!b.prerequisites.includes(a.id)) b.prerequisites.push(a.id);
    }

    this._tiers.push(ringNodes);
  }

  // Place a node so its center sits at (cos(angle), sin(angle)) * radius
  _polarToPosition(radius, angle) {
    return {
      x: Math.cos(angle) * radius - TECH_TREE.NODE_W / 2,
      y: Math.sin(angle) * radius - TECH_TREE.NODE_H / 2,
    };
  }

  // Category bias: each cardinal sector prefers a category
  // weapon near top (-π/2), defense near right (0), utility near bottom (π/2), passive near left (π)
  _pickCategoryForAngle(angle, ring, rng, unlockedCounts, ringSoFar) {
    const baseWeights = getCategoryWeights(ring, unlockedCounts);

    const sectorPref = this._categoryForSector(angle);
    if (sectorPref && baseWeights[sectorPref] != null) {
      baseWeights[sectorPref] = Math.floor(baseWeights[sectorPref] * 2.5);
    }

    // Limit specials to 1 per ring
    const hasSpecial = ringSoFar.some(id => this._generatedNodes[id]?.category === 'special');
    if (hasSpecial) baseWeights.special = 0;

    return weightedPick(baseWeights, rng);
  }

  _categoryForSector(angle) {
    // Divide the circle into 4 quadrants centered on each cardinal anchor.
    // weapon centered at -π/2, defense at 0, utility at π/2, passive at π.
    const a = normAngle(angle);
    // Shift so weapon sector starts at 0
    const shifted = normAngle(a + Math.PI / 2 + Math.PI / 4); // now weapon is [0, π/2)
    const sector = Math.floor(shifted / (Math.PI / 2));
    return ['weapon', 'defense', 'utility', 'passive'][sector];
  }

  // Find the index in `angles` whose value is closest to `target`, optionally skipping an index
  _closestAngleIndex(target, angles, skipIdx = -1) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < angles.length; i++) {
      if (i === skipIdx) continue;
      const d = angularDist(target, angles[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx === -1 ? 0 : bestIdx;
  }

  _createNode(ring, idx, template, category, position) {
    const id = `node_${ring}_${idx}`;

    // Scale costs with ring (every 2 rings = 2x more expensive)
    const costScale = Math.pow(TECH_TREE.COST_SCALING_BASE, Math.floor(ring / 2));
    const scaledCost = Object.fromEntries(
      Object.entries(template.baseCost).map(([k, v]) => [k, Math.ceil(v * costScale)])
    );

    // Slight effect bonus at deeper rings
    const tierBonus = 1 + TECH_TREE.EFFECT_TIER_BONUS * ring;
    const scaledEffects = template.effects.map(e => {
      if (e.type === 'multiply') {
        const scaledVal = 1 + (e.value - 1) * tierBonus;
        return { ...e, value: parseFloat(scaledVal.toFixed(4)) };
      } else if (e.type === 'add') {
        return { ...e, value: parseFloat((e.value * tierBonus).toFixed(3)) };
      }
      return { ...e };
    });

    // Milestone: every 10th ring gets a dramatically enhanced first node
    let name = template.name;
    let description = template.description;
    if (ring > 0 && ring % 10 === 0 && idx === 0) {
      name = `⚡ ${name} [ENHANCED]`;
      description = `[MILESTONE] ${description}`;
      scaledEffects.forEach(e => {
        if (e.type === 'add') e.value *= 2;
        else if (e.type === 'multiply') e.value = 1 + (e.value - 1) * 2;
      });
    }

    const node = new TechNode({
      id,
      tier: ring,
      name,
      description,
      category,
      effects: scaledEffects,
      maxLevel: template.maxLevel,
      currentLevel: 0,
      baseCost: scaledCost,
      prerequisites: [],
      position,
      icon: template.icon,
    });

    this._generatedNodes[id] = node;
    return node;
  }

  // No-op: positions are authoritative at creation time in circular layout
  repositionTier(_ring) { /* intentionally empty */ }

  get nodes() { return this._generatedNodes; }
  get tiers() { return this._tiers; }

  getNode(id) { return this._generatedNodes[id]; }
  getNodesForTier(ring) { return (this._tiers[ring] || []).map(id => this._generatedNodes[id]).filter(Boolean); }
  getMaxGeneratedTier() { return this._tiers.length - 1; }
}
