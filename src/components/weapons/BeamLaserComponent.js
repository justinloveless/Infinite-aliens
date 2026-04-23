import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { BEAM_LASER, ENERGY } from '../../constants.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { resolveTarget } from './CombatTargeting.js';

const _yAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);

/**
 * Continuous beam weapon with a duty cycle. Owns its own meshes and lights —
 * one set of visuals per slot hosting a beam emitter (supports multiple
 * beam lasers installed on different slots). Each beam damages the currently
 * targeted enemy at a fixed tick rate; two beams installed therefore double
 * effective DPS while the duty cycle is shared.
 */
export class BeamLaserComponent extends Component {
  constructor() {
    super();
    this._time = 0;
    this._isOn = false;
    this._cycleTimer = 0;
    this._damageTimer = 0;
    this._scene = null;
    /** Map<slotId, { core, glow, light }>  */
    this._beams = new Map();
  }

  onAttach(ctx) {
    this._scene = ctx.scene.scene;
  }

  onDetach() {
    for (const slotId of [...this._beams.keys()]) this._destroyBeam(slotId);
  }

  _createBeam(slotId) {
    const coreGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff1133, transparent: true, opacity: 0.95 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.visible = false;
    core.frustumCulled = false;
    this._scene.add(core);

    const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4466, transparent: true, opacity: 0.18 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.visible = false;
    glow.frustumCulled = false;
    this._scene.add(glow);

    const light = new THREE.PointLight(0xff1133, 0, 8);
    this._scene.add(light);

    const beam = { core, glow, light };
    this._beams.set(slotId, beam);
    return beam;
  }

  _destroyBeam(slotId) {
    const b = this._beams.get(slotId);
    if (!b) return;
    if (this._scene) {
      this._scene.remove(b.core);
      this._scene.remove(b.glow);
      this._scene.remove(b.light);
    }
    b.core.geometry.dispose();
    b.core.material.dispose();
    b.glow.geometry.dispose();
    b.glow.material.dispose();
    this._beams.delete(slotId);
  }

  /** Reconcile beam visuals to match the active slot set. */
  _syncBeams(slotIds) {
    const desired = new Set(slotIds);
    for (const slotId of [...this._beams.keys()]) {
      if (!desired.has(slotId)) this._destroyBeam(slotId);
    }
    for (const slotId of desired) {
      if (!this._beams.has(slotId)) this._createBeam(slotId);
    }
  }

  _setBeamVisible(beam, v) {
    beam.core.visible = v;
    beam.glow.visible = v;
  }

  _orientBeam(beam, from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.01) return;
    const normDir = dir.clone().divideScalar(dist);
    const mid = from.clone().lerp(to, 0.5);
    const refUp = Math.abs(normDir.dot(_yAxis)) > 0.98 ? _xAxis : _yAxis;
    const quat = new THREE.Quaternion().setFromUnitVectors(refUp, normDir);
    for (const m of [beam.core, beam.glow]) {
      m.position.copy(mid);
      m.scale.set(1, dist, 1);
      m.quaternion.copy(quat);
    }
    beam.light.position.copy(mid);
  }

  _hideAll() {
    for (const beam of this._beams.values()) {
      this._setBeamVisible(beam, false);
      beam.light.intensity = 0;
    }
  }

  update(dt, ctx) {
    this._time += dt;

    const visuals = this.entity.get('ShipVisualsComponent');
    const slotIds = visuals ? visuals.getTurretSlotsFor('beam') : [];
    this._syncBeams(slotIds);

    const energy = this.entity.get('EnergyComponent');
    const energyOnline = !energy || energy.systemsOnline;

    if (!isCombatPhase(ctx?.state?.round?.phase) || !slotIds.length || !energyOnline) {
      this._hideAll();
      this._isOn = false;
      this._cycleTimer = 0;
      return;
    }

    this._cycleTimer += dt;
    if (this._isOn) {
      if (this._cycleTimer >= BEAM_LASER.ON_DURATION) {
        this._isOn = false;
        this._cycleTimer = 0;
        this._damageTimer = 0;
      }
    } else {
      if (this._cycleTimer >= BEAM_LASER.OFF_DURATION) {
        this._isOn = true;
        this._cycleTimer = 0;
      }
    }

    if (!this._isOn) {
      this._hideAll();
      return;
    }

    energy?.spend(ENERGY.COST_BEAM_LASER_PER_SEC * dt);

    const stats = this.entity.get('PlayerStatsComponent');
    const t = this.entity.get('TransformComponent');
    if (!stats || !t) return;

    const target = resolveTarget(ctx.world, t.position, stats, ctx.state.round);
    if (!target) {
      this._hideAll();
      return;
    }
    const to = target.get('TransformComponent').position;

    const flicker = 0.88 + Math.sin(this._time * 31) * 0.12;
    const glowOpacity = 0.12 + Math.sin(this._time * 19) * 0.06;
    const lightIntensity = (2.0 + Math.sin(this._time * 23) * 0.6) * flicker;

    for (const slotId of slotIds) {
      const beam = this._beams.get(slotId);
      if (!beam) continue;
      const from = visuals.getTurretWorldPosition('beam', slotId);
      this._orientBeam(beam, from, to);
      beam.core.material.opacity = flicker;
      beam.glow.material.opacity = glowOpacity;
      beam.light.intensity = lightIntensity;
      this._setBeamVisible(beam, true);
    }

    this._damageTimer += dt;
    if (this._damageTimer >= BEAM_LASER.TICK_RATE) {
      this._damageTimer -= BEAM_LASER.TICK_RATE;
      const perBeam = Math.max(1, Math.ceil(stats.damage * BEAM_LASER.DAMAGE_RATIO));
      const totalDmg = perBeam * slotIds.length;
      const health = target.get('HealthComponent');
      if (health) health.takeDamage(totalDmg);
    }
  }
}
