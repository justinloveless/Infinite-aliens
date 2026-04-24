/**
 * Visual environment configs for each of the 10 galaxies in the campaign.
 * Each preset controls fog, lighting, bloom, grid color, star color, and sky.
 * arenaVariant overrides apply during the boss arena phase (more dramatic).
 */
export const GALAXY_PRESETS = [
  // 0: Milky Way — deep violet/purple (game default)
  {
    name: 'Milky Way',
    fogColor: 0x3e2f6f, fogNear: 40, fogFar: 110,
    bgColor: 0x3e2f6f,
    ambientColor: 0x4a6f8f, ambientIntensity: 1.0,
    dirColor: 0xffffff,  dirIntensity: 2.13,
    fillColor: 0x220044, fillIntensity: 1.5,
    bloomStrength: 0.60, bloomRadius: 0.74, bloomThreshold: 0.48,
    gridColor: 0xff00dd,
    starColor: 0xffffff,
    exposure: 1.28,
    arenaVariant: {
      fogNear: 80, fogFar: 450,
      bloomStrength: 0.85, bloomRadius: 0.9, bloomThreshold: 0.42,
    },
  },
  // 1: Andromeda — cold steel blue
  {
    name: 'Andromeda',
    fogColor: 0x0d1e4a, fogNear: 38, fogFar: 115,
    bgColor: 0x080f2a,
    ambientColor: 0x1e3a70, ambientIntensity: 0.90,
    dirColor: 0x88aaff,  dirIntensity: 2.4,
    fillColor: 0x001166, fillIntensity: 2.0,
    bloomStrength: 0.68, bloomRadius: 0.80, bloomThreshold: 0.45,
    gridColor: 0x0077ff,
    starColor: 0xaaccff,
    exposure: 1.35,
    arenaVariant: {
      fogNear: 80, fogFar: 460,
      bloomStrength: 0.95, bloomRadius: 0.95, bloomThreshold: 0.38,
    },
  },
  // 2: Triangulum — teal/green nebula
  {
    name: 'Triangulum',
    fogColor: 0x062e2e, fogNear: 38, fogFar: 113,
    bgColor: 0x031a1a,
    ambientColor: 0x1a5c5c, ambientIntensity: 1.0,
    dirColor: 0x80ffee,  dirIntensity: 2.0,
    fillColor: 0x003322, fillIntensity: 1.8,
    bloomStrength: 0.65, bloomRadius: 0.78, bloomThreshold: 0.46,
    gridColor: 0x00ffcc,
    starColor: 0xaaffee,
    exposure: 1.30,
    arenaVariant: {
      fogNear: 80, fogFar: 440,
      bloomStrength: 0.90, bloomRadius: 0.92, bloomThreshold: 0.40,
    },
  },
  // 3: Large Magellanic Cloud — warm gold dust
  {
    name: 'Large Magellanic Cloud',
    fogColor: 0x3a2500, fogNear: 36, fogFar: 107,
    bgColor: 0x200e00,
    ambientColor: 0x7a4a10, ambientIntensity: 1.05,
    dirColor: 0xffdd88,  dirIntensity: 2.2,
    fillColor: 0x441100, fillIntensity: 1.6,
    bloomStrength: 0.65, bloomRadius: 0.76, bloomThreshold: 0.46,
    gridColor: 0xffaa00,
    starColor: 0xffe8aa,
    exposure: 1.32,
    arenaVariant: {
      fogNear: 75, fogFar: 420,
      bloomStrength: 0.92, bloomRadius: 0.92, bloomThreshold: 0.40,
    },
  },
  // 4: Small Magellanic Cloud — pink/rose dwarf
  {
    name: 'Small Magellanic Cloud',
    fogColor: 0x3d0e2a, fogNear: 36, fogFar: 105,
    bgColor: 0x220010,
    ambientColor: 0x7a1a50, ambientIntensity: 0.97,
    dirColor: 0xff88cc,  dirIntensity: 2.1,
    fillColor: 0x330022, fillIntensity: 1.7,
    bloomStrength: 0.67, bloomRadius: 0.80, bloomThreshold: 0.45,
    gridColor: 0xff44bb,
    starColor: 0xffbbdd,
    exposure: 1.28,
    arenaVariant: {
      fogNear: 75, fogFar: 420,
      bloomStrength: 0.95, bloomRadius: 0.95, bloomThreshold: 0.38,
    },
  },
  // 5: Whirlpool — deep cyan vortex
  {
    name: 'Whirlpool',
    fogColor: 0x002233, fogNear: 35, fogFar: 103,
    bgColor: 0x001122,
    ambientColor: 0x0a6070, ambientIntensity: 0.95,
    dirColor: 0x00ffff,  dirIntensity: 2.3,
    fillColor: 0x002244, fillIntensity: 2.0,
    bloomStrength: 0.75, bloomRadius: 0.85, bloomThreshold: 0.44,
    gridColor: 0x00eeff,
    starColor: 0x88ffff,
    exposure: 1.38,
    arenaVariant: {
      fogNear: 70, fogFar: 400,
      bloomStrength: 1.05, bloomRadius: 1.0, bloomThreshold: 0.36,
    },
  },
  // 6: Sombrero — dark charcoal with bright equatorial band
  {
    name: 'Sombrero',
    fogColor: 0x151515, fogNear: 35, fogFar: 100,
    bgColor: 0x0a0a0a,
    ambientColor: 0x383838, ambientIntensity: 0.85,
    dirColor: 0xffffff,  dirIntensity: 2.8,
    fillColor: 0x111111, fillIntensity: 1.2,
    bloomStrength: 0.70, bloomRadius: 0.72, bloomThreshold: 0.44,
    gridColor: 0xffffff,
    starColor: 0xffffff,
    exposure: 1.50,
    arenaVariant: {
      fogNear: 65, fogFar: 380,
      bloomStrength: 1.05, bloomRadius: 0.90, bloomThreshold: 0.36,
    },
  },
  // 7: Pinwheel — vivid multi-arm spiral, orange/yellow arms
  {
    name: 'Pinwheel',
    fogColor: 0x2a1800, fogNear: 34, fogFar: 105,
    bgColor: 0x150c00,
    ambientColor: 0x664020, ambientIntensity: 1.0,
    dirColor: 0xffcc44,  dirIntensity: 2.1,
    fillColor: 0x220800, fillIntensity: 1.5,
    bloomStrength: 0.67, bloomRadius: 0.78, bloomThreshold: 0.45,
    gridColor: 0xff8800,
    starColor: 0xffddaa,
    exposure: 1.30,
    arenaVariant: {
      fogNear: 70, fogFar: 400,
      bloomStrength: 0.92, bloomRadius: 0.92, bloomThreshold: 0.38,
    },
  },
  // 8: Centaurus A — radio jets, electric indigo
  {
    name: 'Centaurus A',
    fogColor: 0x1a0040, fogNear: 32, fogFar: 97,
    bgColor: 0x0d0020,
    ambientColor: 0x450090, ambientIntensity: 1.05,
    dirColor: 0xbb88ff,  dirIntensity: 2.4,
    fillColor: 0x110033, fillIntensity: 2.2,
    bloomStrength: 0.75, bloomRadius: 0.88, bloomThreshold: 0.42,
    gridColor: 0x9900ff,
    starColor: 0xcc99ff,
    exposure: 1.40,
    arenaVariant: {
      fogNear: 65, fogFar: 380,
      bloomStrength: 1.10, bloomRadius: 1.0, bloomThreshold: 0.34,
    },
  },
  // 9: Cartwheel — ring galaxy, fiery crimson edge
  {
    name: 'Cartwheel',
    fogColor: 0x3a0000, fogNear: 30, fogFar: 93,
    bgColor: 0x1e0000,
    ambientColor: 0x7a1010, ambientIntensity: 1.05,
    dirColor: 0xff4400,  dirIntensity: 2.5,
    fillColor: 0x330000, fillIntensity: 2.0,
    bloomStrength: 0.78, bloomRadius: 0.90, bloomThreshold: 0.42,
    gridColor: 0xff1100,
    starColor: 0xff9988,
    exposure: 1.42,
    arenaVariant: {
      fogNear: 60, fogFar: 360,
      bloomStrength: 1.15, bloomRadius: 1.05, bloomThreshold: 0.34,
    },
  },
];

export function getPreset(galaxyIndex) {
  return GALAXY_PRESETS[Math.max(0, Math.min(GALAXY_PRESETS.length - 1, galaxyIndex))];
}
