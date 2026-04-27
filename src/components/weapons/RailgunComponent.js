import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { isCombatPhase } from '../../core/phaseUtil.js';
import { getWeaponCombatMods } from '../../data/weaponCombatMods.js';

const _yAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _tmpDir = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpEnd = new THREE.Vector3();
const _tmpClosest = new THREE.Vector3();
const _ray = new THREE.Ray();

const SPREAD_MAX = Math.PI / 6; // 30°
const FLASH_DURATION = 0.25;
const FLASH_LENGTH = 55;
const LINE_LEN_MIN = 2.5;
const LINE_LEN_MAX = 5.0;

function orientCylinder(mesh, from, to) {
  _tmpDir.subVectors(to, from);
  const dist = _tmpDir.length();
  if (dist < 0.01) return;
  _tmpDir.divideScalar(dist);
  mesh.position.lerpVectors(from, to, 0.5);
  mesh.scale.set(1, dist, 1);
  const refUp = Math.abs(_tmpDir.dot(_yAxis)) > 0.98 ? _xAxis : _yAxis;
  _tmpQuat.setFromUnitVectors(refUp, _tmpDir);
  mesh.quaternion.copy(_tmpQuat);
}

export class RailgunComponent extends Component {
  constructor({ chargeTime = 2.5, damageMultiplier = 0, energyCost = 40 } = {}) {
    super();
    this.chargeTime = chargeTime;
    this.damageMultiplier = damageMultiplier;
    this.energyCost = energyCost;
    this._charging = false;
    this._charge = 0;
    this._ctx = null;
    this._scene3 = null;

    this._lineLeft = null;
    this._lineRight = null;
    this._lineGeo = null;
    this._flashCore = null;
    this._flashGlow = null;
    this._flashTimer = 0;
  }

  onAttach(ctx) {
    this._ctx = ctx;
    this._scene3 = ctx?.scene?.scene ?? null;
    this._buildVisuals();
  }

  onDetach() {
    this._destroyVisuals();
    this._ctx = null;
    this._scene3 = null;
  }

  _buildVisuals() {
    const s = this._scene3;
    if (!s) return;

    // Shared geometry for both charge lines (scale is on the mesh, not geo)
    this._lineGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 4);

    const matL = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0 });
    this._lineLeft = new THREE.Mesh(this._lineGeo, matL);
    this._lineLeft.visible = false;
    this._lineLeft.frustumCulled = false;
    s.add(this._lineLeft);

    const matR = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0 });
    this._lineRight = new THREE.Mesh(this._lineGeo, matR);
    this._lineRight.visible = false;
    this._lineRight.frustumCulled = false;
    s.add(this._lineRight);

    const flashCoreGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
    const flashCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    this._flashCore = new THREE.Mesh(flashCoreGeo, flashCoreMat);
    this._flashCore.visible = false;
    this._flashCore.frustumCulled = false;
    s.add(this._flashCore);

    const flashGlowGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6);
    const flashGlowMat = new THREE.MeshBasicMaterial({ color: 0x88eeff, transparent: true, opacity: 0 });
    this._flashGlow = new THREE.Mesh(flashGlowGeo, flashGlowMat);
    this._flashGlow.visible = false;
    this._flashGlow.frustumCulled = false;
    s.add(this._flashGlow);
  }

  _destroyVisuals() {
    const s = this._scene3;
    // Charge lines share geometry — dispose once
    this._lineGeo?.dispose();
    this._lineGeo = null;
    for (const mesh of [this._lineLeft, this._lineRight, this._flashCore, this._flashGlow]) {
      if (!mesh) continue;
      s?.remove(mesh);
      if (mesh !== this._lineLeft && mesh !== this._lineRight) mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this._lineLeft = null;
    this._lineRight = null;
    this._flashCore = null;
    this._flashGlow = null;
  }

  _getMuzzlePos() {
    const visuals = this.entity.get('ShipVisualsComponent');
    if (visuals) {
      const positions = visuals.getManualMuzzleWorldPositions();
      if (positions.length > 0) return positions[0];
    }
    const t = this.entity.get('TransformComponent');
    if (t) {
      const q = new THREE.Quaternion().setFromEuler(t.rotation);
      return t.position.clone().addScaledVector(
        new THREE.Vector3(0, 0, -1).applyQuaternion(q), 1.2,
      );
    }
    return new THREE.Vector3();
  }

  _getFireDir() {
    const t = this.entity.get('TransformComponent');
    const q = new THREE.Quaternion().setFromEuler(t?.rotation ?? new THREE.Euler());
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  }

  beginCharge() {
    if (this._charging) return;
    const ctx = this._ctx;
    if (!ctx || !isCombatPhase(ctx.state?.round?.phase)) {
      console.log('[railgun] blocked: ctx/phase', ctx?.state?.round?.phase);
      return;
    }
    const stats = this.entity.get('PlayerStatsComponent');
    if ((stats?.weaponsDisabledTimer ?? 0) > 0) { console.log('[railgun] blocked: weaponsDisabled'); return; }
    const energy = this.entity.get('EnergyComponent');
    if (!energy || energy.current < this.energyCost) {
      console.log('[railgun] blocked: energy', energy?.current, '/', this.energyCost);
      return;
    }
    console.log('[railgun] charging started, chargeTime=', this.chargeTime);
    this._charging = true;
    this._charge = 0;
    if (ctx.audio) ctx.audio.play('railgunCharge');
  }

  onPrimaryFirePress() { this.beginCharge(); }
  onPrimaryFireRelease() { this.releaseCharge(); }

  releaseCharge() {
    if (!this._charging) return;
    this._charging = false;
    if (this._charge < this.chargeTime) {
      this._charge = 0;
      this._hideChargeLines();
      return;
    }
    this._fire();
    this._charge = 0;
  }

  _hideChargeLines() {
    if (this._lineLeft) this._lineLeft.visible = false;
    if (this._lineRight) this._lineRight.visible = false;
  }

  _fire() {
    const ctx = this._ctx;
    const stats = this.entity.get('PlayerStatsComponent');
    if ((stats?.weaponsDisabledTimer ?? 0) > 0) {
      console.log('[railgun] _fire blocked: weaponsDisabled');
      return;
    }
    const energy = this.entity.get('EnergyComponent');
    if (!energy?.spend(this.energyCost)) {
      console.log('[railgun] _fire blocked: energy', energy?.current, '/', this.energyCost);
      return;
    }

    const pos = this._getMuzzlePos();
    const dir = this._getFireDir();
    const w = getWeaponCombatMods('railgun');
    const killsThisRun = ctx.state.round.killsThisRun || 0;
    const resonance = this.entity.get('ResonanceFieldComponent')?.level ?? 0;
    const { damage: baseDmg, isCrit } = stats.calcDamage({
      killsThisRun,
      resonanceFieldLevel: resonance,
      damageMult: w.damageMult * (this.damageMultiplier || 1),
      critChanceMult: w.critChanceMult,
      critMultiplierMult: w.critMultiplierMult,
    });
    console.log('[railgun] firing: pos=', pos, 'dir=', dir, 'dmg=', baseDmg);

    this._doHitscan(ctx, pos, dir, baseDmg, stats, isCrit);
    this._showFlash(pos, dir);
    this._hideChargeLines();

    if (ctx.audio) ctx.audio.play('railgunFire');
    eventBus.emit(EVENTS.MANUAL_FIRED);
  }

  _doHitscan(ctx, pos, dir, dmg, stats, isCrit) {
    _ray.set(pos, dir);
    const enemies = ctx.world.getFrameEnemies();
    const dampenMult = stats?.projectileDampenMult ?? 1;

    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const t = enemy.get('TransformComponent');
      if (!t) continue;

      // Only hit enemies in front of the muzzle
      _tmpDir.subVectors(t.position, pos);
      if (dir.dot(_tmpDir) < 0) continue;

      _ray.closestPointToPoint(t.position, _tmpClosest);
      const collider = enemy.get('ColliderComponent');
      const hitRadius = (collider?.radius ?? 1.0) + 0.2;

      if (_tmpClosest.distanceTo(t.position) > hitRadius) continue;

      const health = enemy.get('HealthComponent');
      if (!health || health.dead) continue;

      const finalDmg = Math.ceil(dmg * dampenMult);
      health.takeDamage(finalDmg, { isCrit, damageType: 'kinetic', source: this.entity });
      if (ctx.audio) ctx.audio.play(health.dead ? 'explosion' : (isCrit ? 'crit' : 'hit'));
    }
  }

  _showFlash(from, dir) {
    _tmpEnd.copy(from).addScaledVector(dir, FLASH_LENGTH);
    if (this._flashCore) {
      orientCylinder(this._flashCore, from, _tmpEnd);
      this._flashCore.material.opacity = 0.95;
      this._flashCore.visible = true;
    }
    if (this._flashGlow) {
      orientCylinder(this._flashGlow, from, _tmpEnd);
      this._flashGlow.material.opacity = 0.18;
      this._flashGlow.visible = true;
    }
    this._flashTimer = FLASH_DURATION;
  }

  _updateChargeLines(ratio) {
    if (!this._lineLeft || !this._lineRight) return;
    const muzzle = this._getMuzzlePos();
    const fireDir = this._getFireDir();
    const length = LINE_LEN_MIN + ratio * (LINE_LEN_MAX - LINE_LEN_MIN);
    const spread = SPREAD_MAX * (1 - ratio);
    const opacity = 0.2 + ratio * 0.8;

    const leftDir = fireDir.clone().applyAxisAngle(_yAxis, spread);
    _tmpEnd.copy(muzzle).addScaledVector(leftDir, length);
    orientCylinder(this._lineLeft, muzzle, _tmpEnd);
    this._lineLeft.material.opacity = opacity;
    this._lineLeft.visible = true;

    const rightDir = fireDir.clone().applyAxisAngle(_yAxis, -spread);
    _tmpEnd.copy(muzzle).addScaledVector(rightDir, length);
    orientCylinder(this._lineRight, muzzle, _tmpEnd);
    this._lineRight.material.opacity = opacity;
    this._lineRight.visible = true;
  }

  update(dt) {
    // Flash decay
    if (this._flashTimer > 0) {
      this._flashTimer = Math.max(0, this._flashTimer - dt);
      const t = this._flashTimer / FLASH_DURATION;
      if (this._flashCore) this._flashCore.material.opacity = t * 0.95;
      if (this._flashGlow) this._flashGlow.material.opacity = t * 0.18;
      if (this._flashTimer === 0) {
        if (this._flashCore) this._flashCore.visible = false;
        if (this._flashGlow) this._flashGlow.visible = false;
      }
    }

    if (!this._charging) {
      this._hideChargeLines();
      return;
    }

    this._charge = Math.min(this.chargeTime, this._charge + dt);

    if (this._charge >= this.chargeTime) {
      console.log('[railgun] charge complete, firing');
      this._charging = false;
      this._fire();
      this._charge = 0;
      return;
    }

    this._updateChargeLines(this._charge / this.chargeTime);
  }

  getChargeRatio() { return this._charge / this.chargeTime; }
}
