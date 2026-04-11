import * as THREE from 'three';

export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    this.collisionRadius = 1.0;
    this._time = 0;
    this._thrusterLight = null;
    this._shieldMesh = null;
    this._engineParticles = [];

    this._buildMesh();
    scene.groups.player.add(this.group);
  }

  _buildMesh() {
    // Hull: elongated hexagonal cone
    const hullGeo = new THREE.ConeGeometry(0.55, 2.2, 6);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      emissive: 0x001122,
      metalness: 0.7,
      roughness: 0.3,
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.position.z = 0;
    this.group.add(hull);

    // Wings (left and right)
    const wingGeo = new THREE.BoxGeometry(1.8, 0.1, 0.8);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      emissive: 0x000a15,
      metalness: 0.8,
      roughness: 0.2,
    });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(-0.9, 0, 0.5);
    this.group.add(wingL);
    const wingR = wingL.clone();
    wingR.position.set(0.9, 0, 0.5);
    this.group.add(wingR);

    // Engine body
    const engineGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.55, 8);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      metalness: 0.9,
      roughness: 0.1,
    });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.z = 1.1;
    this.group.add(engine);

    // Engine glow (emissive disk)
    const glowGeo = new THREE.CircleGeometry(0.2, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.9,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.z = 1.38;
    this.group.add(glow);

    // Thruster point light
    this._thrusterLight = new THREE.PointLight(0x0088ff, 2.5, 5);
    this._thrusterLight.position.set(0, 0, 1.5);
    this.group.add(this._thrusterLight);

    // Cockpit accent
    const cockpitGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      emissive: 0x00a0bb,
      emissiveIntensity: 0.8,
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.z = -0.6;
    this.group.add(cockpit);

    // Shield visual (hidden by default)
    const shieldGeo = new THREE.SphereGeometry(1.5, 16, 12);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this._shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this._shieldMesh.visible = false;
    this.group.add(this._shieldMesh);

    // Wing accent lights
    const wingLight = new THREE.PointLight(0xff00ff, 0.5, 3);
    wingLight.position.set(0, 0, 0.4);
    this.group.add(wingLight);
  }

  setShieldVisible(hasShield) {
    this._shieldMesh.visible = hasShield;
  }

  flash(color = 0xff0000) {
    // Flash ship red on damage
    this.group.children.forEach(child => {
      if (child.material && child.material.emissive) {
        const origEmissive = child.material.emissive.getHex();
        child.material.emissive.setHex(color);
        setTimeout(() => {
          if (child.material) child.material.emissive.setHex(origEmissive);
        }, 120);
      }
    });
  }

  update(delta) {
    this._time += delta;
    // Gentle hover
    this.group.position.y = Math.sin(this._time * 1.2) * 0.1;
    // Subtle roll
    this.group.rotation.z = Math.sin(this._time * 0.5) * 0.04;
    // Engine pulse
    const pulse = 1.5 + Math.sin(this._time * 8) * 0.5;
    this._thrusterLight.intensity = pulse;
  }

  get position() { return this.group.position; }
}
