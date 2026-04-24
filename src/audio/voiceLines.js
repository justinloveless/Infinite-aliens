// PIP / ApotheCorp voice line catalog. This file is the source of truth for
// what the VoiceManager plays; the human-readable master script lives in
// docs/VOICE_BIBLE.md.
//
// Filenames below must match mp3 files you place in public/audio/voice/.
// Missing files are silently skipped at runtime, so partial recordings are safe.

/**
 * @typedef {Object} VoiceLine
 * @property {string} id         Unique id for the variant (used as cache key).
 * @property {string} file       Filename inside public/audio/voice/.
 * @property {string} text       Spoken text, for reference / subtitles later.
 */

/** Priority buckets. Higher priority interrupts lower priority mid-playback. */
export const VOICE_PRIORITY_LOW      = 0;
export const VOICE_PRIORITY_NORMAL   = 1;
export const VOICE_PRIORITY_HIGH     = 2;
export const VOICE_PRIORITY_CRITICAL = 3;

/** Per-trigger priority. Default when missing: NORMAL. */
export const VOICE_PRIORITY = {
  // Critical (never dropped, always interrupt)
  player_died:             VOICE_PRIORITY_CRITICAL,
  phoenix_revived:         VOICE_PRIORITY_CRITICAL,
  arena_transition_start:  VOICE_PRIORITY_CRITICAL,
  arena_transition_end:    VOICE_PRIORITY_CRITICAL,
  galaxy_boss_pending:     VOICE_PRIORITY_CRITICAL,
  campaign_advanced:       VOICE_PRIORITY_CRITICAL,

  // High (interrupt idle / normal flavor)
  arena_warning:           VOICE_PRIORITY_HIGH,
  arena_objective_intro:   VOICE_PRIORITY_HIGH,
  arena_building_gate:     VOICE_PRIORITY_HIGH,
  arena_ready_to_leave:    VOICE_PRIORITY_HIGH,
  hull_25:                 VOICE_PRIORITY_HIGH,
  hull_10:                 VOICE_PRIORITY_HIGH,
  shield_down:             VOICE_PRIORITY_HIGH,
  run_start:               VOICE_PRIORITY_HIGH,
  kill_milestone_100:      VOICE_PRIORITY_HIGH,

  // Normal (will not interrupt other normal / high lines)
  hull_75:                 VOICE_PRIORITY_NORMAL,
  hull_50:                 VOICE_PRIORITY_NORMAL,
  shield_restored:         VOICE_PRIORITY_NORMAL,
  upgrade_purchased:       VOICE_PRIORITY_NORMAL,
  ship_purchased:          VOICE_PRIORITY_NORMAL,
  ship_selected_allrounder:VOICE_PRIORITY_NORMAL,
  ship_selected_heavy:     VOICE_PRIORITY_NORMAL,
  ship_selected_fighter:   VOICE_PRIORITY_NORMAL,
  stellar_nova:            VOICE_PRIORITY_NORMAL,
  emp_fired:               VOICE_PRIORITY_NORMAL,
  kill_milestone_25:       VOICE_PRIORITY_NORMAL,

  // Low (background flavor)
  idle_flavor:             VOICE_PRIORITY_LOW,

  // Campaign scan & return journey
  boss_scan_ready:         VOICE_PRIORITY_CRITICAL,
  scan_complete:           VOICE_PRIORITY_HIGH,
  ship_replicated:         VOICE_PRIORITY_CRITICAL,
  return_journey_start:    VOICE_PRIORITY_CRITICAL,
  return_journey_complete: VOICE_PRIORITY_CRITICAL,
  run_start_return:        VOICE_PRIORITY_HIGH,
};

/**
 * Per-trigger cooldown in milliseconds. While a trigger is in cooldown, new
 * plays of the same key are dropped (threshold logic in VoiceManager means
 * the hull flags only rearm after hull climbs back up, so these cooldowns
 * mostly guard against rapid-fire event floods like upgrade_purchased).
 */
export const VOICE_COOLDOWNS = {
  hull_75:              45_000,
  hull_50:              40_000,
  hull_25:              30_000,
  hull_10:              20_000,
  shield_down:          15_000,
  shield_restored:      20_000,
  player_died:               0,
  phoenix_revived:           0,
  arena_warning:        60_000,
  arena_transition_start:    0,
  arena_transition_end:      0,
  arena_objective_intro:     0,
  arena_building_gate:       0,
  arena_ready_to_leave:      0,
  galaxy_boss_pending:  120_000,
  campaign_advanced:         0,
  run_start:                 0,
  ship_selected_allrounder: 10_000,
  ship_selected_heavy:      10_000,
  ship_selected_fighter:    10_000,
  ship_purchased:       30_000,
  upgrade_purchased:    45_000,
  stellar_nova:         15_000,
  emp_fired:            15_000,
  kill_milestone_25:    40_000,
  kill_milestone_100:   60_000,
  idle_flavor:          60_000,

  boss_scan_ready:           0,
  scan_complete:             0,
  ship_replicated:           0,
  return_journey_start:      0,
  return_journey_complete:   0,
  run_start_return:          0,
};

/**
 * The voice line catalog. Keys are trigger ids; values are arrays of variants.
 * VoiceManager picks a non-repeating random variant each time the key fires.
 *
 * @type {Record<string, VoiceLine[]>}
 */
export const VOICE_LINES = {
  // ---- Hull thresholds ----
  hull_75: [
    { id: 'pip_hull_75_01', file: 'pip_hull_75_01.mp3',
      text: "Hull integrity at seventy-five percent. We call this 'lightly seasoned.'" },
    { id: 'pip_hull_75_02', file: 'pip_hull_75_02.mp3',
      text: "Good news — your ship is now experiencing enhanced ventilation at no extra charge." },
    { id: 'pip_hull_75_03', file: 'pip_hull_75_03.mp3',
      text: "Minor structural feedback detected. Please continue doing whatever you were doing. It was working." },
  ],
  hull_50: [
    { id: 'pip_hull_50_01', file: 'pip_hull_50_01.mp3',
      text: "Hull integrity at fifty percent. Statistically, still a ship." },
    { id: 'pip_hull_50_02', file: 'pip_hull_50_02.mp3',
      text: "Half your ship is still with us. The other half is distributed throughout the sector. Surprise gift." },
    { id: 'pip_hull_50_03', file: 'pip_hull_50_03.mp3',
      text: "ApotheCorp reminds you: a ship is merely a state of mind. Your state of mind is currently forty-nine-point-eight percent." },
  ],
  hull_25: [
    { id: 'pip_hull_25_01', file: 'pip_hull_25_01.mp3',
      text: "Hull critical. Please enjoy our premium Structural Ventilation Package, included at no extra charge." },
    { id: 'pip_hull_25_02', file: 'pip_hull_25_02.mp3',
      text: "Twenty-five percent hull remaining. That's a solid D-plus." },
    { id: 'pip_hull_25_03', file: 'pip_hull_25_03.mp3',
      text: "Warning: pilot is possibly screaming. I cannot confirm. I do not have ears." },
    { id: 'pip_hull_25_04', file: 'pip_hull_25_04.mp3',
      text: "Hull at twenty-five. On the bright side, you are now lighter — and therefore faster. Theoretically." },
  ],
  hull_10: [
    { id: 'pip_hull_10_01', file: 'pip_hull_10_01.mp3',
      text: "Hull integrity at ten percent. This is generally considered 'spicy.'" },
    { id: 'pip_hull_10_02', file: 'pip_hull_10_02.mp3',
      text: "Pilot, you are achieving maximum wing-it. We are so proud of you." },
    { id: 'pip_hull_10_03', file: 'pip_hull_10_03.mp3',
      text: "Ten percent hull. I have pre-filled your Incident Report. You do not need to do anything." },
    { id: 'pip_hull_10_04', file: 'pip_hull_10_04.mp3',
      text: "Please pilot your optimism into that ship, because there is not much ship left. You got this." },
  ],

  // ---- Shield ----
  shield_down: [
    { id: 'pip_shield_down_01', file: 'pip_shield_down_01.mp3',
      text: "Shield Plus™ trial has concluded. We hope you enjoyed your evaluation period." },
    { id: 'pip_shield_down_02', file: 'pip_shield_down_02.mp3',
      text: "Shields offline. Please visualize a shield. Visualization is free." },
    { id: 'pip_shield_down_03', file: 'pip_shield_down_03.mp3',
      text: "Shields down, pilot. Quick reminder: the laws of physics are not a personal attack." },
  ],
  shield_restored: [
    { id: 'pip_shield_restored_01', file: 'pip_shield_restored_01.mp3',
      text: "Shields restored. Thank you for remaining in our care." },
    { id: 'pip_shield_restored_02', file: 'pip_shield_restored_02.mp3',
      text: "Your complimentary deflection bubble is back. Please leave a five-star review." },
    { id: 'pip_shield_restored_03', file: 'pip_shield_restored_03.mp3',
      text: "Shield Plus™ has resumed. Fees may apply retroactively." },
  ],

  // ---- Death & revival ----
  player_died: [
    { id: 'pip_player_died_01', file: 'pip_player_died_01.mp3',
      text: "And we're back! That brief interruption was included in your Voluntary Reconstitution Plan. Fees apply." },
    { id: 'pip_player_died_02', file: 'pip_player_died_02.mp3',
      text: "Recovery complete! You were only mostly disassembled. Most-ly." },
    { id: 'pip_player_died_03', file: 'pip_player_died_03.mp3',
      text: "Welcome to the hangar, pilot. We have, uh — a new ship. A lot like the old ship. Let's not dwell." },
    { id: 'pip_player_died_04', file: 'pip_player_died_04.mp3',
      text: "Reinstantiation successful. Your previous body is in a better place. Specifically, in several places." },
  ],
  phoenix_revived: [
    { id: 'pip_phoenix_revived_01', file: 'pip_phoenix_revived_01.mp3',
      text: "Phoenix protocol engaged. You have been graciously un-deceased. Please act surprised." },
    { id: 'pip_phoenix_revived_02', file: 'pip_phoenix_revived_02.mp3',
      text: "And just like that — you are alive again. Birthday number three thousand and forty-seven." },
    { id: 'pip_phoenix_revived_03', file: 'pip_phoenix_revived_03.mp3',
      text: "Heroic rebirth confirmed. This is definitely the intended outcome of being shot." },
  ],

  // ---- Arena / enemy warp gate ----
  arena_warning: [
    { id: 'pip_arena_warning_01', file: 'pip_arena_warning_01.mp3',
      text: "Pilot, a Community Engagement Opportunity is approaching. Please prepare to smile." },
    { id: 'pip_arena_warning_02', file: 'pip_arena_warning_02.mp3',
      text: "Heads up. Enemy hub ahead. ApotheCorp defines 'enemy' broadly." },
    { id: 'pip_arena_warning_03', file: 'pip_arena_warning_03.mp3',
      text: "Alert: unsanctioned locals detected. Remember — they started it. Probably." },
  ],
  arena_transition_start: [
    { id: 'pip_arena_transition_start_01', file: 'pip_arena_transition_start_01.mp3',
      text: "Buckle in. ApotheCorp Stellar Logistics is slipping you somewhere fun. Fun not guaranteed." },
    { id: 'pip_arena_transition_start_02', file: 'pip_arena_transition_start_02.mp3',
      text: "Initiating warp. Please keep all limbs inside the vehicle, if applicable." },
    { id: 'pip_arena_transition_start_03', file: 'pip_arena_transition_start_03.mp3',
      text: "Warp jump engaged. If you experience any dimensional bleed-through, that is a feature." },
  ],
  arena_transition_end: [
    { id: 'pip_arena_transition_end_01', file: 'pip_arena_transition_end_01.mp3',
      text: "Warp complete. Welcome to the enemy hub. They have redecorated since last time." },
    { id: 'pip_arena_transition_end_02', file: 'pip_arena_transition_end_02.mp3',
      text: "Arrival confirmed. Ambient mood: hostile. Recommended response: aim." },
    { id: 'pip_arena_transition_end_03', file: 'pip_arena_transition_end_03.mp3',
      text: "We have arrived. Approximately." },
  ],
  arena_objective_intro: [
    { id: 'pip_arena_objective_intro_01', file: 'pip_arena_objective_intro_01.mp3',
      text: "Pilot, mission briefing. Three alien warp gates are present, each ringed by crystals. Please destroy every crystal to close a gate — repeat for all three. The local boss will also be present. You may fight it. You may also not. Both options are on-brand for ApotheCorp." },
    { id: 'pip_arena_objective_intro_02', file: 'pip_arena_objective_intro_02.mp3',
      text: "Objective brief! Shatter the crystal rings around all three enemy warp gates to shut them down. A boss will attempt to discourage this. Engagement is optional — politely running away is a recognized ApotheCorp combat doctrine." },
  ],
  arena_building_gate: [
    { id: 'pip_arena_building_gate_01', file: 'pip_arena_building_gate_01.mp3',
      text: "Wonderful. All three enemy gates are closed. Please stand by — your personal warp gate is now printing. Fabrication time: approximately twenty seconds. Feel free to shoot things during the wait." },
    { id: 'pip_arena_building_gate_02', file: 'pip_arena_building_gate_02.mp3',
      text: "All alien gates shut. Excellent work. We are now assembling a private warp gate for you from locally-sourced materials. That is to say, we are reusing the broken ones. Sustainability." },
  ],
  arena_ready_to_leave: [
    { id: 'pip_arena_ready_to_leave_01', file: 'pip_arena_ready_to_leave_01.mp3',
      text: "Your warp gate is complete, pilot. Fly through it when you are ready to depart. Alternatively, linger as long as you like and relieve the boss of any loot it may be carrying. Both options void nothing." },
    { id: 'pip_arena_ready_to_leave_02', file: 'pip_arena_ready_to_leave_02.mp3',
      text: "Exit portal ready. Step one: fly into glowing ring. Step two: survive. Step three: collect whatever falls out of the boss on the way, if you are feeling enterprising." },
    { id: 'pip_arena_ready_to_leave_03', file: 'pip_arena_ready_to_leave_03.mp3',
      text: "Warp gate online. You may leave at your leisure — or stay, and continue to make the boss regret every decision that led to this moment. Entirely up to you." },
  ],
  galaxy_boss_pending: [
    { id: 'pip_galaxy_boss_pending_01', file: 'pip_galaxy_boss_pending_01.mp3',
      text: "Significant biological mass ahead. ApotheCorp classifies this as a 'premium engagement.'" },
    { id: 'pip_galaxy_boss_pending_02', file: 'pip_galaxy_boss_pending_02.mp3',
      text: "Boss threshold reached. You can do this. The contract specifies that you can do this." },
    { id: 'pip_galaxy_boss_pending_03', file: 'pip_galaxy_boss_pending_03.mp3',
      text: "Incoming adversary is large. Suggested strategy: be less large." },
  ],

  // ---- Run start / warp jump ----
  run_start: [
    { id: 'pip_run_start_01', file: 'pip_run_start_01.mp3',
      text: "All systems nominal. ApotheCorp thanks you for flying Sunset Protocol today." },
    { id: 'pip_run_start_02', file: 'pip_run_start_02.mp3',
      text: "Thrusters engaged. Remember: the only bad mission is one that is not a mission." },
    { id: 'pip_run_start_03', file: 'pip_run_start_03.mp3',
      text: "Launch confirmed. Our thoughts and prayers fly with you — to the extent that I can think or pray." },
    { id: 'pip_run_start_04', file: 'pip_run_start_04.mp3',
      text: "You are cleared for departure. Please don't forget to come back." },
  ],
  run_start_galaxy_0: [
    { id: 'pip_run_start_galaxy_0_01', file: 'pip_run_start_galaxy_0_01.mp3',
      text: "Returning to the Milky Way. Home sweet corporate holding, pilot." },
    { id: 'pip_run_start_galaxy_0_02', file: 'pip_run_start_galaxy_0_02.mp3',
      text: "Milky Way orientation flight. A classic. You will love it." },
  ],
  run_start_galaxy_1: [
    { id: 'pip_run_start_galaxy_1_01', file: 'pip_run_start_galaxy_1_01.mp3',
      text: "Andromeda. Your first premium resettlement opportunity. Please smile for the brochure." },
    { id: 'pip_run_start_galaxy_1_02', file: 'pip_run_start_galaxy_1_02.mp3',
      text: "Welcome to Andromeda. If you die here, it counts as 'exotic.'" },
  ],
  run_start_galaxy_2: [
    { id: 'pip_run_start_galaxy_2_01', file: 'pip_run_start_galaxy_2_01.mp3',
      text: "Triangulum. It has three of everything. Including threats." },
  ],
  run_start_galaxy_3: [
    { id: 'pip_run_start_galaxy_3_01', file: 'pip_run_start_galaxy_3_01.mp3',
      text: "Large Magellanic Cloud. Large. Lots of large things. Some of them large enemies." },
  ],
  run_start_galaxy_4: [
    { id: 'pip_run_start_galaxy_4_01', file: 'pip_run_start_galaxy_4_01.mp3',
      text: "Small Magellanic Cloud. Do not be fooled by the name." },
  ],
  run_start_galaxy_5: [
    { id: 'pip_run_start_galaxy_5_01', file: 'pip_run_start_galaxy_5_01.mp3',
      text: "Whirlpool galaxy. Please do not actually whirl. Many pilots have tried." },
  ],
  run_start_galaxy_6: [
    { id: 'pip_run_start_galaxy_6_01', file: 'pip_run_start_galaxy_6_01.mp3',
      text: "Sombrero galaxy. Nobody here finds the joke funny. Do not attempt the joke." },
  ],
  run_start_galaxy_7: [
    { id: 'pip_run_start_galaxy_7_01', file: 'pip_run_start_galaxy_7_01.mp3',
      text: "Pinwheel galaxy. Everything here is spinning slightly faster than expected. Including you." },
  ],
  run_start_galaxy_8: [
    { id: 'pip_run_start_galaxy_8_01', file: 'pip_run_start_galaxy_8_01.mp3',
      text: "Centaurus A. The black hole is — mostly — cosmetic. Mostly." },
  ],
  run_start_galaxy_9: [
    { id: 'pip_run_start_galaxy_9_01', file: 'pip_run_start_galaxy_9_01.mp3',
      text: "Cartwheel galaxy. Pilot — we are so glad you made it this far. Please. Please do not read your contract." },
    { id: 'pip_run_start_galaxy_9_02', file: 'pip_run_start_galaxy_9_02.mp3',
      text: "Welcome to Cartwheel. Where most of us end up. Statistically. Do not look that up." },
  ],

  // ---- Campaign advancement ----
  campaign_advanced: [
    { id: 'pip_campaign_advanced_01', file: 'pip_campaign_advanced_01.mp3',
      text: "Sector cleared. Your resettlement package has been upgraded. You have more legroom now — metaphysically." },
    { id: 'pip_campaign_advanced_02', file: 'pip_campaign_advanced_02.mp3',
      text: "Well done, pilot. The next galaxy is already on our calendar for you. Prepaid." },
    { id: 'pip_campaign_advanced_03', file: 'pip_campaign_advanced_03.mp3',
      text: "Warp gate constructed, stabilized, and slightly on fire. Onward." },
  ],
  campaign_advanced_1: [
    { id: 'pip_campaign_advanced_1_01', file: 'pip_campaign_advanced_1_01.mp3',
      text: "Onward to Andromeda. Your pilot rating has been adjusted from 'new hire' to 'promising asset.'" },
  ],
  campaign_advanced_9: [
    { id: 'pip_campaign_advanced_9_01', file: 'pip_campaign_advanced_9_01.mp3',
      text: "Onward to the Cartwheel. Your pilot rating has been adjusted to 'irreplaceable.' Legally, this is a threat." },
  ],

  // ---- Ship selection & purchase ----
  ship_selected_allrounder: [
    { id: 'pip_ship_selected_allrounder_01', file: 'pip_ship_selected_allrounder_01.mp3',
      text: "Vanguard model selected. The sensible choice. HR approves." },
    { id: 'pip_ship_selected_allrounder_02', file: 'pip_ship_selected_allrounder_02.mp3',
      text: "Now flying: Vanguard. A balanced chassis for a balanced employee." },
  ],
  ship_selected_heavy: [
    { id: 'pip_ship_selected_heavy_01', file: 'pip_ship_selected_heavy_01.mp3',
      text: "Bulwark model selected. Large. Sturdy. Legally classified as 'a problem for someone else.'" },
    { id: 'pip_ship_selected_heavy_02', file: 'pip_ship_selected_heavy_02.mp3',
      text: "Now flying: Bulwark. We scaled up the hull and scaled back the agility. You're welcome." },
  ],
  ship_selected_fighter: [
    { id: 'pip_ship_selected_fighter_01', file: 'pip_ship_selected_fighter_01.mp3',
      text: "Stingray model selected. Fast. Pointy. Not covered by our standard warranty." },
    { id: 'pip_ship_selected_fighter_02', file: 'pip_ship_selected_fighter_02.mp3',
      text: "Now flying: Stingray. Please remember it has wings, not feelings." },
  ],
  ship_purchased: [
    { id: 'pip_ship_purchased_01', file: 'pip_ship_purchased_01.mp3',
      text: "Thank you for your ship purchase. Your wallet's sacrifice has been logged." },
    { id: 'pip_ship_purchased_02', file: 'pip_ship_purchased_02.mp3',
      text: "New ship acquired. Please sign for it before something lands on it." },
  ],

  // ---- Upgrades & abilities ----
  upgrade_purchased: [
    { id: 'pip_upgrade_purchased_01', file: 'pip_upgrade_purchased_01.mp3',
      text: "Upgrade installed. Productivity gains are anticipated but not guaranteed." },
    { id: 'pip_upgrade_purchased_02', file: 'pip_upgrade_purchased_02.mp3',
      text: "Tech unlocked. ApotheCorp R&D thanks you for beta-testing it with your life." },
    { id: 'pip_upgrade_purchased_03', file: 'pip_upgrade_purchased_03.mp3',
      text: "New module online. Please do not ask where the previous one went." },
  ],
  stellar_nova: [
    { id: 'pip_stellar_nova_01', file: 'pip_stellar_nova_01.mp3',
      text: "Stellar Nova deployed. Nearby lifeforms are now retroactively consenting." },
    { id: 'pip_stellar_nova_02', file: 'pip_stellar_nova_02.mp3',
      text: "Nova released. Ambient light levels: 'regrettable.'" },
  ],
  emp_fired: [
    { id: 'pip_emp_fired_01', file: 'pip_emp_fired_01.mp3',
      text: "EMP discharged. Local electronics are now meditating." },
    { id: 'pip_emp_fired_02', file: 'pip_emp_fired_02.mp3',
      text: "Electromagnetic pulse away. If anything stopped working, it was probably important." },
  ],

  // ---- Kill milestones ----
  kill_milestone_25: [
    { id: 'pip_kill_milestone_25_01', file: 'pip_kill_milestone_25_01.mp3',
      text: "Twenty-five hostiles neutralized. You have earned a commemorative plaque we will not send you." },
    { id: 'pip_kill_milestone_25_02', file: 'pip_kill_milestone_25_02.mp3',
      text: "Quarterly kill quota reached. Ahead of schedule, as predicted." },
    { id: 'pip_kill_milestone_25_03', file: 'pip_kill_milestone_25_03.mp3',
      text: "Twenty-five down. HR has flagged this as 'healthy enthusiasm.'" },
  ],
  kill_milestone_100: [
    { id: 'pip_kill_milestone_100_01', file: 'pip_kill_milestone_100_01.mp3',
      text: "One hundred kills. ApotheCorp would like to note, on the record, that this is really impressive." },
    { id: 'pip_kill_milestone_100_02', file: 'pip_kill_milestone_100_02.mp3',
      text: "Century confirmed. You are now a 'valued combat liaison.' The plaque is in the mail. It is not." },
    { id: 'pip_kill_milestone_100_03', file: 'pip_kill_milestone_100_03.mp3',
      text: "One hundred enemies dispatched. Your therapist has been notified. We do not have therapists." },
  ],

  // ---- Campaign scan & return journey ----
  boss_scan_ready: [
    { id: 'pip_boss_scan_ready_01', file: 'pip_boss_scan_ready_01.mp3',
      text: "Good news, pilot: the local opposition has kindly scanned your loadout. This is a complimentary service. There is no opt-out." },
    { id: 'pip_boss_scan_ready_02', file: 'pip_boss_scan_ready_02.mp3',
      text: "Your equipment has been catalogued by the enemy. Think of it as a wellness check — initiated by the entity trying to destroy you." },
    { id: 'pip_boss_scan_ready_03', file: 'pip_boss_scan_ready_03.mp3',
      text: "Alien scan in progress. ApotheCorp values your data. So, it turns out, do they." },
  ],
  scan_complete: [
    { id: 'pip_scan_complete_01', file: 'pip_scan_complete_01.mp3',
      text: "New adaptive threat variant has been added to your itinerary. Complimentary, of course. As always." },
    { id: 'pip_scan_complete_02', file: 'pip_scan_complete_02.mp3',
      text: "Personalized opposition confirmed. We appreciate their attention to your build. Truly. Fly safe." },
    { id: 'pip_scan_complete_03', file: 'pip_scan_complete_03.mp3',
      text: "Your welcome package has been updated. The update is hostile. Please continue forward." },
  ],
  ship_replicated: [
    { id: 'pip_ship_replicated_01', file: 'pip_ship_replicated_01.mp3',
      text: "Pilot — they have made a copy of your ship. We consider this the highest form of flattery. We are not worried. — we are not worried." },
    { id: 'pip_ship_replicated_02', file: 'pip_ship_replicated_02.mp3',
      text: "Full replication confirmed. Everything you are is now also out there. Please chase it home. The contract does specify chase." },
    { id: 'pip_ship_replicated_03', file: 'pip_ship_replicated_03.mp3',
      text: "Pilot, we are so proud of how far you've come. That out there is not you. — probably not you." },
  ],
  return_journey_start: [
    { id: 'pip_return_journey_start_01', file: 'pip_return_journey_start_01.mp3',
      text: "Return sequence initiated. Your duplicates are heading home. Please escort them. By escort, we mean destroy them. Please destroy them." },
    { id: 'pip_return_journey_start_02', file: 'pip_return_journey_start_02.mp3',
      text: "Engaging return flight. Destination: Earth. Threat level: yourself, but wrong. Recommended response: aim." },
  ],
  return_journey_complete: [
    { id: 'pip_return_journey_complete_01', file: 'pip_return_journey_complete_01.mp3',
      text: "Return sequence complete. All duplicates neutralized. Earth is safe. Your contract has been — satisfied. You may rest." },
    { id: 'pip_return_journey_complete_02', file: 'pip_return_journey_complete_02.mp3',
      text: "Mission concluded, pilot. That was the last of them. You are the only you now. Statistically." },
  ],
  run_start_return: [
    { id: 'pip_run_start_return_01', file: 'pip_run_start_return_01.mp3',
      text: "Return sector initiated. The opposition today is a tribute act. A very accurate tribute act." },
    { id: 'pip_run_start_return_02', file: 'pip_run_start_return_02.mp3',
      text: "Re-entering familiar territory. With less familiar occupants." },
    { id: 'pip_run_start_return_03', file: 'pip_run_start_return_03.mp3',
      text: "They were here. Let's make sure they don't get any further." },
  ],
  run_start_return_galaxy_0: [
    { id: 'pip_run_start_return_galaxy_0_01', file: 'pip_run_start_return_galaxy_0_01.mp3',
      text: "Welcome home, pilot. The Milky Way. Last stop. Please collect your belongings and eliminate any remaining copies of yourself." },
  ],

  // ---- Idle flavor (low priority, long cooldown, big pool) ----
  idle_flavor: [
    { id: 'pip_idle_flavor_01', file: 'pip_idle_flavor_01.mp3',
      text: "Reminder: ApotheCorp Celestial Logistics is not liable for any outcome occurring in space, on space, or adjacent to space." },
    { id: 'pip_idle_flavor_02', file: 'pip_idle_flavor_02.mp3',
      text: "Did you know? Pilots retire an average of — nev— a very long time from now." },
    { id: 'pip_idle_flavor_03', file: 'pip_idle_flavor_03.mp3',
      text: "Fun fact: the term 'infinite aliens' is technically a marketing simplification." },
    { id: 'pip_idle_flavor_04', file: 'pip_idle_flavor_04.mp3',
      text: "This vessel is powered by your dreams. And also plasma." },
    { id: 'pip_idle_flavor_05', file: 'pip_idle_flavor_05.mp3',
      text: "If you feel existential dread, try flipping your focus. Focus forward. Focus — forward." },
    { id: 'pip_idle_flavor_06', file: 'pip_idle_flavor_06.mp3',
      text: "ApotheCorp pilots consistently rate their jobs as 'aggressively fine.'" },
    { id: 'pip_idle_flavor_07', file: 'pip_idle_flavor_07.mp3',
      text: "The stars you see are historical. The ones shooting at you are current." },
    { id: 'pip_idle_flavor_08', file: 'pip_idle_flavor_08.mp3',
      text: "You are the four-thousand-and-twelfth pilot to fly this chassis. And the best. Probably." },
    { id: 'pip_idle_flavor_09', file: 'pip_idle_flavor_09.mp3',
      text: "Please remember to hydrate. Hydration is a perk, not a contractual obligation." },
    { id: 'pip_idle_flavor_10', file: 'pip_idle_flavor_10.mp3',
      text: "Rest assured, your replacement — your successor — your continuity protocol is already trained." },
  ],
};
