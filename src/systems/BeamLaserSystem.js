import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { BEAM_LASER } from '../constants.js';
import { CombatSystem } from './CombatSystem.js';

// Stable reference vectors for quaternion math
const _yAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);

export class BeamLaserSystem {
  constructor(threeScene) {
    this._scene = threeScene;

    // Core beam — thin cylinder, oriented from turret to target each frame
    const coreGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff1133,
      transparent: true,
      opacity: 0.95,
    });
    this._core = new THREE.Mesh(coreGeo, coreMat);
    this._core.visible = false;
    this._core.frustumCulled = false;
    this._scene.add(this._core);

    // Glow layer — wider, more translucent
    const glowGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4466,
      transparent: true,
      opacity: 0.18,
    });
    this._glow = new THREE.Mesh(glowGeo, glowMat);
    this._glow.visible = false;
    this._glow.frustumCulled = false;
    this._scene.add(this._glow);

    // Point light tracks the beam midpoint
    this._light = new THREE.PointLight(0xff1133, 0, 8);
    this._scene.add(this._light);

    // Duty-cycle state
    this._isOn = false;
    this._cycleTimer = 0;
    this._damageTimer = 0;
    this._time = 0;
  }

  /**
   * @param {number}   delta
   * @param {boolean}  isEquipped  — true when 'beam' is in computed.extraWeapons
   * @param {object}   ship        — Ship instance
   * @param {object[]} enemies     — active enemy array from RoundSystem
   * @param {object}   computed    — computed stats
   * @param {object}   [round]     — state.round (manual focus id)
   */
  update(delta, isEquipped, ship, enemies, computed, round) {
    this._time += delta;

    if (!isEquipped || !computed?.hasAutoFire) {
      this._setVisible(false);
      this._light.intensity = 0;
      // Reset cycle so it starts fresh when re-equipped
      this._isOn = false;
      this._cycleTimer = 0;
      return;
    }

    // ---- Duty cycle ----
    this._cycleTimer += delta;
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

    const target = CombatSystem.resolveCombatTarget(
      enemies,
      ship.group.position,
      computed,
      round
    );
    if (!target) {
      this._setVisible(false);
      this._light.intensity = 0;
      return;
    }

    // ---- Orient beam meshes ----
    const from = ship.getTurretWorldPosition('beam');
    const to   = target.group.position.clone();
    this._orientBeam(from, to);

    // ---- Flicker effect ----
    const t = this._time;
    const flicker = 0.88 + Math.sin(t * 31) * 0.12;
    this._core.material.opacity = flicker;
    this._glow.material.opacity = 0.12 + Math.sin(t * 19) * 0.06;
    this._light.intensity = (2.0 + Math.sin(t * 23) * 0.6) * flicker;

    this._setVisible(true);

    // ---- Damage tick ----
    this._damageTimer += delta;
    if (this._damageTimer >= BEAM_LASER.TICK_RATE) {
      this._damageTimer -= BEAM_LASER.TICK_RATE;

      const dmg = Math.max(1, Math.ceil(computed.damage * BEAM_LASER.DAMAGE_RATIO));
      const died = target.takeDamage(dmg);
      eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy: target, damage: dmg, isCrit: false });
      if (died) {
        eventBus.emit(EVENTS.ENEMY_KILLED, { enemy: target });
      }
    }
  }

  _orientBeam(from, to) {
    const dir  = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.01) return;

    const normDir = dir.clone().divideScalar(dist);
    const mid     = from.clone().lerp(to, 0.5);

    // Avoid degenerate quaternion when beam is nearly parallel to Y
    const refUp = Math.abs(normDir.dot(_yAxis)) > 0.98 ? _xAxis : _yAxis;
    const quat  = new THREE.Quaternion().setFromUnitVectors(refUp, normDir);

    for (const mesh of [this._core, this._glow]) {
      mesh.position.copy(mid);
      mesh.scale.set(1, dist, 1);
      mesh.quaternion.copy(quat);
    }

    this._light.position.copy(mid);
  }

  _setVisible(v) {
    this._core.visible = v;
    this._glow.visible = v;
  }

  /** Hide beam and reset cycle state (call on round reset / game reset). */
  clear() {
    this._isOn = false;
    this._cycleTimer = 0;
    this._damageTimer = 0;
    this._setVisible(false);
    this._light.intensity = 0;
  }
}
