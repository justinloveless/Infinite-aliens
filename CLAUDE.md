# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server (localhost:5173)
npm run build    # production build → dist/
npm run preview  # serve the production build locally
```

No test or lint tooling is configured.

## Architecture Overview

**Infinite Aliens** is a Three.js roguelike idle game bundled with Vite. `src/main.js` is the single orchestrator — it instantiates every system, wires them together, and owns the game loop. There is no framework, no state management library; communication between systems goes through a global singleton pub/sub `eventBus` (`src/core/EventBus.js`).

### Entity-Component-System (ECS)

**Game objects are Entities. Behavior + data live in Components. Systems only orchestrate.** Always prefer adding a new component over stuffing logic into a system, prefab, or global helper.

Core primitives (`src/ecs/`):
- `Entity` — a thin bag of components + tags. No domain logic. `entity.add(component)`, `entity.get('ComponentName')`, `entity.destroy()`.
- `Component` — base class. Owns its own data, meshes, and event subscriptions. Lifecycle: `onAttach(ctx)` / `onDetach()` / `update(dt, ctx)` (all optional). Use `this.listen(EVENT, fn)` for subscriptions that auto-unsubscribe on detach.
- `World` — holds entities, drives per-frame `update`, sweeps destroyed entities, exposes `ctx` (settings, state, scene, renderer).

Conventions:
- **One responsibility per component.** `HealthComponent` holds HP. `ShieldComponent` holds shields. `RegenComponent` ticks regen. Don't merge these — composition beats inheritance.
- **File layout.** Put components under `src/components/<domain>/<Name>Component.js` (domains: `core`, `player`, `ships`, `weapons`, `health`, `enemy`, `projectile`, `aoe`, `world`, `abilities`).
- **Naming.** Always suffix `Component`. `class FooComponent extends Component`. The `componentName` is the class name unless overridden (override to share a key across a subclass family — see ships below).
- **Lifecycle discipline.** Every THREE object / event subscription / DOM element created in `onAttach` must be torn down in `onDetach`. Leaks here cause memory bloat across ship switches and respawns.
- **Prefabs, not factories.** `src/prefabs/createX.js` files only compose components onto entities. They do not hold game logic. If you find yourself writing behavior in a prefab, move it into a component.
- **When in doubt, add a component.** New ability/buff/visual/ship/enemy-variant = new component class. A "system" in this codebase is just a thin coordinator (`CombatSystem`, `RoundSystem`) that calls into components.

Ship components (`src/components/ships/`) are a concrete example of the pattern: each purchasable ship is its own `ShipComponent` subclass holding its identity, base stats, slot layout, mesh, and per-frame hooks. `ShipRegistry.js` is the lookup; `src/data/ships.js` is a thin facade over the registry for legacy POJO consumers.

### Game Loop & Phase State

`GameLoop` drives a `requestAnimationFrame` tick. The game is always in one of three phases stored in `state.round.phase`:
- `'start'` — initial splash
- `'combat'` — active run; enemies spawn, distance accumulates, tier increases
- `'dead'` — hangar between runs; tech tree accessible, currencies persist

Difficulty is continuous: `distanceTraveled` (units moved) maps to `tier = 1 + floor(distance / RUN.DISTANCE_PER_TIER)`. Enemies are constructed with the current tier and scale their HP/damage/speed from that value.

### State & Persistence

`createInitialState()` (`src/core/GameState.js`) defines the canonical shape. `SaveManager` serializes the whole state + tech tree to `localStorage` under `infinite_aliens_save` every 30 s and on upgrade buy/sell. **Always bump `GAME.VERSION` in `constants.js` and add a migration block in `SaveManager.load()` when the save shape changes** — existing migration stubs show the pattern.

`computed` stats are rebuilt from scratch by `UpgradeSystem.compute()` every time an upgrade is purchased; they are never saved directly.

### Upgrade Grammar

All upgrade data lives in `src/data/upgrades.json`. Each upgrade node declares `effects[]`, each with:
- `type` — one of `multiply | add | add_flat | set | toggle | add_weapon | append | min | max | special`
- `stat` — the `computed` field to modify (or `'typeKey.fieldKey'` for enemy modifiers when `target: 'enemy'`)
- `value` — scaled by level via `scaleMode` (`linear | exponential | fixed | diminishing`)
- `target` — defaults to `'player'`; use `'enemy'` to modify `computed.enemyModifiers`

`UpgradeSystem._applyEffect()` handles all operators. The `special` type calls a named handler inside `UpgradeSystem` for anything that can't be expressed declaratively (e.g., Stellar Nova, interest rate). Trigger-based upgrades (fire on events) are registered in `_setupTrigger()` using `TRIGGER_EVENTS` / `TRIGGER_ACTIONS` constants.

`min` sets a floor (`Math.max`), `max` sets a cap (`Math.min`). Negative `add` values on `hpRegen` produce a HP drain capped at 1 HP (never lethal) — implemented in `UpgradeSystem.applyRegen()`.

### Tech Tree

The tech tree is a seeded radial graph generated by `TechTreeGenerator`. Four main branches (weapon / defense / utility / passive) radiate outward from ring-0 starter nodes; special cross-branch nodes sit on diagonal sectors between branches. `TechTreeState` wraps the generator and owns unlock state. Node IDs are the `templateId` strings from the template definitions (e.g. `kinetic_damage`), not positional indices — this matters when reading save data.

The node template list lives in `src/techtree/TechNodeTemplates.js` (not `upgrades.json`). `upgrades.json` holds standalone upgrade definitions that can also appear as tech-tree nodes via their `id` field.

### Combat Data Flow

`CombatSystem.update()` each frame:
1. Ticks the manual gun heat system
2. Fires auto-attack projectiles at the nearest enemy
3. Fires extra weapon turrets (laser/missile/plasma)
4. Runs the Stellar Nova AoE timer
5. Calls `CollisionSystem` to get hit pairs, applies damage, emits `ENEMY_KILLED` / `ENEMY_DAMAGED`
6. Applies contact damage from enemies that reach the player
7. Runs Corrosive Aura and Gravity Well loops
8. Collects loot drops

`RoundSystem.update()` each frame accumulates distance, syncs the tier, manages enemy spawning, and tracks boss milestone distances.

### Warp Gate System

`state.warpGates.maxTierReached` persists the highest tier ever reached. Gates unlock at every `WARP.GATE_TIER_INTERVAL` (10) tiers. When launching, `_showWarpGateAndLaunch()` in `main.js` shows a gate-selection UI if any gates are available. `_startNewRun(startTier)` pre-sets `distanceTraveled` and `bossesDefeated` so difficulty and boss timing are consistent with the chosen sector.

### Key Files at a Glance

| File | Role |
|---|---|
| `src/main.js` | Orchestrator; owns all system instances and event wiring |
| `src/constants.js` | All tuning numbers and enum constants |
| `src/core/GameState.js` | Canonical state shape + serialization |
| `src/core/SaveManager.js` | localStorage persistence + version migrations |
| `src/core/EventBus.js` | Global pub/sub; prefer named `EVENTS` constants |
| `src/ecs/{Entity,Component,World}.js` | Core ECS primitives — all game objects use these |
| `src/components/ships/ShipComponent.js` | Base class for per-ship components (data + behavior per variant) |
| `src/components/ships/ShipRegistry.js` | Maps ship id → component class; iteration order = hangar carousel |
| `src/systems/UpgradeSystem.js` | Rebuilds `computed` stats; implements upgrade grammar |
| `src/systems/CombatSystem.js` | All per-frame combat logic |
| `src/systems/RoundSystem.js` | Distance/tier progression, enemy spawning, bosses |
| `src/techtree/TechTreeGenerator.js` | Seeded radial tree layout |
| `src/techtree/TechTreeState.js` | Unlock state, purchase logic, save/load |
| `src/data/upgrades.json` | Declarative upgrade node definitions |
| `src/ui/UIManager.js` | Screen visibility management |
| `src/ui/TechTreeUI.js` | Canvas-based tech tree renderer |
| `styles/main.css` | All styles; uses CSS variables for the neon palette |
