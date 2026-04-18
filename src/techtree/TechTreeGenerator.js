import { TechNode } from './TechNode.js';
import upgradesData from '../data/upgrades.json';
import { TECH_TREE } from '../constants.js';

// Ring 0 starter anchors: cardinal positions, one per non-special category.
// Top=weapon, Right=defense, Bottom=utility, Left=passive.
const STARTER_ANCHORS = [
  { category: 'weapon',  angle: -Math.PI / 2 },   // top
  { category: 'defense', angle: 0 },              // right
  { category: 'utility', angle: Math.PI / 2 },    // bottom
  { category: 'passive', angle: Math.PI },        // left
];

const ADJACENT_PAIR_KEYS = new Set([
  'weapon|defense', 'defense|weapon',
  'defense|utility', 'utility|defense',
  'utility|passive', 'passive|utility',
  'passive|weapon', 'weapon|passive',
]);

function areAdjacentCategories(a, b) {
  return ADJACENT_PAIR_KEYS.has(`${a}|${b}`);
}

function angleMidpointBetweenCategories(catA, catB) {
  const ax = STARTER_ANCHORS.find((x) => x.category === catA)?.angle ?? 0;
  const bx = STARTER_ANCHORS.find((x) => x.category === catB)?.angle ?? 0;
  const vx = Math.cos(ax) + Math.cos(bx);
  const vy = Math.sin(ax) + Math.sin(bx);
  if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) return ax;
  return Math.atan2(vy, vx);
}

/** Canonical edge keys between adjacent starters (fixed order for placement). */
const DIAGONAL_KEYS = ['weapon|defense', 'defense|utility', 'utility|passive', 'passive|weapon'];

function canonicalDiagonalKey(catA, catB) {
  if (!catA || !catB || !areAdjacentCategories(catA, catB)) return null;
  const pair = `${catA}|${catB}`;
  const rev = `${catB}|${catA}`;
  if (DIAGONAL_KEYS.includes(pair)) return pair;
  if (DIAGONAL_KEYS.includes(rev)) return rev;
  return null;
}

/** Mid-angle + branch endpoints for each inter-cardinal gap (special "diagonals"). */
const DIAGONAL_SPECS = DIAGONAL_KEYS.map((key) => {
  const [c1, c2] = key.split('|');
  return {
    key,
    c1,
    c2,
    angle: angleMidpointBetweenCategories(c1, c2),
  };
});

/** Evenly space `count` angles across [anchor − slice/2, anchor + slice/2]. */
function anglesInBranchSlice(anchorAngle, count, sliceRad) {
  if (count <= 0) return [];
  const half = sliceRad / 2;
  const lo = anchorAngle - half;
  if (count === 1) return [anchorAngle];
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    out.push(lo + t * sliceRad);
  }
  return out;
}

export class TechTreeGenerator {
  /**
   * @param {*} _baseSeed   unused (kept for API compat)
   * @param {object[]|null} customNodes  override the full node list (e.g. with dev extras)
   */
  constructor(_baseSeed, customNodes = null) {
    this._customNodes = customNodes; // null → use upgradesData.nodes
    this._generatedNodes = {}; // nodeId -> TechNode
    this._tiers = [];          // tiers[ring] = [nodeId, ...]
    this._angles = {};         // nodeId -> angle on its ring
    this._built = false;
  }

  /** Build all nodes (finite tree). No-op after the first call. */
  generateUpToTier(_targetRing, _unlockedCounts = {}) {
    if (!this._built) {
      this._buildAllNodes();
      this._built = true;
    }
    return this._generatedNodes;
  }

  // ─── Private: two-pass finite builder ──────────────────────────────────────

  _buildAllNodes() {
    // Flatten all nodes from JSON (or custom override) into a map: id -> { template, category }
    const sourceNodes = this._customNodes ?? upgradesData.nodes;
    const flatTemplates = {};
    for (const node of sourceNodes) {
      flatTemplates[node.id] = { template: node, category: node.category };
    }

    // Pass 1: compute ring for every template via topological recursion
    const ringMap = this._computeRings(flatTemplates);
    const maxRing = Math.max(...Object.values(ringMap));

    // Initialize tiers array
    for (let r = 0; r <= maxRing; r++) {
      this._tiers.push([]);
    }

    // Group template IDs by (ring, category)
    const groups = {}; // groups[ring][category] = [templateId, ...]
    for (const [id, { category }] of Object.entries(flatTemplates)) {
      const ring = ringMap[id];
      if (!groups[ring]) groups[ring] = {};
      if (!groups[ring][category]) groups[ring][category] = [];
      groups[ring][category].push(id);
    }

    // Pass 2: create nodes ring by ring
    for (let r = 0; r <= maxRing; r++) {
      const radius = TECH_TREE.CENTER_RADIUS + r * TECH_TREE.RING_SPACING;
      const sliceRad = TECH_TREE.BRANCH_SLICE_RAD;

      // Main branch categories
      for (const anchor of STARTER_ANCHORS) {
        const cat = anchor.category;
        const ids = (groups[r]?.[cat]) || [];
        const angles = anglesInBranchSlice(anchor.angle, ids.length, sliceRad);
        ids.forEach((id, s) => {
          const { template } = flatTemplates[id];
          const position = this._polarToPosition(radius, angles[s]);
          this._createNode(r, template, cat, position);
          this._angles[id] = angles[s];
        });
      }

      // Special nodes: group by diagonal, then spread within that diagonal's arc
      const specialIds = (groups[r]?.['special']) || [];
      if (specialIds.length > 0) {
        // Bucket specials by diagonal key
        const diagBuckets = {};
        for (const id of specialIds) {
          const { template } = flatTemplates[id];
          const [a, b] = template.betweenCategories || [];
          const key = canonicalDiagonalKey(a, b);
          if (!diagBuckets[key]) diagBuckets[key] = [];
          diagBuckets[key].push(id);
        }
        for (const spec of DIAGONAL_SPECS) {
          const bucket = diagBuckets[spec.key] || [];
          const angles = anglesInBranchSlice(spec.angle, bucket.length, sliceRad);
          bucket.forEach((id, s) => {
            const { template } = flatTemplates[id];
            const position = this._polarToPosition(radius, angles[s]);
            this._createNode(r, template, 'special', position);
            this._angles[id] = angles[s];
          });
        }
      }
    }

    // Connect neighboring starters laterally (so the hub feels connected)
    const starterIds = STARTER_ANCHORS.map(a => `starter_${a.category}`);
    for (let i = 0; i < starterIds.length; i++) {
      const nextI = (i + 1) % starterIds.length;
      const a = this._generatedNodes[starterIds[i]];
      const b = this._generatedNodes[starterIds[nextI]];
      if (a && b) {
        if (!a.prerequisites.includes(b.id)) a.prerequisites.push(b.id);
        if (!b.prerequisites.includes(a.id)) b.prerequisites.push(a.id);
      }
    }
  }

  /** Compute ring for every template via memoized topological recursion. */
  _computeRings(flatTemplates) {
    const rings = {};
    const getRing = (id) => {
      if (id in rings) return rings[id];
      const entry = flatTemplates[id];
      const prereqs = entry?.template?.prereqs;
      if (!prereqs?.length) return (rings[id] = 0);
      return (rings[id] = Math.max(...prereqs.map(getRing)) + 1);
    };
    for (const id of Object.keys(flatTemplates)) getRing(id);
    return rings;
  }

  // ─── Node creation ──────────────────────────────────────────────────────────

  _createNode(ring, template, category, position) {
    const id = template.id; // stable templateId as node ID

    // Scale costs with ring (every 2 rings = 2x more expensive)
    const costScale = Math.pow(TECH_TREE.COST_SCALING_BASE, Math.floor(ring / 2));
    const scaledCost = Object.fromEntries(
      Object.entries(template.baseCost).map(([k, v]) => [k, Math.ceil(v * costScale)])
    );

    // Operators that should not be scaled by ring depth
    const FIXED_OPS = new Set(['min', 'max', 'append', 'toggle', 'add_flat', 'set', 'special', 'add_weapon']);

    // Slight effect bonus at deeper rings
    const tierBonus = 1 + TECH_TREE.EFFECT_TIER_BONUS * ring;
    const scaledEffects = template.effects.map(e => {
      if (FIXED_OPS.has(e.type)) return { ...e };
      if (e.type === 'multiply') {
        const scaledVal = 1 + (e.value - 1) * tierBonus;
        return { ...e, value: parseFloat(scaledVal.toFixed(4)) };
      } else if (e.type === 'add') {
        return { ...e, value: parseFloat((e.value * tierBonus).toFixed(3)) };
      }
      return { ...e };
    });

    // Milestone: every 10th ring, weapon-branch center node is dramatically enhanced
    let name = template.name;
    let description = template.description;
    const isMilestoneSlot = category === 'weapon' && ring > 0 && ring % 10 === 0;
    if (isMilestoneSlot) {
      name = `⚡ ${name} [ENHANCED]`;
      description = `[MILESTONE] ${description}`;
      scaledEffects.forEach(e => {
        if (e.type === 'add') e.value *= 2;
        else if (e.type === 'multiply') e.value = 1 + (e.value - 1) * 2;
      });
    }

    const node = new TechNode({
      id,
      templateId: template.id,
      tier: ring,
      name,
      description,
      category,
      effects: scaledEffects,
      maxLevel: template.maxLevel,
      currentLevel: 0,
      baseCost: scaledCost,
      prerequisites: template.prereqs ? [...template.prereqs] : [],
      position,
      icon: template.icon,
      triggers: template.triggers || [],
      synergies: template.synergies || [],
      presentation: template.presentation || null,
      costModifiers: template.costModifiers || [],
      visual: template.visual || null,
    });

    this._generatedNodes[id] = node;
    this._tiers[ring].push(id);
    return node;
  }

  // Place a node so its center sits at (cos(angle), sin(angle)) * radius
  _polarToPosition(radius, angle) {
    return {
      x: Math.cos(angle) * radius - TECH_TREE.NODE_W / 2,
      y: Math.sin(angle) * radius - TECH_TREE.NODE_H / 2,
    };
  }

  // No-op: positions are authoritative at creation time in circular layout
  repositionTier(_ring) { /* intentionally empty */ }

  get nodes() { return this._generatedNodes; }
  get tiers() { return this._tiers; }
  get categoryMeta() { return upgradesData.categories; }

  getNode(id) { return this._generatedNodes[id]; }
  getNodesForTier(ring) { return (this._tiers[ring] || []).map(id => this._generatedNodes[id]).filter(Boolean); }
  getMaxGeneratedTier() { return this._tiers.length - 1; }
}
