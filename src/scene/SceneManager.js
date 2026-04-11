import * as THREE from 'three';
import { SCENE, BLOOM } from '../constants.js';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.composer = null;

    // Groups for organized scene graph
    this.groups = {
      player: new THREE.Group(),
      enemies: new THREE.Group(),
      projectiles: new THREE.Group(),
      loot: new THREE.Group(),
      effects: new THREE.Group(),
      starfield: new THREE.Group(),
      grid: new THREE.Group(),
    };

    this._setupRenderer();
    this._setupCamera();
    this._setupLighting();
    this._setupFog();
    this._addGroups();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    window.addEventListener('resize', () => this._onResize());
  }

  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 9, 13);
    this.camera.lookAt(0, 0, -5);
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(SCENE.AMBIENT_COLOR, SCENE.AMBIENT_INTENSITY);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(SCENE.DIR_COLOR, SCENE.DIR_INTENSITY);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);

    // Subtle fill from below (blue-purple)
    const fill = new THREE.DirectionalLight(0x220044, 0.4);
    fill.position.set(-5, -5, 5);
    this.scene.add(fill);
  }

  _setupFog() {
    this.scene.fog = new THREE.Fog(SCENE.FOG_COLOR, SCENE.FOG_NEAR, SCENE.FOG_FAR);
    this.scene.background = new THREE.Color(0x050015);
  }

  _addGroups() {
    Object.values(this.groups).forEach(g => this.scene.add(g));
  }

  render() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setComposer(composer) {
    this.composer = composer;
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  // Project 3D world position to 2D screen coords
  worldToScreen(worldPos) {
    const pos = worldPos.clone().project(this.camera);
    return {
      x: (pos.x + 1) * 0.5 * window.innerWidth,
      y: (-pos.y + 1) * 0.5 * window.innerHeight,
    };
  }
}
