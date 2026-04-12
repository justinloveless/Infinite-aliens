import * as THREE from 'three';

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
    this._attackTimer = 0;
    this._behaviorTimer = 0;
    this._zigzagDir = 1;
    this._keepRangeDist = def.keepRangeDist || 12;

    this.active = true;
    this.group = new THREE.Group();
    this._buildMesh(def);
    this._buildHpBar();
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
    this.group.add(mesh);
    this._bodyMesh = mesh;

    // Eyes
    if (def.type !== 'boss') {
      const eyeGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      [-0.15, 0.15].forEach(x => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 0.15, -def.eyeZ || -0.3);
        this.group.add(eye);
      });
    }

    // Scale
    this.group.scale.setScalar(def.scale || 1);
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

  _updateHpBar() {
    const ratio = this.hp / this.maxHp;
    this._hpBar.scale.x = Math.max(0.01, ratio);
    this._hpBar.position.x = -((1 - ratio) * 0.55);
    if (ratio > 0.5) this._hpBarMat.color.setHex(0x39ff14);
    else if (ratio > 0.25) this._hpBarMat.color.setHex(0xffaa00);
    else this._hpBarMat.color.setHex(0xff2200);
  }

  update(delta, playerPos) {
    if (!this.active) return;

    this._behaviorTimer += delta;

    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    switch (this.behaviorType) {
      case 'charge':
        if (dist > 0.1) {
          this.group.position.x += (dx / dist) * this.speed * delta;
          this.group.position.z += (dz / dist) * this.speed * delta;
        }
        break;

      case 'steady':
        if (dist > 0.1) {
          this.group.position.x += (dx / dist) * this.speed * delta;
          this.group.position.z += (dz / dist) * this.speed * delta;
        }
        break;

      case 'zigzag': {
        if (this._behaviorTimer > 0.6) {
          this._behaviorTimer = 0;
          this._zigzagDir *= -1;
        }
        if (dist > 0.1) {
          this.group.position.x += ((dx / dist) * this.speed + this._zigzagDir * this.speed * 0.8) * delta;
          this.group.position.z += (dz / dist) * this.speed * delta;
        }
        break;
      }

      case 'keepRange':
        if (dist < this._keepRangeDist) {
          this.group.position.x -= (dx / dist) * this.speed * delta * 0.5;
          this.group.position.z -= (dz / dist) * this.speed * delta * 0.5;
        } else if (dist > this._keepRangeDist + 4) {
          this.group.position.x += (dx / dist) * this.speed * delta;
          this.group.position.z += (dz / dist) * this.speed * delta;
        }
        break;

      case 'boss': {
        const phase = Math.floor(this._behaviorTimer / 4) % 3;
        if (phase === 0) {
          if (dist > 0.1) {
            this.group.position.x += (dx / dist) * this.speed * delta;
            this.group.position.z += (dz / dist) * this.speed * delta;
          }
        } else if (phase === 1) {
          this.group.position.x += Math.sin(this._behaviorTimer * 2) * this.speed * 1.5 * delta;
          this.group.position.z += (dz / dist) * this.speed * 0.3 * delta;
        } else {
          if (dist < 8) {
            this.group.position.x -= (dx / dist) * this.speed * 0.5 * delta;
            this.group.position.z -= (dz / dist) * this.speed * 0.5 * delta;
          } else {
            this.group.position.x += (dx / dist) * this.speed * delta;
            this.group.position.z += (dz / dist) * this.speed * delta;
          }
        }
        // Boss spin
        this.group.rotation.y += delta * 0.8;
        break;
      }
    }

    // Billboard HP bar to camera
    this._hpTrack.rotation.copy(this.group.parent.parent ?
      this.group.parent.parent.rotation : new THREE.Euler());

    // Slow rotation for variety
    if (this.type !== 'boss') {
      this.group.rotation.y += delta * 0.6;
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
