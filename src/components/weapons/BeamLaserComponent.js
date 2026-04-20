import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { BEAM_LASER } from '../../constants.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { resolveTarget } from './CombatTargeting.js';

const _yAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);

/**
 * Continuous beam weapon with a duty cycle. Owns its own mesh and light and
 * damages the currently-targeted enemy at a fixed tick rate. Swaps in/out the
 * beam turret visual on attach/detach.
 */
export class BeamLaserComponent extends Component {
  constructor() {
    super();
    this._time = 0;
    this._isOn = false;
    this._cycleTimer = 0;
    this._damageTimer = 0;
    this._core = null;
    this._glow = null;
    this._light = null;
    this._scene = null;
  }

  onAttach(ctx) {
    const visuals = this.entity.get('ShipVisualsComponent');
    if (visuals) visuals.syncTurrets([...Object.keys(visuals._turretMeshes), 'beam']);

    this._scene = ctx.scene.scene;

    const coreGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff1133, transparent: true, opacity: 0.95 });
    this._core = new THREE.Mesh(coreGeo, coreMat);
    this._core.visible = false;
    this._core.frustumCulled = false;
    this._scene.add(this._core);

    const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4466, transparent: true, opacity: 0.18 });
    this._glow = new THREE.Mesh(glowGeo, glowMat);
    this._glow.visible = false;
    this._glow.frustumCulled = false;
    this._scene.add(this._glow);

    this._light = new THREE.PointLight(0xff1133, 0, 8);
    this._scene.add(this._light);
  }

  onDetach() {
    if (this._scene && this._core) this._scene.remove(this._core);
    if (this._scene && this._glow) this._scene.remove(this._glow);
    if (this._scene && this._light) this._scene.remove(this._light);
    this._core?.geometry.dispose();
    this._core?.material.dispose();
    this._glow?.geometry.dispose();
    this._glow?.material.dispose();
    const visuals = this.entity.get('ShipVisualsComponent');
    if (visuals) {
      const remaining = Object.keys(visuals._turretMeshes).filter(k => k !== 'beam');
      visuals.syncTurrets(remaining);
    }
  }

  _setVisible(v) {
    this._core.visible = v;
    this._glow.visible = v;
  }

  _orientBeam(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.01) return;
    const normDir = dir.clone().divideScalar(dist);
    const mid = from.clone().lerp(to, 0.5);
    const refUp = Math.abs(normDir.dot(_yAxis)) > 0.98 ? _xAxis : _yAxis;
    const quat = new THREE.Quaternion().setFromUnitVectors(refUp, normDir);
    for (const m of [this._core, this._glow]) {
      m.position.copy(mid);
      m.scale.set(1, dist, 1);
      m.quaternion.copy(quat);
    }
    this._light.position.copy(mid);
  }

  update(dt, ctx) {
    this._time += dt;

    if (!isCombatPhase(ctx?.state?.round?.phase)) {
      this._setVisible(false);
      this._light.intensity = 0;
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
      this._setVisible(false);
      this._light.intensity = 0;
      return;
    }

    const stats = this.entity.get('PlayerStatsComponent');
    const t = this.entity.get('TransformComponent');
    const visuals = this.entity.get('ShipVisualsComponent');
    if (!stats || !t || !visuals) return;

    const target = resolveTarget(ctx.world, t.position, stats, ctx.state.round);
    if (!target) {
      this._setVisible(false);
      this._light.intensity = 0;
      return;
    }

    const from = visuals.getTurretWorldPosition('beam');
    const to = target.get('TransformComponent').position.clone();
    this._orientBeam(from, to);

    const flicker = 0.88 + Math.sin(this._time * 31) * 0.12;
    this._core.material.opacity = flicker;
    this._glow.material.opacity = 0.12 + Math.sin(this._time * 19) * 0.06;
    this._light.intensity = (2.0 + Math.sin(this._time * 23) * 0.6) * flicker;
    this._setVisible(true);

    this._damageTimer += dt;
    if (this._damageTimer >= BEAM_LASER.TICK_RATE) {
      this._damageTimer -= BEAM_LASER.TICK_RATE;
      const dmg = Math.max(1, Math.ceil(stats.damage * BEAM_LASER.DAMAGE_RATIO));
      const health = target.get('HealthComponent');
      if (health) health.takeDamage(dmg);
    }
  }
}
