import * as THREE from 'three';

const SIZE_CONFIG = {
  large:  { radius: 1.5, speedMin: 1.5, speedMax: 3.0, fragmentType: 'medium', fragmentCount: 3, damage: 18 },
  medium: { radius: 0.8, speedMin: 2.0, speedMax: 4.0, fragmentType: 'small',  fragmentCount: 2, damage: 10 },
  small:  { radius: 0.4, speedMin: 2.5, speedMax: 5.0, fragmentType: null,     fragmentCount: 0, damage: 5  },
};

const TRAIL_VERTEX_CAP = 48;

// Shared geometry cache per size to reduce allocations
const GEO_CACHE = {};
function getGeo(size) {
  if (!GEO_CACHE[size]) {
    GEO_CACHE[size] = new THREE.IcosahedronGeometry(SIZE_CONFIG[size].radius, 1);
  }
  return GEO_CACHE[size];
}

export class Asteroid {
  constructor(size, position = null, velocity = null) {
    this.size = size;
    this.active = true;

    const cfg = SIZE_CONFIG[size];
    this.collisionRadius = cfg.radius;
    this._damage = cfg.damage;

    // Root group: position in world; rock tumbles as child so trail stays path-aligned
    this.mesh = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xc4c4c4).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
      roughness: 0.9,
      metalness: 0.1,
    });
    this._rock = new THREE.Mesh(getGeo(size), mat);
    this.mesh.add(this._rock);

    // Motion trail (additive cool dust — reads differently from enemy emissive hulls)
    this._trailCap = Math.min(
      TRAIL_VERTEX_CAP,
      10 + Math.round(26 * (cfg.radius / SIZE_CONFIG.large.radius))
    );
    this._trailHist = [];
    const trailPos = new Float32Array(TRAIL_VERTEX_CAP * 3);
    this._trailGeo = new THREE.BufferGeometry();
    this._trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    this._trailGeo.setDrawRange(0, 0);

    const trailMat = new THREE.LineBasicMaterial({
      color: 0xa8d8f0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._trailLine = new THREE.Line(this._trailGeo, trailMat);
    this.mesh.add(this._trailLine);

    // Sparkle dots along the same path (slightly warmer — reads as chipped rock / dust)
    const dustCount = Math.min(20, 4 + Math.floor(14 * (cfg.radius / SIZE_CONFIG.large.radius)));
    const dustPos = new Float32Array(dustCount * 3);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd8e8f0,
      size: 0.09 + cfg.radius * 0.04,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this._dustPoints = new THREE.Points(dustGeo, dustMat);
    this._dustCount = dustCount;
    this._dustGeo = dustGeo;
    const j = 0.16 * cfg.radius;
    this._dustJx = new Float32Array(dustCount);
    this._dustJy = new Float32Array(dustCount);
    this._dustJz = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      this._dustJx[i] = (Math.random() - 0.5) * j;
      this._dustJy[i] = (Math.random() - 0.5) * j * 0.45;
      this._dustJz[i] = (Math.random() - 0.5) * j;
    }
    this.mesh.add(this._dustPoints);

    if (position) {
      this.mesh.position.copy(position);
    } else {
      this.mesh.position.set(
        (Math.random() - 0.5) * 36,
        0,
        -75 - Math.random() * 10
      );
    }

    if (velocity) {
      this.velocity = velocity.clone();
    } else {
      const speed = cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin);
      this.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0,
        speed
      );
    }

    this._rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      (Math.random() - 0.5) * 2.0,
      (Math.random() - 0.5) * 2.0
    );

    this._rock.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    this._trailHist.push(this.mesh.position.clone());
  }

  _updateTrailVisuals() {
    const p = this.mesh.position;
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
    } else {
      this._trailGeo.setDrawRange(0, 0);
    }

    // Subsample history onto dust points (spread along wake)
    const dPos = this._dustGeo.getAttribute('position');
    const dArr = dPos.array;
    const dc = this._dustCount;
    for (let i = 0; i < dc; i++) {
      const t = i / Math.max(1, dc - 1);
      const idx = Math.min(n - 1, Math.floor(t * Math.max(1, n - 1)));
      const h = hist[idx];
      dArr[i * 3]     = h.x - p.x + this._dustJx[i];
      dArr[i * 3 + 1] = h.y - p.y + this._dustJy[i];
      dArr[i * 3 + 2] = h.z - p.z + this._dustJz[i];
    }
    dPos.needsUpdate = true;
  }

  update(delta, speedScale = 1) {
    const p = this.mesh.position;
    const s = Math.max(0, speedScale);
    p.addScaledVector(this.velocity, delta * s);

    this._trailHist.unshift(p.clone());
    while (this._trailHist.length > this._trailCap) {
      this._trailHist.pop();
    }

    this._rock.rotation.x += this._rotVel.x * delta;
    this._rock.rotation.y += this._rotVel.y * delta;
    this._rock.rotation.z += this._rotVel.z * delta;

    this._updateTrailVisuals();

    if (p.z > 14 || p.z < -110 || Math.abs(p.x) > 52) {
      this.active = false;
    }
  }

  /**
   * Break this asteroid apart. Sets active=false and returns an array of
   * smaller Asteroid fragments with outward momentum.
   * @param {THREE.Vector3|null} impactDir - optional direction of the impacting projectile
   * @returns {Asteroid[]}
   */
  break(impactDir = null) {
    this.active = false;

    const cfg = SIZE_CONFIG[this.size];
    if (!cfg.fragmentType) return [];

    const frags = [];
    for (let i = 0; i < cfg.fragmentCount; i++) {
      const angle = (i / cfg.fragmentCount) * Math.PI * 2 + (Math.random() - 0.5) * 1.2;
      const outSpeed = 2.0 + Math.random() * 3.0;
      const outDir = new THREE.Vector3(
        Math.cos(angle) * outSpeed,
        0,
        Math.sin(angle) * outSpeed
      );

      const fragVel = this.velocity.clone().add(outDir);
      const fragPos = this.mesh.position.clone().add(
        outDir.clone().normalize().multiplyScalar(this.collisionRadius * 0.6)
      );

      frags.push(new Asteroid(cfg.fragmentType, fragPos, fragVel));
    }
    return frags;
  }

  get damage() { return this._damage; }
}
