import * as THREE from 'three';
import { SCENE, BLOOM } from '../constants.js';
import { GALAXY_PRESETS } from './EnvironmentPresets.js';

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
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;

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
    this.ambientLight = ambient;

    const dir = new THREE.DirectionalLight(SCENE.DIR_COLOR, SCENE.DIR_INTENSITY);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
    this.directionalLight = dir;

    const fill = new THREE.DirectionalLight(0x220044, 1.5);
    fill.position.set(-5, -5, 5);
    this.scene.add(fill);
    this.fillLight = fill;
  }

  _setupFog() {
    this.scene.fog = new THREE.Fog(SCENE.FOG_COLOR, SCENE.FOG_NEAR, SCENE.FOG_FAR);
    this.scene.background = new THREE.Color(0x3e2f6f);
  }

  _addGroups() {
    Object.values(this.groups).forEach(g => this.scene.add(g));
  }

  render() {
    // When every post-pass is disabled, skip the composer entirely. Even an
    // all-disabled EffectComposer still blits its float render target to the
    // screen, which on some hybrid-GPU Windows setups stalls the driver for
    // hundreds of ms. Plain renderer.render() avoids that path completely.
    if (this.composer && !this._bypassComposer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setComposer(composer) {
    this.composer = composer;
  }

  /** Fully bypass the composer (not just disable passes). Plain WebGL render. */
  setBypassComposer(on) {
    this._bypassComposer = !!on;
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

  /**
   * Begin transitioning to a new galaxy environment preset.
   * @param {object} preset - from EnvironmentPresets.js
   * @param {boolean} instant - apply immediately (no lerp)
   */
  applyEnvironment(preset, instant = false) {
    this._envTarget = preset;
    if (instant) {
      this._applyPresetImmediate(preset);
      this._envLerpT = 1;
      this._envStart = null;
    } else {
      this._envStart = this._snapshotCurrentEnv();
      this._envLerpT = 0;
    }
  }

  _snapshotCurrentEnv() {
    const fog = this.scene.fog;
    return {
      fogColor:         new THREE.Color(fog.color),
      fogNear:          fog.near,
      fogFar:           fog.far,
      bgColor:          new THREE.Color(this.scene.background),
      ambientColor:     new THREE.Color(this.ambientLight.color),
      ambientIntensity: this.ambientLight.intensity,
      dirColor:         new THREE.Color(this.directionalLight.color),
      dirIntensity:     this.directionalLight.intensity,
      fillColor:        new THREE.Color(this.fillLight.color),
      fillIntensity:    this.fillLight.intensity,
      exposure:         this.renderer.toneMappingExposure,
    };
  }

  _applyPresetImmediate(p) {
    this.scene.fog.color.setHex(p.fogColor);
    this.scene.fog.near  = p.fogNear;
    this.scene.fog.far   = p.fogFar;
    this.scene.background.setHex(p.bgColor);
    this.ambientLight.color.setHex(p.ambientColor);
    this.ambientLight.intensity     = p.ambientIntensity;
    this.directionalLight.color.setHex(p.dirColor);
    this.directionalLight.intensity = p.dirIntensity;
    this.fillLight.color.setHex(p.fillColor);
    this.fillLight.intensity        = p.fillIntensity;
    this.renderer.toneMappingExposure = p.exposure;
  }

  /** Call every frame from main._tick() to animate environment transitions. */
  lerpEnvironment(dt) {
    if (!this._envTarget || !this._envStart || this._envLerpT >= 1) return;
    this._envLerpT = Math.min(1, this._envLerpT + dt / 2.5);
    const t = this._envLerpT;
    const s = this._envStart;
    const p = this._envTarget;

    this.scene.fog.color.lerpColors(s.fogColor, new THREE.Color(p.fogColor), t);
    this.scene.fog.near  = s.fogNear  + (p.fogNear  - s.fogNear)  * t;
    this.scene.fog.far   = s.fogFar   + (p.fogFar   - s.fogFar)   * t;
    this.scene.background.lerpColors(s.bgColor, new THREE.Color(p.bgColor), t);
    this.ambientLight.color.lerpColors(s.ambientColor, new THREE.Color(p.ambientColor), t);
    this.ambientLight.intensity     = s.ambientIntensity + (p.ambientIntensity - s.ambientIntensity) * t;
    this.directionalLight.color.lerpColors(s.dirColor, new THREE.Color(p.dirColor), t);
    this.directionalLight.intensity = s.dirIntensity + (p.dirIntensity - s.dirIntensity) * t;
    this.fillLight.color.lerpColors(s.fillColor, new THREE.Color(p.fillColor), t);
    this.fillLight.intensity        = s.fillIntensity + (p.fillIntensity - s.fillIntensity) * t;
    this.renderer.toneMappingExposure = s.exposure + (p.exposure - s.exposure) * t;

    if (t >= 1) this._envStart = null;
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
