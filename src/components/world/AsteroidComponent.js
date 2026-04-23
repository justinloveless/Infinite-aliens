import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

const SIZE_CONFIG = {
  large:  { radius: 1.5, speedMin: 1.5, speedMax: 3.0, fragmentType: 'medium', fragmentCount: 3, damage: 18, hp: 30 },
  medium: { radius: 0.8, speedMin: 2.0, speedMax: 4.0, fragmentType: 'small',  fragmentCount: 2, damage: 10, hp: 15 },
  small:  { radius: 0.4, speedMin: 2.5, speedMax: 5.0, fragmentType: null,     fragmentCount: 0, damage: 5,  hp: 6  },
};

const TRAIL_VERTEX_CAP = 48;
const GEO_CACHE = {};
function getGeo(size) {
  if (!GEO_CACHE[size]) GEO_CACHE[size] = new THREE.IcosahedronGeometry(SIZE_CONFIG[size].radius, 1);
  return GEO_CACHE[size];
}

export { SIZE_CONFIG as ASTEROID_SIZES };

/**
 * Combines motion, visuals, and break-on-hit behavior for an asteroid entity.
 * On destroy, spawns fragment entities and emits ASTEROID_BROKEN.
 */
export class AsteroidComponent extends Component {
  constructor({ size = 'large', position = null, velocity = null } = {}) {
    super();
    this.size = size;
    const cfg = SIZE_CONFIG[size];
    this.damage = cfg.damage;
    this.collisionRadius = cfg.radius;
    this._group = new THREE.Group();
    this._scene = null;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xc4c4c4).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
      roughness: 0.9,
      metalness: 0.1,
    });
    this._rock = new THREE.Mesh(getGeo(size), mat);
    this._group.add(this._rock);

    this._trailCap = Math.min(TRAIL_VERTEX_CAP, 10 + Math.round(26 * (cfg.radius / SIZE_CONFIG.large.radius)));
    this._trailHist = [];
    const trailPos = new Float32Array(TRAIL_VERTEX_CAP * 3);
    this._trailGeo = new THREE.BufferGeometry();
    this._trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    this._trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xa8d8f0, transparent: true, opacity: 0.42,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this._trailLine = new THREE.Line(this._trailGeo, trailMat);
    this._group.add(this._trailLine);

    const dustCount = Math.min(20, 4 + Math.floor(14 * (cfg.radius / SIZE_CONFIG.large.radius)));
    const dustPos = new Float32Array(dustCount * 3);
    this._dustGeo = new THREE.BufferGeometry();
    this._dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd8e8f0, size: 0.09 + cfg.radius * 0.04,
      transparent: true, opacity: 0.55, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this._dustPoints = new THREE.Points(this._dustGeo, dustMat);
    this._dustCount = dustCount;
    const j = 0.16 * cfg.radius;
    this._dustJitter = [];
    for (let i = 0; i < dustCount; i++) {
      this._dustJitter.push([
        (Math.random() - 0.5) * j,
        (Math.random() - 0.5) * j * 0.45,
        (Math.random() - 0.5) * j,
      ]);
    }
    this._group.add(this._dustPoints);

    if (position) {
      this._group.position.copy(position);
    } else {
      this._group.position.set((Math.random() - 0.5) * 36, 0, -75 - Math.random() * 10);
    }

    if (velocity) {
      this.velocity = velocity.clone();
    } else {
      const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      this.velocity = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, speed);
    }

    this._rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2,
    );
    this._rock.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    this._trailHist.push(this._group.position.clone());
  }

  onAttach(ctx) {
    this._scene = ctx.scene;
    ctx.scene.scene.add(this._group);
    const t = this.entity.get('TransformComponent');
    if (t) t.position.copy(this._group.position);

    this.entity.get('ColliderComponent').onHit = (other) => {
      if (other.hasTag('player')) {
        eventBus.emit(EVENTS.PLAYER_DAMAGED, { amount: this.damage, source: 'asteroid' });
        const h = this.entity.get('HealthComponent');
        if (h) h.takeDamage(this.damage, { ignoreArmor: true });
        if (h?.dead) this._break(ctx);
      } else if (other.hasTag('enemy')) {
        other.get('HealthComponent')?.takeDamage(this.damage, { source: 'asteroid' });
        const h = this.entity.get('HealthComponent');
        if (h) h.takeDamage(this.damage, { ignoreArmor: true });
        if (h?.dead) this._break(ctx);
      }
      // playerProjectile: ProjectileDamageComponent applies damage via HealthComponent;
      // break is detected in update() once health.dead becomes true.
    };
  }

  onDetach() {
    if (this._scene) this._scene.scene.remove(this._group);
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  _updateTrail() {
    const p = this._group.position;
    const hist = this._trailHist;
    const n = hist.length;
    const posAttr = this._trailGeo.getAttribute('position');
    const arr = posAttr.array;
    if (n >= 2) {
      let k = 0;
      for (let i = 0; i < n && k < TRAIL_VERTEX_CAP * 3; i++) {
        arr[k++] = hist[i].x - p.x;
        arr[k++] = hist[i].y - p.y;
        arr[k++] = hist[i].z - p.z;
      }
      posAttr.needsUpdate = true;
      this._trailGeo.setDrawRange(0, n);
    }
    const dPos = this._dustGeo.getAttribute('position');
    const dArr = dPos.array;
    for (let i = 0; i < this._dustCount; i++) {
      const t = i / Math.max(1, this._dustCount - 1);
      const idx = Math.min(n - 1, Math.floor(t * Math.max(1, n - 1)));
      const h = hist[idx] || p;
      const jit = this._dustJitter[i];
      dArr[i * 3]     = h.x - p.x + jit[0];
      dArr[i * 3 + 1] = h.y - p.y + jit[1];
      dArr[i * 3 + 2] = h.z - p.z + jit[2];
    }
    dPos.needsUpdate = true;
  }

  update(dt, ctx) {
    const health = this.entity.get('HealthComponent');
    if (health?.dead) { this._break(ctx); return; }

    const speedScale = ctx?.state?.round?.speedScale ?? 1;
    const s = Math.max(0, speedScale);
    this._group.position.addScaledVector(this.velocity, dt * s);
    this._trailHist.unshift(this._group.position.clone());
    while (this._trailHist.length > this._trailCap) this._trailHist.pop();
    this._rock.rotation.x += this._rotVel.x * dt;
    this._rock.rotation.y += this._rotVel.y * dt;
    this._rock.rotation.z += this._rotVel.z * dt;
    this._updateTrail();

    const p = this._group.position;
    const t = this.entity.get('TransformComponent');
    if (t) t.position.copy(p);

    if (p.z > 14 || p.z < -110 || Math.abs(p.x) > 52) {
      this.entity.destroy();
    }
  }

  _break(ctx) {
    eventBus.emit(EVENTS.ASTEROID_BROKEN, { position: this._group.position.clone() });
    const cfg = SIZE_CONFIG[this.size];
    if (cfg.fragmentType) {
      for (let i = 0; i < cfg.fragmentCount; i++) {
        const angle = (i / cfg.fragmentCount) * Math.PI * 2 + (Math.random() - 0.5) * 1.2;
        const outSpeed = 2.0 + Math.random() * 3.0;
        const outDir = new THREE.Vector3(Math.cos(angle) * outSpeed, 0, Math.sin(angle) * outSpeed);
        const fragVel = this.velocity.clone().add(outDir);
        const fragPos = this._group.position.clone().add(
          outDir.clone().normalize().multiplyScalar(this.collisionRadius * 0.6)
        );
        const frag = ctx.createAsteroid ? ctx.createAsteroid(cfg.fragmentType, fragPos, fragVel) : null;
        if (frag) ctx.world.spawn(frag);
      }
    }
    this.entity.destroy();
  }
}
