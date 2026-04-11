import { TechNode } from './TechNode.js';
import { NODE_TEMPLATES, CATEGORY_META, getCategoryWeights } from './TechNodeTemplates.js';
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

// Tier 0 is a single root node: only scrap drops reliably before mid-game (see EnemyFactory).
function isScrapOnlyTemplate(template) {
  const keys = Object.keys(template.baseCost);
  return keys.length > 0 && keys.every((k) => k === 'scrapMetal');
}

function filterTier0TemplatePool(pool) {
  const scrapOnly = pool.filter(isScrapOnlyTemplate);
  return scrapOnly.length > 0 ? scrapOnly : pool;
}

export class TechTreeGenerator {
  constructor(baseSeed) {
    this._baseSeed = baseSeed;
    this._generatedNodes = {}; // nodeId -> TechNode
    this._tiers = [];          // tiers[i] = [nodeId, ...]
  }

  // Generate all tiers up to (and including) the given tier
  generateUpToTier(targetTier, unlockedCounts = {}) {
    const startTier = this._tiers.length;
    for (let tier = startTier; tier <= targetTier; tier++) {
      this._generateTier(tier, unlockedCounts);
    }
    return this._generatedNodes;
  }

  _generateTier(tier, unlockedCounts) {
    const rng = makePRNG(this._baseSeed + tier * TECH_TREE.TIER_PRIME);

    // Determine node count
    let count;
    if (tier < TECH_TREE.ROOT_TIER_COUNTS.length) {
      count = TECH_TREE.ROOT_TIER_COUNTS[tier];
    } else {
      count = TECH_TREE.MIN_NODES_PER_TIER + Math.floor(rng() * (TECH_TREE.MAX_NODES_PER_TIER - TECH_TREE.MIN_NODES_PER_TIER + 1));
    }

    const prevTier = this._tiers[tier - 1] || [];
    const tierNodes = [];
    const usedTemplateIds = new Set();

    // Anti-monotony: ensure at least 1 weapon and 1 defense after tier 0
    const requiredCategories = tier >= 1
      ? [null, null]    // filled in as we go
      : [];

    for (let idx = 0; idx < count; idx++) {
      // Category selection
      const weights = getCategoryWeights(tier, unlockedCounts);

      // Force weapon/defense variety
      if (tier >= 1) {
        const hasWeapon = tierNodes.some(id => this._generatedNodes[id]?.category === 'weapon');
        const hasDefense = tierNodes.some(id => this._generatedNodes[id]?.category === 'defense');
        const remaining = count - idx;

        if (!hasWeapon && remaining <= (count - idx)) {
          // Only enough spots left to force weapon+defense
          if (!hasWeapon && !hasDefense && remaining === 2) {
            weights['weapon'] = 100;
            for (const k of Object.keys(weights)) if (k !== 'weapon') weights[k] = 0;
          }
        }
        if (!hasDefense && remaining === 1 && !hasWeapon) {
          weights['defense'] = 100;
          for (const k of Object.keys(weights)) if (k !== 'defense') weights[k] = 0;
        }

        // Limit specials to 1 per tier
        const hasSpecial = tierNodes.some(id => this._generatedNodes[id]?.category === 'special');
        if (hasSpecial) weights['special'] = 0;
      }

      const category = weightedPick(weights, rng);

      // Pick template (avoid duplicates within this tier)
      let pool = NODE_TEMPLATES[category].filter(t => !usedTemplateIds.has(t.id));
      if (tier === 0) {
        pool = filterTier0TemplatePool(pool);
      }
      if (pool.length === 0) {
        // Fall back to any template
        let fallbacks = NODE_TEMPLATES[category];
        if (tier === 0) {
          fallbacks = filterTier0TemplatePool(fallbacks);
        }
        const fallback = pickRandom(fallbacks.length > 0 ? fallbacks : NODE_TEMPLATES[category], rng);
        this._createNode(tier, idx, fallback, category, rng, prevTier, tierNodes, unlockedCounts);
        usedTemplateIds.add(fallback.id);
      } else {
        const template = pickRandom(pool, rng);
        this._createNode(tier, idx, template, category, rng, prevTier, tierNodes, unlockedCounts);
        usedTemplateIds.add(template.id);
      }
    }

    this._tiers.push(tierNodes);
  }

  _createNode(tier, idx, template, category, rng, prevTier, tierNodes, unlockedCounts) {
    const id = `node_${tier}_${idx}`;

    // Scale costs with tier
    const costScale = Math.pow(TECH_TREE.COST_SCALING_BASE, Math.floor(tier / 2));
    const scaledCost = Object.fromEntries(
      Object.entries(template.baseCost).map(([k, v]) => [k, Math.ceil(v * costScale)])
    );

    // Scale effect values with tier (slight bonus at higher tiers)
    const tierBonus = 1 + TECH_TREE.EFFECT_TIER_BONUS * tier;
    const scaledEffects = template.effects.map(e => {
      if (e.type === 'multiply') {
        // Slightly stronger multiplier at higher tiers
        const scaledVal = 1 + (e.value - 1) * tierBonus;
        return { ...e, value: parseFloat(scaledVal.toFixed(4)) };
      } else if (e.type === 'add') {
        return { ...e, value: parseFloat((e.value * tierBonus).toFixed(3)) };
      }
      return { ...e };
    });

    // Milestone node every 10 tiers
    let name = template.name;
    let description = template.description;
    if (tier > 0 && tier % 10 === 0 && idx === 0) {
      name = `⚡ ${name} [ENHANCED]`;
      description = `[MILESTONE] ${description}`;
      // Double effect
      scaledEffects.forEach(e => {
        if (e.type === 'add') e.value *= 2;
        else if (e.type === 'multiply') e.value = 1 + (e.value - 1) * 2;
      });
    }

    // Assign prerequisites from previous tier
    const prereqs = this._assignPrerequisites(tier, idx, prevTier, rng);

    // Layout position
    const nodeWidth = TECH_TREE.NODE_W + TECH_TREE.NODE_PADDING_X;
    const nodeHeight = TECH_TREE.NODE_H + TECH_TREE.NODE_PADDING_Y;
    // Count nodes in this tier (approximate, we're building incrementally)
    const tierCount = tierNodes.length + 1;
    const position = {
      x: TECH_TREE.GRID_OFFSET_X + idx * nodeWidth,
      y: TECH_TREE.GRID_OFFSET_Y + tier * nodeHeight,
    };

    const node = new TechNode({
      id,
      tier,
      name,
      description,
      category,
      effects: scaledEffects,
      maxLevel: template.maxLevel,
      currentLevel: 0,
      baseCost: scaledCost,
      prerequisites: prereqs,
      position,
      icon: template.icon,
    });

    this._generatedNodes[id] = node;
    tierNodes.push(id);

    // Update unlockedCounts tracking for variety
    if (!unlockedCounts[category]) unlockedCounts[category] = 0;

    return node;
  }

  _assignPrerequisites(tier, nodeIdx, prevTier, rng) {
    if (tier === 0 || prevTier.length === 0) return [];

    // Connect to 1-2 nodes from previous tier
    const maxPrereqs = Math.min(2, prevTier.length);
    const numPrereqs = 1 + (rng() < 0.3 ? 1 : 0);
    const actual = Math.min(numPrereqs, maxPrereqs);

    // Pick a "primary" prerequisite: roughly aligned by position
    const normalized = nodeIdx / Math.max(1, 3);
    const targetIdx = Math.floor(normalized * prevTier.length);
    const clamped = Math.max(0, Math.min(prevTier.length - 1, targetIdx));
    const prereqs = [prevTier[clamped]];

    // Optionally add a second
    if (actual === 2) {
      const otherIdx = clamped === 0 ? 1 : clamped - 1;
      if (otherIdx < prevTier.length) {
        prereqs.push(prevTier[otherIdx]);
      }
    }

    return prereqs;
  }

  // Recalculate node positions after a tier is fully built
  repositionTier(tier) {
    const tierNodes = this._tiers[tier];
    if (!tierNodes) return;
    const count = tierNodes.length;
    const nodeWidth = TECH_TREE.NODE_W + TECH_TREE.NODE_PADDING_X;
    const nodeHeight = TECH_TREE.NODE_H + TECH_TREE.NODE_PADDING_Y;
    const totalWidth = (count - 1) * nodeWidth;

    tierNodes.forEach((id, idx) => {
      const node = this._generatedNodes[id];
      if (node) {
        node.position.x = TECH_TREE.GRID_OFFSET_X + idx * nodeWidth;
        node.position.y = TECH_TREE.GRID_OFFSET_Y + tier * nodeHeight;
      }
    });
  }

  get nodes() { return this._generatedNodes; }
  get tiers() { return this._tiers; }

  getNode(id) { return this._generatedNodes[id]; }
  getNodesForTier(tier) { return (this._tiers[tier] || []).map(id => this._generatedNodes[id]).filter(Boolean); }
  getMaxGeneratedTier() { return this._tiers.length - 1; }
}
