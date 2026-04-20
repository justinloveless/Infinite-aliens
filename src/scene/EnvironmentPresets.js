/**
 * Visual environment configs for each of the 10 galaxies in the campaign.
 * Each preset controls fog, lighting, bloom, grid color, star color, and sky.
 * arenaVariant overrides apply during the boss arena phase (more dramatic).
 */
export const GALAXY_PRESETS = [
  // 0: Milky Way — deep violet/purple (game default)
  {
    name: 'Milky Way',
    fogColor: 0x3e2f6f, fogNear: 40, fogFar: 85,
    bgColor: 0x3e2f6f,
    ambientColor: 0x2f4f6f, ambientIntensity: 0.7,
    dirColor: 0xffffff,  dirIntensity: 2.13,
    fillColor: 0x220044, fillIntensity: 1.5,
    bloomStrength: 0.45, bloomRadius: 0.74, bloomThreshold: 0.65,
    gridColor: 0xff00dd,
    starColor: 0xffffff,
    exposure: 1.28,
    arenaVariant: {
      fogNear: 80, fogFar: 450,
      bloomStrength: 0.80, bloomRadius: 0.9, bloomThreshold: 0.55,
    },
  },
  // 1: Andromeda — cold steel blue
  {
    name: 'Andromeda',
    fogColor: 0x0d1e4a, fogNear: 38, fogFar: 90,
    bgColor: 0x080f2a,
    ambientColor: 0x102255, ambientIntensity: 0.65,
    dirColor: 0x88aaff,  dirIntensity: 2.4,
    fillColor: 0x001166, fillIntensity: 2.0,
    bloomStrength: 0.55, bloomRadius: 0.80, bloomThreshold: 0.60,
    gridColor: 0x0077ff,
    starColor: 0xaaccff,
    exposure: 1.35,
    arenaVariant: {
      fogNear: 80, fogFar: 460,
      bloomStrength: 0.90, bloomRadius: 0.95, bloomThreshold: 0.50,
    },
  },
  // 2: Triangulum — teal/green nebula
  {
    name: 'Triangulum',
    fogColor: 0x062e2e, fogNear: 38, fogFar: 88,
    bgColor: 0x031a1a,
    ambientColor: 0x0d4040, ambientIntensity: 0.75,
    dirColor: 0x80ffee,  dirIntensity: 2.0,
    fillColor: 0x003322, fillIntensity: 1.8,
    bloomStrength: 0.50, bloomRadius: 0.78, bloomThreshold: 0.62,
    gridColor: 0x00ffcc,
    starColor: 0xaaffee,
    exposure: 1.30,
    arenaVariant: {
      fogNear: 80, fogFar: 440,
      bloomStrength: 0.85, bloomRadius: 0.92, bloomThreshold: 0.52,
    },
  },
  // 3: Large Magellanic Cloud — warm gold dust
  {
    name: 'Large Magellanic Cloud',
    fogColor: 0x3a2500, fogNear: 36, fogFar: 82,
    bgColor: 0x200e00,
    ambientColor: 0x553300, ambientIntensity: 0.80,
    dirColor: 0xffdd88,  dirIntensity: 2.2,
    fillColor: 0x441100, fillIntensity: 1.6,
    bloomStrength: 0.50, bloomRadius: 0.76, bloomThreshold: 0.62,
    gridColor: 0xffaa00,
    starColor: 0xffe8aa,
    exposure: 1.32,
    arenaVariant: {
      fogNear: 75, fogFar: 420,
      bloomStrength: 0.88, bloomRadius: 0.92, bloomThreshold: 0.52,
    },
  },
  // 4: Small Magellanic Cloud — pink/rose dwarf
  {
    name: 'Small Magellanic Cloud',
    fogColor: 0x3d0e2a, fogNear: 36, fogFar: 80,
    bgColor: 0x220010,
    ambientColor: 0x550033, ambientIntensity: 0.72,
    dirColor: 0xff88cc,  dirIntensity: 2.1,
    fillColor: 0x330022, fillIntensity: 1.7,
    bloomStrength: 0.52, bloomRadius: 0.80, bloomThreshold: 0.60,
    gridColor: 0xff44bb,
    starColor: 0xffbbdd,
    exposure: 1.28,
    arenaVariant: {
      fogNear: 75, fogFar: 420,
      bloomStrength: 0.90, bloomRadius: 0.95, bloomThreshold: 0.50,
    },
  },
  // 5: Whirlpool — deep cyan vortex
  {
    name: 'Whirlpool',
    fogColor: 0x002233, fogNear: 35, fogFar: 78,
    bgColor: 0x001122,
    ambientColor: 0x004455, ambientIntensity: 0.70,
    dirColor: 0x00ffff,  dirIntensity: 2.3,
    fillColor: 0x002244, fillIntensity: 2.0,
    bloomStrength: 0.60, bloomRadius: 0.85, bloomThreshold: 0.58,
    gridColor: 0x00eeff,
    starColor: 0x88ffff,
    exposure: 1.38,
    arenaVariant: {
      fogNear: 70, fogFar: 400,
      bloomStrength: 1.00, bloomRadius: 1.0, bloomThreshold: 0.48,
    },
  },
  // 6: Sombrero — dark charcoal with bright equatorial band
  {
    name: 'Sombrero',
    fogColor: 0x151515, fogNear: 35, fogFar: 75,
    bgColor: 0x0a0a0a,
    ambientColor: 0x202020, ambientIntensity: 0.60,
    dirColor: 0xffffff,  dirIntensity: 2.6,
    fillColor: 0x111111, fillIntensity: 1.2,
    bloomStrength: 0.55, bloomRadius: 0.72, bloomThreshold: 0.58,
    gridColor: 0xffffff,
    starColor: 0xffffff,
    exposure: 1.45,
    arenaVariant: {
      fogNear: 65, fogFar: 380,
      bloomStrength: 0.95, bloomRadius: 0.90, bloomThreshold: 0.48,
    },
  },
  // 7: Pinwheel — vivid multi-arm spiral, orange/yellow arms
  {
    name: 'Pinwheel',
    fogColor: 0x2a1800, fogNear: 34, fogFar: 80,
    bgColor: 0x150c00,
    ambientColor: 0x442200, ambientIntensity: 0.75,
    dirColor: 0xffcc44,  dirIntensity: 2.1,
    fillColor: 0x220800, fillIntensity: 1.5,
    bloomStrength: 0.52, bloomRadius: 0.78, bloomThreshold: 0.60,
    gridColor: 0xff8800,
    starColor: 0xffddaa,
    exposure: 1.30,
    arenaVariant: {
      fogNear: 70, fogFar: 400,
      bloomStrength: 0.88, bloomRadius: 0.92, bloomThreshold: 0.50,
    },
  },
  // 8: Centaurus A — radio jets, electric indigo
  {
    name: 'Centaurus A',
    fogColor: 0x1a0040, fogNear: 32, fogFar: 72,
    bgColor: 0x0d0020,
    ambientColor: 0x2a0060, ambientIntensity: 0.78,
    dirColor: 0xbb88ff,  dirIntensity: 2.4,
    fillColor: 0x110033, fillIntensity: 2.2,
    bloomStrength: 0.62, bloomRadius: 0.88, bloomThreshold: 0.56,
    gridColor: 0x9900ff,
    starColor: 0xcc99ff,
    exposure: 1.40,
    arenaVariant: {
      fogNear: 65, fogFar: 380,
      bloomStrength: 1.05, bloomRadius: 1.0, bloomThreshold: 0.46,
    },
  },
  // 9: Cartwheel — ring galaxy, fiery crimson edge
  {
    name: 'Cartwheel',
    fogColor: 0x3a0000, fogNear: 30, fogFar: 68,
    bgColor: 0x1e0000,
    ambientColor: 0x550000, ambientIntensity: 0.80,
    dirColor: 0xff4400,  dirIntensity: 2.5,
    fillColor: 0x330000, fillIntensity: 2.0,
    bloomStrength: 0.65, bloomRadius: 0.90, bloomThreshold: 0.55,
    gridColor: 0xff1100,
    starColor: 0xff9988,
    exposure: 1.42,
    arenaVariant: {
      fogNear: 60, fogFar: 360,
      bloomStrength: 1.10, bloomRadius: 1.05, bloomThreshold: 0.44,
    },
  },
];

export function getPreset(galaxyIndex) {
  return GALAXY_PRESETS[Math.max(0, Math.min(GALAXY_PRESETS.length - 1, galaxyIndex))];
}
