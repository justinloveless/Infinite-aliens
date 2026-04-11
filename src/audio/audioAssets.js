// All files below live in public/audio/ (export from Suno with these exact names, or edit the map).

/** @typedef {{ file: string, prompt: string }} AudioSpec */

/** @type {Record<string, AudioSpec>} */
export const MUSIC_SPECS = {
  combat: {
    file: 'Nebula Drift.mp3',
    prompt:
      'Cozy lo-fi synthwave space exploration music, gentle pulsing bass, warm analog pads, soft arpeggiated synths, dreamy and relaxing but with forward momentum, 90 BPM, seamless loop, retro-futuristic ambient, no vocals',
  },
  'tech-tree': {
    file: 'Crystal Orbits.mp3',
    prompt:
      'Calm ambient space music, soft crystalline chimes, warm analog synth pads, gentle evolving textures, contemplative and peaceful, slight reverb, 70 BPM, seamless loop, sci-fi meditation music, no vocals',
  },
  boss: {
    file: 'Starlight Boss Circuit.mp3',
    prompt:
      'Epic but cozy synthwave boss battle music, deeper bass pulse, dramatic analog synth leads, tension building but not aggressive, retro-futuristic space combat, 110 BPM, seamless loop, warm and exciting, no vocals',
  },
};

/** Logical music keys → filename (built from MUSIC_SPECS for a single edit point). */
export const MUSIC_BY_KEY = Object.fromEntries(
  Object.entries(MUSIC_SPECS).map(([k, v]) => [k, v.file])
);

/** @type {Record<string, AudioSpec>} */
export const SFX_SPECS = {
  laser: {
    file: 'sfx-laser.mp3',
    prompt:
      'Single short retro laser blaster sound effect, warm analog synth zap, soft sci-fi pew sound, 0.3 seconds, cozy and satisfying, not harsh, vintage space game',
  },
  missile: {
    file: 'sfx-missile-launch.mp3',
    prompt:
      'Short whoosh-and-ignite missile launch sound effect, warm analog synth, soft rocket thrust, 0.5 seconds, retro-futuristic, satisfying launch sound',
  },
  plasma: {
    file: 'sfx-plasma-shot.mp3',
    prompt:
      'Short bubbly energy plasma shot sound effect, warm resonant synth pulse, soft sci-fi energy burst, 0.3 seconds, cozy retro space game',
  },
  hit: {
    file: 'sfx-enemy-hit.mp3',
    prompt:
      'Very short soft impact thud sound effect, warm analog crunch, 0.2 seconds, satisfying hit feedback, retro space game, not harsh',
  },
  explosion: {
    file: 'sfx-enemy-explosion.mp3',
    prompt:
      'Short warm retro explosion sound effect, soft analog synth burst with gentle crackle, 0.5 seconds, satisfying destruction, cozy space game, not loud or harsh',
  },
  bossExplosion: {
    file: 'sfx-boss-explosion.mp3',
    prompt:
      'Medium dramatic retro explosion sound effect, warm layered analog synth burst, deeper resonance, 1 second, epic but cozy, satisfying boss defeat, vintage sci-fi',
  },
  pickup: {
    file: 'sfx-loot-pickup.mp3',
    prompt:
      'Very short bright chime pickup sound effect, warm crystalline ding, 0.2 seconds, satisfying collection sound, retro space game coin pickup, cheerful',
  },
  rarePickup: {
    file: 'sfx-rare-loot-pickup.mp3',
    prompt:
      'Short mystical resonant chime sound effect, deep warm reverb bell tone, 0.4 seconds, magical and special feeling, retro-futuristic rare item pickup',
  },
  shieldHit: {
    file: 'sfx-shield-hit.mp3',
    prompt:
      'Short soft energy shield deflection sound effect, warm buzzy synth ripple, 0.3 seconds, protective barrier impact, retro sci-fi, gentle',
  },
  playerDamage: {
    file: 'sfx-player-damage.mp3',
    prompt:
      'Short soft warning thud sound effect, warm low analog synth bump, 0.2 seconds, gentle damage feedback, not alarming, cozy space game',
  },
  upgrade: {
    file: 'sfx-tech-purchase.mp3',
    prompt:
      'Short satisfying upgrade unlock sound effect, warm ascending synth chime with soft sparkle, 0.5 seconds, rewarding confirmation, retro-futuristic level up',
  },
  hover: {
    file: 'sfx-tech-hover.mp3',
    prompt:
      'Very short soft UI hover sound effect, gentle warm synth tick, 0.1 seconds, subtle interface feedback, retro-futuristic menu',
  },
  launch: {
    file: 'sfx-round-launch.mp3',
    prompt:
      'Short energetic launch whoosh sound effect, warm synth engine ignition ascending, 0.8 seconds, exciting departure, retro-futuristic thruster engage',
  },
  crit: {
    file: 'sfx-crit-hit.mp3',
    prompt:
      'Short punchy enhanced impact sound effect, warm analog synth crunch with bright sparkle overlay, 0.3 seconds, extra satisfying hit, retro space game',
  },
  roundComplete: {
    file: 'round-transition-jingle.mp3',
    prompt:
      'Short triumphant synthwave victory fanfare, 5 seconds, warm bright synth chords ascending, satisfying completion sound, retro space game jingle, cheerful and cozy, no vocals',
  },
  death: {
    file: 'death-ship-destroyed.mp3',
    prompt:
      'Short gentle melancholic synth melody, 4 seconds, soft descending warm pads, not sad but reflective, cozy space game over jingle, analog synth, comforting tone, no vocals',
  },
  droneSpawn: {
    file: 'sfx-drone-spawn.mp3',
    prompt:
      'Short warm digital materialization sound effect, soft ascending synth with gentle sparkle, 0.6 seconds, friendly ally appearing, retro-futuristic',
  },
};

export const SFX_BY_KEY = Object.fromEntries(
  Object.entries(SFX_SPECS).map(([k, v]) => [k, v.file])
);

/** @param {string} filename */
export function urlPublicAudio(filename) {
  return `./audio/${encodeURIComponent(filename)}`;
}
