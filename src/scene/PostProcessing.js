import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BLOOM } from '../constants.js';
import { ChromaticAberrationShader, ScanlineShader, ColorGradeShader, FilmGrainShader } from './ShaderPasses.js';

export function setupPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  // 1. Render pass
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM.STRENGTH,
    BLOOM.RADIUS,
    BLOOM.THRESHOLD
  );
  composer.addPass(bloom);

  // 3. Chromatic Aberration
  const chromatic = new ShaderPass(ChromaticAberrationShader);
  composer.addPass(chromatic);

  // 4. Color Grading + Vignette
  const colorGrade = new ShaderPass(ColorGradeShader);
  composer.addPass(colorGrade);

  // 5. Scanlines
  const scanlines = new ShaderPass(ScanlineShader);
  composer.addPass(scanlines);

  // 6. Film Grain (final pass, renders to screen)
  const grain = new ShaderPass(FilmGrainShader);
  grain.renderToScreen = true;
  composer.addPass(grain);

  const postPasses = { bloom, chromatic, colorGrade, scanlines, grain };

  return { composer, postPasses };
}
