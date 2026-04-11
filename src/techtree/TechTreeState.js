import { TechTreeGenerator } from './TechTreeGenerator.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

// How many tiers ahead of the player's frontier to pre-generate
const LOOK_AHEAD_TIERS = 3;

export class TechTreeState {
  constructor(seed) {
    this._generator = new TechTreeGenerator(seed);
    this._unlocked = {};      // nodeId -> currentLevel
    this._frontier = 0;       // highest tier with any unlocked node
    this._unlockedCounts = {};// category -> count

    // Generate initial tiers
    this._generator.generateUpToTier(LOOK_AHEAD_TIERS, this._unlockedCounts);
    for (let t = 0; t <= LOOK_AHEAD_TIERS; t++) {
      this._generator.repositionTier(t);
    }
  }

  // Restore from saved state
  loadFromSave(savedUnlocked, generatedTiers) {
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

  _arePrerequisitesMet(node) {
    // Ring 0 (starter nodes) are always reachable — they're the entry points
    // into the tree and may have visual lateral connections to other starters.
    if (node.tier === 0) return true;
    if (!node.prerequisites || node.prerequisites.length === 0) return true;
    // Path-of-Exile style: available if ANY connected node is unlocked
    return node.prerequisites.some(prereqId => {
      const prereq = this._generator.getNode(prereqId);
      return prereq && prereq.isUnlocked;
    });
  }

  isAvailable(nodeId) {
    const node = this._generator.getNode(nodeId);
    if (!node || node.isMaxed) return false;
    return this._arePrerequisitesMet(node);
  }

  // Get all nodes up to the currently visible frontier + buffer
  getVisibleNodes() {
    const maxTier = this._generator.getMaxGeneratedTier();
    const nodes = [];
    for (let t = 0; t <= maxTier; t++) {
      nodes.push(...this._generator.getNodesForTier(t));
    }
    return nodes;
  }

  // Get serializable save data
  getSaveData() {
    return {
      unlockedNodes: { ...this._unlocked },
      generatedTiers: this._generator.getMaxGeneratedTier(),
    };
  }

  get generator() { return this._generator; }
  get frontier() { return this._frontier; }
  get unlockedCounts() { return this._unlockedCounts; }
}
