import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';

/** Base orientation offsets — modified by DebugMenuUI. */
export const reticleDebug = {
  offsetX: Math.PI / 2,
  offsetY: 0,
  offsetZ: 0,
};

export class Enemy {
  constructor(def, round, scene, computed = null) {
    this.type = def.type;
    this.id = `enemy_${Date.now()}_${Math.random()}`;
    this.collisionRadius = def.collisionRadius;
    this.lootTable = def.loot;
    this.behaviorType = def.behavior;

    // Scale stats with round
    const hpScale = Math.pow(1.12, round - 1);
    const dmgScale = Math.pow(1.05, round - 1);
    const rawHp  = Math.ceil(def.baseHp   * hpScale);
    const rawDmg = Math.ceil(def.baseDamage * dmgScale);
    const rawSpd = def.baseSpeed * (1 + round * 0.004);

    // Apply upgrade-driven enemy modifiers
    const allMod  = computed?.enemyModifiers?.all      || {};
    const typeMod = computed?.enemyModifiers?.[def.type] || {};
    const hpMult  = (allMod.hpMult  ?? 1) * (typeMod.hpMult  ?? 1);
    const dmgMult = (allMod.damageMult ?? 1) * (typeMod.damageMult ?? 1);
    const spdMult = (allMod.speedMult ?? 1) * (typeMod.speedMult ?? 1);

    this.maxHp = Math.max(1, Math.ceil(rawHp  * hpMult));
    this.hp    = this.maxHp;
    this.damage = Math.max(1, Math.ceil(rawDmg * dmgMult));
    this.speed  = rawSpd * spdMult;
    // damageReceivedMult amplifies damage this enemy receives (>1 = takes more)
    this.damageReceivedMult =
      (allMod.damageReceivedMult ?? 1) * (typeMod.damageReceivedMult ?? 1);
    this.contactDamage = def.baseDamage;
    this.attackSpeed = def.attackSpeed || 0;
    // Desync ranged volleys (shots/sec → random phase in [0, interval))
    this._attackTimer =
      this.attackSpeed > 0 ? Math.random() / this.attackSpeed : 0;
    this._behaviorTimer = 0;
    this._zigzagDir = 1;
    this._keepRangeDist = def.keepRangeDist || 12;

    this.active = true;
    this.statusEffects = []; // [{ type, remaining, dps?, mult? }]
    this._burnTickTimer = 0;
    this.group = new THREE.Group();
    this._spinGroup = new THREE.Group();
    this.group.add(this._spinGroup);
    this._buildMesh(def);
    this._buildHpBar();
    this._buildTargetReticle(def.collisionRadius, def.scale || 1);
    scene.groups.enemies.add(this.group);

    // Random spawn position
    this.group.position.set(
      (Math.random() - 0.5) * 32,
      0,
      -55 - Math.random() * 20
    );
  }

  _buildMesh(def) {
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: new THREE.Color(def.color).multiplyScalar(0.25),
      metalness: 0.5,
      roughness: 0.4,
    });

    const mesh = new THREE.Mesh(def.geometry.clone(), mat);
    this._spinGroup.add(mesh);
    this._bodyMesh = mesh;

    // Eyes
    if (def.type !== 'boss') {
      const eyeGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [-0.15, 0.15].forEach(x => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 0.15, -def.eyeZ || -0.3);
        this._spinGroup.add(eye);
      });
    }

    // Scale
    this.group.scale.setScalar(def.scale || 1);
  }

  _buildTargetReticle(collisionRadius, scale) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    this._reticle = new THREE.Group();
    this._reticleAngle = 0;

    // Local-space radius (un-do parent scale so world size is consistent)
    const r = (collisionRadius / scale) * 1.35;
    const armLen = r * 0.45;
    const thick = 0.055 / scale;

    const corners = [
      { cx:  r, cz:  r },
      { cx: -r, cz:  r },
      { cx:  r, cz: -r },
      { cx: -r, cz: -r },
    ];

    for (const c of corners) {
      const sgnX = Math.sign(c.cx);
      const sgnZ = Math.sign(c.cz);

      // Arm along X pointing outward
      const hMesh = new THREE.Mesh(new THREE.BoxGeometry(armLen, thick, thick), mat);
      hMesh.position.set(c.cx + sgnX * armLen / 2, 0, c.cz);
      this._reticle.add(hMesh);

      // Arm along Z pointing outward
      const vMesh = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, armLen), mat);
      vMesh.position.set(c.cx, 0, c.cz + sgnZ * armLen / 2);
      this._reticle.add(vMesh);
    }

    this._reticle.position.y = 0.25 / scale;
    this._reticle.visible = false;
    this.group.add(this._reticle);
  }

  setTargeted(val) {
    if (this._reticle) this._reticle.visible = !!val;
  }

  _buildHpBar() {
    const trackGeo = new THREE.PlaneGeometry(1.2, 0.12);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 });
    this._hpTrack = new THREE.Mesh(trackGeo, trackMat);
    this._hpTrack.position.set(0, 1.5, 0);

    const barGeo = new THREE.PlaneGeometry(1.1, 0.08);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    this._hpBar = new THREE.Mesh(barGeo, barMat);
    this._hpBar.position.set(0, 1.5, 0.01);
    this._hpBarMat = barMat;

    this.group.add(this._hpTrack);
    this.group.add(this._hpBar);
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this._updateHpBar();
    if (this.hp <= 0) {
      this.active = false;
      return true; // died
    }
    // Flash white
    this._bodyMesh.material.emissive.setHex(0xffffff);
    setTimeout(() => {
      if (this._bodyMesh.material) {
        this._bodyMesh.material.emissive.set(
          new THREE.Color(this._bodyMesh.material.color).multiplyScalar(0.25)
        );
      }
    }, 80);
    return false;
  }

  /** Apply or refresh a status effect. type: 'burn' | 'slow' */
  applyStatus(type, { dps = 0, mult = 1, duration = 3 } = {}) {
    const existing = this.statusEffects.find(s => s.type === type);
    if (existing) {
      existing.remaining = duration;
      if (type === 'burn') existing.dps = Math.max(existing.dps, dps);
      if (type === 'slow') existing.mult = Math.min(existing.mult, mult);
    } else {
      this.statusEffects.push({ type, remaining: duration, dps, mult });
    }
  }

  _updateHpBar() {
    const ratio = this.hp / this.maxHp;
    this._hpBar.scale.x = Math.max(0.01, ratio);
    this._hpBar.position.x = -((1 - ratio) * 0.55);
    if (ratio > 0.5) this._hpBarMat.color.setHex(0x39ff14);
    else if (ratio > 0.25) this._hpBarMat.color.setHex(0xffaa00);
    else this._hpBarMat.color.setHex(0xff2200);
  }

  update(delta, playerPos, speedScale = 1, visionRange = Infinity, camera = null) {
    if (!this.active) return;

    // Vision range: hide group when enemy is beyond sensor range
    const dx0 = this.group.position.x - playerPos.x;
    const dz0 = this.group.position.z - (playerPos.z ?? 0);
    const distSq = dx0 * dx0 + dz0 * dz0;
    this.group.visible = distSq <= visionRange * visionRange;

    // Target reticle: fixed offsets + constant Y-axis auto-spin (independent of body).
    if (this._reticle?.visible) {
      this._reticleAngle += delta * 1.1;
      this._reticle.rotation.x = reticleDebug.offsetX;
      this._reticle.rotation.y = reticleDebug.offsetY + this._reticleAngle;
      this._reticle.rotation.z = reticleDebug.offsetZ;
    }

    // ---- Tick status effects ----
    let slowMult = 1;
    this._burnTickTimer += delta;
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const s = this.statusEffects[i];
      s.remaining -= delta;
      if (s.remaining <= 0) { this.statusEffects.splice(i, 1); continue; }
      if (s.type === 'slow') slowMult = Math.min(slowMult, s.mult);
      if (s.type === 'burn' && this._burnTickTimer >= 0.5) {
        const burnDmg = Math.max(1, Math.ceil(s.dps * 0.5));
        const died = this.takeDamage(burnDmg);
        eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy: this, damage: burnDmg, isCrit: false });
        if (died) { eventBus.emit(EVENTS.ENEMY_KILLED, { enemy: this }); return; }
      }
    }
    if (this._burnTickTimer >= 0.5) this._burnTickTimer -= 0.5;

    this._behaviorTimer += delta;

    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const spd = this.speed * speedScale * slowMult;

    switch (this.behaviorType) {
      case 'charge':
        if (dist > 0.1) {
          this.group.position.x += (dx / dist) * spd * delta;
          this.group.position.z += (dz / dist) * spd * delta;
        }
        break;

      case 'steady':
        if (dist > 0.1) {
          this.group.position.x += (dx / dist) * spd * delta;
          this.group.position.z += (dz / dist) * spd * delta;
        }
        break;

      case 'zigzag': {
        if (this._behaviorTimer > 0.6) {
          this._behaviorTimer = 0;
          this._zigzagDir *= -1;
        }
        if (dist > 0.1) {
          this.group.position.x += ((dx / dist) * spd + this._zigzagDir * spd * 0.8) * delta;
          this.group.position.z += (dz / dist) * spd * delta;
        }
        break;
      }

      case 'keepRange':
        if (dist < this._keepRangeDist) {
          this.group.position.x -= (dx / dist) * spd * delta * 0.5;
          this.group.position.z -= (dz / dist) * spd * delta * 0.5;
        } else if (dist > this._keepRangeDist + 4) {
          this.group.position.x += (dx / dist) * spd * delta;
          this.group.position.z += (dz / dist) * spd * delta;
        }
        break;

      case 'boss': {
        const phase = Math.floor(this._behaviorTimer / 4) % 3;
        if (phase === 0) {
          if (dist > 0.1) {
            this.group.position.x += (dx / dist) * spd * delta;
            this.group.position.z += (dz / dist) * spd * delta;
          }
        } else if (phase === 1) {
          this.group.position.x += Math.sin(this._behaviorTimer * 2) * spd * 1.5 * delta;
          this.group.position.z += (dz / dist) * spd * 0.3 * delta;
        } else {
          if (dist < 8) {
            this.group.position.x -= (dx / dist) * spd * 0.5 * delta;
            this.group.position.z -= (dz / dist) * spd * 0.5 * delta;
          } else {
            this.group.position.x += (dx / dist) * spd * delta;
            this.group.position.z += (dz / dist) * spd * delta;
          }
        }
        // Boss spin (body only — reticle / HP stay outside _spinGroup)
        this._spinGroup.rotation.y += delta * 0.8;
        break;
      }
    }

    // HP bar: match camera orientation (no roll from enemy body)
    if (camera) {
      this._hpTrack.quaternion.copy(camera.quaternion);
      this._hpBar.quaternion.copy(camera.quaternion);
    }

    // Slow rotation for variety (body mesh + eyes only)
    if (this.type !== 'boss') {
      this._spinGroup.rotation.y += delta * 0.6;
    }
  }

  remove(scene) {
    scene.groups.enemies.remove(this.group);
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}
