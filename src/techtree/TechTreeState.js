import { TechTreeGenerator } from './TechTreeGenerator.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { TECH_TREE } from '../constants.js';
import upgradesData from '../data/upgrades.json';

// How many tiers ahead of the player's frontier to pre-generate
const LOOK_AHEAD_TIERS = 3;

export class TechTreeState {
  constructor(seed) {
    this._seed = seed;
    this._generator = new TechTreeGenerator(seed);
    this._unlocked = {};      // nodeId -> currentLevel
    this._masteryLevels = {}; // nodeId -> masteryLevel
    this._frontier = 0;       // highest tier with any unlocked node
    this._unlockedCounts = {};// category -> count
    this._devExtraNodes = []; // nodes added at runtime via the upgrade editor

    // Generate initial tiers
    this._generator.generateUpToTier(LOOK_AHEAD_TIERS, this._unlockedCounts);
    for (let t = 0; t <= LOOK_AHEAD_TIERS; t++) {
      this._generator.repositionTier(t);
    }
  }

  // Restore from saved state
  loadFromSave(savedUnlocked, generatedTiers, savedMastery = {}) {
    // Re-generate up to saved depth
    if (generatedTiers > LOOK_AHEAD_TIERS) {
      this._generator.generateUpToTier(generatedTiers + LOOK_AHEAD_TIERS, this._unlockedCounts);
    }

    // Restore unlocked state
    for (const [nodeId, level] of Object.entries(savedUnlocked)) {
      const node = this._generator.getNode(nodeId);
      if (node) {
        node.currentLevel = level;
        this._unlocked[nodeId] = level;
        const cat = node.category;
        this._unlockedCounts[cat] = (this._unlockedCounts[cat] || 0) + level;
        this._frontier = Math.max(this._frontier, node.tier);
      }
    }

    // Restore mastery levels
    for (const [nodeId, level] of Object.entries(savedMastery)) {
      const node = this._generator.getNode(nodeId);
      if (node?.isMaxed) {
        node.masteryLevel = level;
        this._masteryLevels[nodeId] = level;
      }
    }

    // Reposition all generated tiers
    for (let t = 0; t <= this._generator.getMaxGeneratedTier(); t++) {
      this._generator.repositionTier(t);
    }
  }

  // Attempt to unlock/upgrade a node. Returns true if successful.
  purchase(nodeId, currencySystem) {
    const node = this._generator.getNode(nodeId);
    if (!node) return false;
    if (node.isMaxed) return false;
    if (!this._arePrerequisitesMet(node)) return false;

    const cost = node.getCostForNextLevel();
    if (!currencySystem.canAfford(cost)) return false;

    currencySystem.subtract(cost);
    node.currentLevel++;
    this._unlocked[nodeId] = node.currentLevel;

    const cat = node.category;
    this._unlockedCounts[cat] = (this._unlockedCounts[cat] || 0) + 1;

    if (node.tier > this._frontier) {
      this._frontier = node.tier;
    }

    // Lazy-generate new tiers
    const targetTier = this._frontier + LOOK_AHEAD_TIERS;
    if (targetTier > this._generator.getMaxGeneratedTier()) {
      this._generator.generateUpToTier(targetTier, this._unlockedCounts);
      for (let t = this._generator.getMaxGeneratedTier() - LOOK_AHEAD_TIERS; t <= targetTier; t++) {
        this._generator.repositionTier(t);
      }
    }

    eventBus.emit(EVENTS.UPGRADE_PURCHASED, { nodeId, level: node.currentLevel });
    return true;
  }

  _recomputeFrontier() {
    let max = 0;
    for (const n of Object.values(this._generator.nodes)) {
      if (n.currentLevel > 0 && n.tier > max) max = n.tier;
    }
    this._frontier = max;
  }

  /**
   * True if one level can be sold without leaving another owned node missing prerequisites.
   */
  canSellOneLevel(nodeId) {
    const node = this._generator.getNode(nodeId);
    if (!node || node.currentLevel <= 0) return false;

    const newLevel = node.currentLevel - 1;
    const saved = node.currentLevel;
    node.currentLevel = newLevel;
    try {
      for (const n of Object.values(this._generator.nodes)) {
        if (n.id === nodeId) continue;
        if (n.currentLevel <= 0) continue;
        if (!this._arePrerequisitesMet(n)) return false;
      }
      return true;
    } finally {
      node.currentLevel = saved;
    }
  }

  /**
   * Sell one level from a node for a partial refund. Returns false if not allowed.
   */
  sellOneLevel(nodeId, currencySystem) {
    if (!this.canSellOneLevel(nodeId)) return false;

    const node = this._generator.getNode(nodeId);
    const topLevel = node.currentLevel;
    const paid = node.getHistoricalCostForLevel(topLevel);
    const ratio = TECH_TREE.SELL_REFUND_FRACTION;
    const refund = Object.fromEntries(
      Object.entries(paid)
        .map(([k, v]) => [k, Math.floor(v * ratio)])
        .filter(([, v]) => v > 0)
    );

    node.currentLevel--;
    if (node.currentLevel <= 0) {
      delete this._unlocked[nodeId];
    } else {
      this._unlocked[nodeId] = node.currentLevel;
    }

    const cat = node.category;
    this._unlockedCounts[cat] = Math.max(0, (this._unlockedCounts[cat] || 0) - 1);

    this._recomputeFrontier();
    currencySystem.addCosts(refund);

    eventBus.emit(EVENTS.UPGRADE_SOLD, { nodeId, level: node.currentLevel, refund });
    return true;
  }

  /** Every listed prerequisite node has been bought at least once. */
  _allPrerequisitesUnlocked(node) {
    if (!node.prerequisites || node.prerequisites.length === 0) return true;
    return node.prerequisites.every(prereqId => {
      const prereq = this._generator.getNode(prereqId);
      return prereq && prereq.isUnlocked;
    });
  }

  /**
   * Specials stay off the tree until both adjacent branch prereqs are unlocked;
   * once owned, they stay visible.
   */
  _isSpecialRevealed(node) {
    if (node.category !== 'special') return true;
    if (node.isUnlocked) return true;
    return this._allPrerequisitesUnlocked(node);
  }

  _arePrerequisitesMet(node) {
    // Ring 0 (starter nodes) are always reachable — they're the entry points
    // into the tree (lateral starter links exist in data but are not drawn).
    if (node.tier === 0) return true;
    if (!node.prerequisites || node.prerequisites.length === 0) return true;
    // Specials: require both adjacent branch connectors (AND).
    if (node.category === 'special') {
      return this._allPrerequisitesUnlocked(node);
    }
    // Main branches: Path-of-Exile style — ANY connected prerequisite unlocks access
    return node.prerequisites.some(prereqId => {
      const prereq = this._generator.getNode(prereqId);
      return prereq && prereq.isUnlocked;
    });
  }

  isAvailable(nodeId) {
    const node = this._generator.getNode(nodeId);
    if (!node || node.isMaxed) return false;
    if (!this._isSpecialRevealed(node)) return false;
    return this._arePrerequisitesMet(node);
  }

  // Get all nodes up to the currently visible frontier + buffer
  getVisibleNodes() {
    const maxTier = this._generator.getMaxGeneratedTier();
    const nodes = [];
    for (let t = 0; t <= maxTier; t++) {
      for (const n of this._generator.getNodesForTier(t)) {
        if (!this._isSpecialRevealed(n)) continue;
        nodes.push(n);
      }
    }
    return nodes;
  }

  purchaseMastery(nodeId, currencySystem) {
    const node = this._generator.getNode(nodeId);
    if (!node?.canMastery) return false;
    const cost = node.getMasteryCost();
    if (!currencySystem.canAfford(cost)) return false;
    currencySystem.subtract(cost);
    node.masteryLevel++;
    this._masteryLevels[nodeId] = node.masteryLevel;
    eventBus.emit(EVENTS.MASTERY_PURCHASED, { nodeId, masteryLevel: node.masteryLevel, source: 'techtree' });
    return true;
  }

  // Get serializable save data
  getSaveData() {
    return {
      unlockedNodes: { ...this._unlocked },
      generatedTiers: this._generator.getMaxGeneratedTier(),
      masteryLevels: { ...this._masteryLevels },
    };
  }

  /**
   * [DEV] Add a node at runtime and rebuild the generator so it appears in the tree.
   * Called by the in-game UpgradeEditor. Safe to call multiple times.
   */
  addDevNode(nodeData) {
    this._devExtraNodes.push(nodeData);
    this._rebuildGenerator();
  }

  /** [DEV] Replace an existing node (base or dev-added) with updated data. */
  updateDevNode(id, nodeData) {
    const idx = this._devExtraNodes.findIndex(n => n.id === id);
    if (idx !== -1) {
      this._devExtraNodes[idx] = nodeData;
    } else {
      // Base node — promote to dev layer so it overrides the original
      this._devExtraNodes.push(nodeData);
    }
    this._rebuildGenerator();
  }

  _rebuildGenerator() {
    // Snapshot current unlock levels (node IDs are stable templateIds)
    const savedLevels = { ...this._unlocked };

    // Dev extras override base nodes with the same ID
    const devIds = new Set(this._devExtraNodes.map(n => n.id));
    const allNodes = [...upgradesData.nodes.filter(n => !devIds.has(n.id)), ...this._devExtraNodes];
    this._generator = new TechTreeGenerator(this._seed, allNodes);
    this._generator.generateUpToTier(999);

    // Restore unlock state onto the new node instances
    const savedMastery = { ...this._masteryLevels };
    this._unlocked = {};
    this._masteryLevels = {};
    this._unlockedCounts = {};
    this._frontier = 0;
    for (const [id, level] of Object.entries(savedLevels)) {
      const node = this._generator.getNode(id);
      if (node) {
        node.currentLevel = level;
        this._unlocked[id] = level;
        this._unlockedCounts[node.category] = (this._unlockedCounts[node.category] || 0) + level;
        if (node.tier > this._frontier) this._frontier = node.tier;
        if (savedMastery[id] && node.isMaxed) {
          node.masteryLevel = savedMastery[id];
          this._masteryLevels[id] = savedMastery[id];
        }
      }
    }
  }

  get generator() { return this._generator; }
  get frontier() { return this._frontier; }
  get unlockedCounts() { return this._unlockedCounts; }
  get devExtraNodes() { return this._devExtraNodes; }
}
