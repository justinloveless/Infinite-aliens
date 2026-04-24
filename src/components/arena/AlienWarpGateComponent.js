import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { BOSS_ARENA } from '../../constants.js';
import { createEnemy } from '../../prefabs/createEnemy.js';
import { createGateCrystal } from '../../prefabs/createGateCrystal.js';
import { weightedPick } from '../enemy/EnemyDefs.js';
import { getSpawnableEnemyTypes } from '../../coordinators/counterSpawn.js';

/**
 * Visual + spawn driver for an alien warp gate. The gate becomes "closed"
 * when every crystal in its orbiting ring is destroyed. While any crystal
 * survives, the gate continuously spawns minion waves.
 */
export class AlienWarpGateComponent extends Component {
  constructor({ position }) {
    super();
    this._spawnPos = position.clone();
    this.isActive = true;
    this._group = null;
    this._rotTime = 0;
    this._spawnTimer = Math.random() * 1.5; // stagger across gates
    this._liveSpawns = new Set();
    this._crystals = new Set();
    this._closed = false;
    this._crystalUnsub = null;
  }

  get crystalsRemaining() {
    return this._crystals.size;
  }

  onAttach(ctx) {
    this._group = new THREE.Group();
    this._group.position.copy(this._spawnPos);

    const torusGeo = new THREE.TorusGeometry(3, 0.25, 8, 48);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 1.5,
    });
    this._torus = new THREE.Mesh(torusGeo, torusMat);
    this._group.add(this._torus);

    const discGeo = new THREE.CircleGeometry(2.8, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x6600cc, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    });
    this._disc = new THREE.Mesh(discGeo, discMat);
    this._group.add(this._disc);

    const light = new THREE.PointLight(0xaa00ff, 3, 12);
    this._group.add(light);
    this._light = light;

    ctx.scene.groups.effects.add(this._group);

    this._spawnCrystalRing(ctx);

    this._crystalUnsub = eventBus.on(EVENTS.GATE_CRYSTAL_DESTROYED, ({ gateId }) => {
      if (gateId !== this.entity.id) return;
      // Prune dead crystals from our set on the next update; nothing to do now.
    });
  }

  _spawnCrystalRing(ctx) {
    const count = BOSS_ARENA.GATE_CRYSTAL_COUNT;
    const tier = ctx.state?.round?.current || 1;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const crystal = createGateCrystal({
        gateId: this.entity.id,
        gatePosition: this._spawnPos,
        orbitAngle: angle,
        orbitRadius: BOSS_ARENA.GATE_CRYSTAL_ORBIT_RADIUS,
        tier,
      });
      ctx.world.spawn(crystal);
      this._crystals.add(crystal);
    }
  }

  update(dt, ctx) {
    if (!this._group || !this.isActive) return;
    this._rotTime += dt;
    this._torus.rotation.y = this._rotTime * 0.8;
    this._torus.rotation.z = this._rotTime * 0.4;

    this._disc.material.opacity = 0.3 + Math.sin(this._rotTime * 3) * 0.1;
    this._light.intensity = 2.5 + Math.sin(this._rotTime * 4) * 0.8;

    const t = this.entity.get('TransformComponent');
    if (t) this._group.position.copy(t.position);

    // Sweep dead/destroyed crystals.
    for (const c of this._crystals) {
      if (!c || c._destroyed || !c.active) this._crystals.delete(c);
    }

    if (this._crystals.size === 0 && !this._closed) {
      this._closed = true;
      this.close();
      eventBus.emit(EVENTS.ARENA_GATE_CLOSED, { gateId: this.entity.id });
      return;
    }

    this._tickSpawns(dt, ctx);
  }

  /** Periodically spawn enemies near this gate while active. */
  _tickSpawns(dt, ctx) {
    if (!ctx?.world || !ctx?.state) return;
    const phase = ctx.state.round?.phase;
    if (phase !== 'boss_arena' && phase !== 'arena_transition') return;

    for (const ent of this._liveSpawns) {
      if (!ent || ent._destroyed || !ent.active) this._liveSpawns.delete(ent);
    }
    if (this._liveSpawns.size >= BOSS_ARENA.GATE_MAX_LIVE_SPAWNS) return;

    this._spawnTimer += dt;
    if (this._spawnTimer < BOSS_ARENA.GATE_SPAWN_INTERVAL) return;
    this._spawnTimer = 0;

    const tier = ctx.state.round?.current || 1;
    const types = getSpawnableEnemyTypes(tier, ctx.state).filter(
      t => t !== 'boss' && !String(t).endsWith('_boss')
    );
    if (!types.length) return;
    const def = weightedPick(types);
    const count = def.spawnCount || 1;
    const stats = ctx.playerEntity?.get('PlayerStatsComponent');
    const gatePos = this._spawnPos;
    for (let i = 0; i < count; i++) {
      const offset = {
        x: gatePos.x + (i - (count - 1) / 2) * 2.5,
        z: gatePos.z + 1.5,
      };
      const ent = createEnemy(def.type, tier, stats, offset);
      ctx.world.spawn(ent);
      this._liveSpawns.add(ent);
      eventBus.emit(EVENTS.ENEMY_SPAWNED, { entity: ent });
    }
  }

  close() {
    this.isActive = false;
    if (this._group) {
      this._group.visible = false;
    }
  }

  /**
   * Debug: destroy crystals and hide gate without emitting ARENA_GATE_CLOSED.
   * ArenaDirector sets `gatesClosed` in state when batch-skipping objectives.
   */
  debugForceClose() {
    for (const c of [...this._crystals]) {
      if (c && !c._destroyed) c.destroy();
    }
    this._crystals.clear();
    if (!this._closed) {
      this._closed = true;
      this.close();
    }
  }

  onDetach() {
    if (this._crystalUnsub) { this._crystalUnsub(); this._crystalUnsub = null; }
    // Destroy any surviving crystals bound to this gate; they should not
    // outlive their parent.
    for (const c of this._crystals) {
      if (c && !c._destroyed) c.destroy();
    }
    this._crystals.clear();

    if (this._group) {
      this._group.parent?.remove(this._group);
      this._group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this._group = null;
    }
  }
}
