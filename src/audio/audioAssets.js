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

  // Per-galaxy arena tracks. Played when the player warps into a galaxy's
  // boss arena. Each is tuned to the mood of the environment preset.
  'arena-0': {
    file: 'arena-milky-way.mp3',
    prompt:
      'Triumphant home-turf synthwave arena battle music, warm analog basslines, bright 80s lead synths, rising heroic melody with cozy retro-future optimism, driving but not aggressive, Milky Way core starship showdown, 118 BPM, seamless loop, no vocals',
  },
  'arena-1': {
    file: 'arena-andromeda.mp3',
    prompt:
      'Deep blue cosmic synthwave arena battle music, layered ethereal pads, shimmering arpeggios, steady kick pulse, mysterious alien beauty with forward momentum, Andromeda galaxy duel, 114 BPM, seamless loop, warm analog synths, no vocals',
  },
  'arena-2': {
    file: 'arena-triangulum.mp3',
    prompt:
      'Crystalline aquamarine synthwave arena battle music, bright pluck synths, bubbling sequenced bass, airy choir pads, hopeful and determined, cozy retro-futuristic combat, Triangulum ice-ring gate run, 120 BPM, seamless loop, no vocals',
  },
  'arena-3': {
    file: 'arena-large-magellanic.mp3',
    prompt:
      'Warm amber synthwave arena battle music, thick analog bass, soaring saw leads, sunset boulevard energy, confident and cruising but with tension, Large Magellanic Cloud showdown, 116 BPM, seamless loop, cozy retro-future, no vocals',
  },
  'arena-4': {
    file: 'arena-small-magellanic.mp3',
    prompt:
      'Neon pink dreampop synthwave arena battle music, gated reverb snare, cozy bright chorused synths, playful arpeggios, upbeat but melancholic undertone, Small Magellanic Cloud arena, 120 BPM, seamless loop, warm analog, no vocals',
  },
  'arena-5': {
    file: 'arena-whirlpool.mp3',
    prompt:
      'Swirling cyan synthwave arena battle music, rotating filtered pads, cascading delay arpeggios, driving octave bass, hypnotic spiraling motion, Whirlpool galaxy encounter, 122 BPM, seamless loop, warm and immersive, no vocals',
  },
  'arena-6': {
    file: 'arena-sombrero.mp3',
    prompt:
      'Regal ivory-and-black synthwave arena battle music, stately analog leads, orchestral hit stabs, steady powerful bass pulse, cinematic and confident, Sombrero galaxy duel, 112 BPM, seamless loop, cozy epic, no vocals',
  },
  'arena-7': {
    file: 'arena-pinwheel.mp3',
    prompt:
      'Fiery orange synthwave arena battle music, punchy gated drums, searing lead synth riffs, syncopated bass, exciting and kinetic with a grin, Pinwheel galaxy brawl, 124 BPM, seamless loop, warm retro-future, no vocals',
  },
  'arena-8': {
    file: 'arena-centaurus-a.mp3',
    prompt:
      'Dark violet synthwave arena battle music, brooding low analog bass, haunting minor-key leads, glitchy pulse textures, mysterious menace with forward drive, Centaurus A AGN showdown, 120 BPM, seamless loop, cozy sinister, no vocals',
  },
  'return-journey': {
    file: 'return-journey.mp3',
    prompt:
      'Urgent but cozy synthwave pursuit music, familiar melodic motifs played in minor key, reversed-feel analog arpeggio patterns, driving pulse with homeward momentum, 122 BPM, seamless loop, retro-futuristic, no vocals',
  },
  'arena-9': {
    file: 'arena-cartwheel.mp3',
    prompt:
      'Blazing crimson synthwave arena battle music, apocalyptic swelling pads, pounding four-on-the-floor kick, screaming lead synths, end-of-galaxy final-stand energy, Cartwheel galaxy last ring, 126 BPM, seamless loop, warm but urgent, no vocals',
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
  manualShot: {
    file: 'sfx-manual-shot.mp3',
    prompt:
      'Single punchy retro cannon blast sound effect, warm analog synth with a hard thud attack and short decay tail, 0.25 seconds, satisfying medium-weight weapon discharge, cozy retro space game, not too high-pitched, not too low — neutral tone that sounds good when pitch-shifted up or down',
  },
  manualOverheat: {
    file: 'sfx-manual-overheat.mp3',
    prompt:
      'Short mechanical overheat steam vent sound effect, warm hissing white noise with a descending metallic buzzing tone, 1.5 seconds, retro-futuristic sci-fi weapon cooling down, cozy but with a sense of urgency, analog synth steam release',
  },
  scanBeam: {
    file: 'sfx-scan-beam.mp3',
    prompt:
      'Smooth ascending-then-descending electronic scanner sweep sound effect, warm analog sine glide through two octaves, subtle digital processing texture, 1.8 seconds, retro-futuristic sensor scan, cozy but clinical, not harsh',
  },
  scanReveal: {
    file: 'sfx-scan-reveal.mp3',
    prompt:
      'Short sharp data-lock chime sound effect, warm analog synth with a brief digital stutter and click, 0.5 seconds, revelation/discovery moment, retro sci-fi alert tone, satisfying resolution with slight tension',
  },
  replication: {
    file: 'sfx-ship-replication.mp3',
    prompt:
      'Medium unsettling duplication/replication sound effect, deep resonant analog synth pulse with layered digital artifacting, warm-but-wrong timbre, 2 seconds, sci-fi object copying, retro-futuristic uncanny valley feeling, no vocals',
  },
  railgunCharge: {
    file: 'sfx-railgun-charge.mp3',
    prompt:
      'Rising electromagnetic charge-up whine sound effect, starts as a low hum and sweeps upward through 2.5 seconds to a high-pitched tension plateau, warm analog synth with slight harmonic distortion, retro-futuristic railgun powering up, cozy sci-fi weapon charging, ends at peak with sustained high tone',
  },
  railgunFire: {
    file: 'sfx-railgun-fire.mp3',
    prompt:
      'Sharp instantaneous railgun discharge crack sound effect, deep magnetic thud with a fast high-frequency electrical snap, 0.4 seconds, massive kinetic impact followed by brief ionized air hiss tail, retro-futuristic cozy sci-fi, satisfying and weighty but not harsh',
  },
};

export const SFX_BY_KEY = Object.fromEntries(
  Object.entries(SFX_SPECS).map(([k, v]) => [k, v.file])
);

/** @param {string} filename */
export function urlPublicAudio(filename) {
  return `./audio/${encodeURIComponent(filename)}`;
}
