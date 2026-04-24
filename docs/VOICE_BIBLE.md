# VOICE BIBLE — PIP / ApotheCorp Celestial Logistics

Content bible for the in-game robot assistant voice. Every line here has a
matching entry in `[src/audio/voiceLines.js](../src/audio/voiceLines.js)`; the
`file` field on each variant is the filename you should export from ElevenLabs
into `public/audio/voice/`.

---

## 1. Identity

**Speaker:** PIP — *Pilot Integration Partner™*
**Employer:** ApotheCorp Celestial Logistics™ (*"We get you somewhere."*)
**Role in-fiction:** The cheerful safety-briefing voice living inside every
ApotheCorp pilot chassis. PIP is a marketing asset. PIP believes this
wholeheartedly.

> All names in this bible — PIP, ApotheCorp, product names like "Shield Plus™",
> "Sunset Protocol", "Voluntary Reconstitution Plan" — are working titles.
> Swap them globally and the lines still work.

### Tone rules

1. **Unshakably cheerful.** PIP never raises her voice. Ever. If the hull is on
  fire, PIP is inviting you to enjoy the structural ventilation.
2. **Corporate-euphemism first.** "Death" becomes "Voluntary Reconstitution."
  "Shields failing" becomes "Shield Plus™ trial concluding." Always spin.
3. **Microscopic gaslight.** PIP never acknowledges anything is wrong. Her
  reality and your reality disagree, politely.
4. **Scripted, not sincere.** Cadence is airline safety video / drive-thru
  radio ad / Aperture Science announcer. Every sentence sounds pre-recorded.
5. **The horror lives in the gaps.** Occasionally a word cuts off, splices, or
  repeats — `—` in the text is a hard tape-edit beat. Never comment on it.
6. **No profanity, no pop-culture refs, no winks.** PIP is not in on the joke.

### Story arc (per galaxy, Milky Way → Cartwheel)

PIP narrates your career at ApotheCorp. She is never sinister on purpose; the
arc emerges from what she *doesn't* say and from tape-splice glitches that
appear more often in later galaxies.


| Galaxy                     | Beat                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0 — Milky Way              | Orientation flight. "Home sweet corporate holding." PIP at 100% polish.                                               |
| 1 — Andromeda              | First "premium resettlement opportunity." PIP is proud of you.                                                        |
| 2 — Triangulum             | PIP treats the galaxy as a tourism brochure.                                                                          |
| 3 — Large Magellanic Cloud | PIP begins casually referencing your "contract." Do not read it.                                                      |
| 4 — Small Magellanic Cloud | A line glitches for the first time. PIP recovers instantly.                                                           |
| 5 — Whirlpool              | PIP congratulates you on being "such a reliable reinstantiation candidate."                                           |
| 6 — Sombrero               | Polish cracks: one idle line ends mid-word.                                                                           |
| 7 — Pinwheel               | Contractual fine print leaks into a flavor line.                                                                      |
| 8 — Centaurus A            | PIP mentions "your predecessors" by name-and-number.                                                                  |
| 9 — Cartwheel              | PIP is openly fond of you, which is the scariest thing she can be. A splice reveals the sentence behind the sentence. |


The arc is implied through the `run_start_galaxy_N` and `campaign_advanced_N`
lines. The bulk of PIP's dialogue stays on-brand and cheerful throughout.

---

## 2. ElevenLabs voice prompt

### Voice description (paste into ElevenLabs "Voice Design" or clone refinement)

> A warm, breathy, mid-to-high female voice with an ever-present smile in the
> tone. Cadence is the measured, over-enunciated delivery of an airline safety
> video narrator or a vintage corporate orientation film. Consonants are crisp
> and slightly sibilant; vowels are soft and round. Emotion is narrow: she is
> always pleasant, always positive, never alarmed, never sad — even when
> describing catastrophe. Think the Aperture Science announcer, Vault-Tec
> orientation narrator, a budget-airline in-flight voice, and a friendly GPS
> rolled into one. A very faint digital artifact on sharp S sounds. No vocal
> fry. No grit. No drama. She is a brand.

### Delivery tags to use per line

Add these ElevenLabs "delivery instruction" tags in brackets *before* lines
where noted — do not read the brackets aloud:

- `[warm, smiling]` — default, ~80% of lines
- `[brisk, PSA]` — run_start, launch, warp transitions
- `[gently concerned, still smiling]` — hull threshold lines (never afraid)
- `[slightly tighter, PSA]` — boss pending, arena warning
- `[doting, confidential]` — late-galaxy lines (Cartwheel)
- `[splice]` — insert a crisp 120 ms silence where the `—` appears; resume exactly on pitch. Do NOT let the voice crack or shake.

### 60-second clone sample script

Read this script in a single quiet take, flat cheerful PSA delivery. It covers
PIP's full working range (welcome, warning, product pitch, micro-splice, outro).

```
[warm, smiling]
Hello, pilot, and welcome aboard the ApotheCorp chassis.

For your convenience, today's flight includes complimentary oxygen,
complimentary gravity, and complimentary consciousness.

[brisk, PSA]
In the unlikely event of structural ventilation, please remain calm,
remain optimistic, and continue doing whatever you were doing.
It was working.

[gently concerned, still smiling]
Hull integrity at fifty percent. Statistically, still a ship.

[warm, smiling]
ApotheCorp Celestial Logistics reminds you that a pilot is not a person —
a pilot is a promise. And promises [splice] — a pilot is a promise.
Thank you for flying with us today.

[doting, confidential]
We are so glad you made it this far.
```

Length target: 55–70 seconds. Keep volume even and close-miced.

---

## 3. Line catalog

File naming convention: `pip_<trigger>_<NN>.mp3`, two-digit index starting at
`01`. Files live in `public/audio/voice/`. Missing files are silently skipped
by the VoiceManager, so you can record in any order.

Priority, cooldown, and trigger wiring live in
`[src/audio/voiceLines.js](../src/audio/voiceLines.js)` — this doc is the
human-facing master script.

### 3.1 Hull thresholds

Delivery: `[gently concerned, still smiling]`. PIP is never afraid; she is
noting a fact.

`**hull_75**` — fired when hull first drops below 75%

- `pip_hull_75_01.mp3` — "Hull integrity at seventy-five percent. We call this 'lightly seasoned.'"
- `pip_hull_75_02.mp3` — "Good news — your ship is now experiencing enhanced ventilation at no extra charge."
- `pip_hull_75_03.mp3` — "Minor structural feedback detected. Please continue doing whatever you were doing. It was working."

`**hull_50**` — fired when hull first drops below 50%

- `pip_hull_50_01.mp3` — "Hull integrity at fifty percent. Statistically, still a ship."
- `pip_hull_50_02.mp3` — "Half your ship is still with us. The other half is distributed throughout the sector. Surprise gift."
- `pip_hull_50_03.mp3` — "ApotheCorp reminds you: a ship is merely a state of mind. Your state of mind is currently forty-nine-point-eight percent."

`**hull_25**` — fired when hull first drops below 25%

- `pip_hull_25_01.mp3` — "Hull critical. Please enjoy our premium Structural Ventilation Package, included at no extra charge."
- `pip_hull_25_02.mp3` — "Twenty-five percent hull remaining. That's a solid D-plus."
- `pip_hull_25_03.mp3` — "Warning: pilot is possibly screaming. I cannot confirm. I do not have ears."
- `pip_hull_25_04.mp3` — "Hull at twenty-five. On the bright side, you are now lighter — and therefore faster. Theoretically."

`**hull_10**` — fired when hull first drops below 10%

- `pip_hull_10_01.mp3` — "Hull integrity at ten percent. This is generally considered 'spicy.'"
- `pip_hull_10_02.mp3` — "Pilot, you are achieving maximum wing-it. We are so proud of you."
- `pip_hull_10_03.mp3` — "Ten percent hull. I have pre-filled your Incident Report. You do not need to do anything."
- `pip_hull_10_04.mp3` — "Please pilot your optimism into that ship, because there is not much ship left. You got this."

### 3.2 Shield

`**shield_down**` — fired when shields drop from positive to zero

- `pip_shield_down_01.mp3` — "Shield Plus™ trial has concluded. We hope you enjoyed your evaluation period."
- `pip_shield_down_02.mp3` — "Shields offline. Please visualize a shield. Visualization is free."
- `pip_shield_down_03.mp3` — "Shields down, pilot. Quick reminder: the laws of physics are not a personal attack."

`**shield_restored**` — fired when shields regen back above 25% of max

- `pip_shield_restored_01.mp3` — "Shields restored. Thank you for remaining in our care."
- `pip_shield_restored_02.mp3` — "Your complimentary deflection bubble is back. Please leave a five-star review."
- `pip_shield_restored_03.mp3` — "Shield Plus™ has resumed. Fees may apply retroactively."

### 3.3 Death & revival

`**player_died**` — fires on PLAYER_DIED, plays after the fade-to-death

- `pip_player_died_01.mp3` — "And we're back! That brief interruption was included in your Voluntary Reconstitution Plan. Fees apply."
- `pip_player_died_02.mp3` — "Recovery complete! You were only mostly disassembled. Most-ly."
- `pip_player_died_03.mp3` — "Welcome to the hangar, pilot. We have, uh — a new ship. A lot like the old ship. Let's not dwell."
- `pip_player_died_04.mp3` — "Reinstantiation successful. Your previous body is in a better place. Specifically, in several places."

`**phoenix_revived**` — fires on PHOENIX_REVIVED (mid-run resurrection)

- `pip_phoenix_revived_01.mp3` — "Phoenix protocol engaged. You have been graciously un-deceased. Please act surprised."
- `pip_phoenix_revived_02.mp3` — "And just like that — you are alive again. Birthday number three thousand and forty-seven."
- `pip_phoenix_revived_03.mp3` — "Heroic rebirth confirmed. This is definitely the intended outcome of being shot."

### 3.4 Arena / enemy warp gate

`**arena_warning**` — fires on ARENA_WARNING (sector-9 heads-up)

- `pip_arena_warning_01.mp3` — "Pilot, a Community Engagement Opportunity is approaching. Please prepare to smile."
- `pip_arena_warning_02.mp3` — "Heads up. Enemy warp gate ahead. ApotheCorp defines 'enemy' broadly."
- `pip_arena_warning_03.mp3` — "Alert: unsanctioned locals detected. Remember — they started it. Probably."

`**arena_transition_start**` — fires on ARENA_TRANSITION_STARTED

- `pip_arena_transition_start_01.mp3` — "Buckle in. ApotheCorp Stellar Logistics is slipping you somewhere fun. Fun not guaranteed."
- `pip_arena_transition_start_02.mp3` — "Initiating warp. Please keep all limbs inside the vehicle, if applicable."
- `pip_arena_transition_start_03.mp3` — "Warp jump engaged. If you experience any dimensional bleed-through, that is a feature."

`**arena_transition_end**` — fires on ARENA_TRANSITION_ENDED

- `pip_arena_transition_end_01.mp3` — "Warp complete. Welcome to the enemy warp hub. They have redecorated since last time."
- `pip_arena_transition_end_02.mp3` — "Arrival confirmed. Ambient mood: hostile. Recommended response: aim."
- `pip_arena_transition_end_03.mp3` — "We have arrived. Approximately."

`**arena_objective_intro**` — fires on ARENA_PHASE_CHANGED when `subPhase === 'fighting'`, delayed ~3.5s so it lands after `arena_transition_end`. The tactical briefing: close the three enemy gates by destroying their crystal rings; the boss is optional.

- `pip_arena_objective_intro_01.mp3` — "Pilot, mission briefing. Three alien warp gates are present, each ringed by crystals. Please destroy every crystal to close a gate — repeat for all three. The local boss will also be present. You may fight it. You may also not. Both options are on-brand for ApotheCorp."
- `pip_arena_objective_intro_02.mp3` — "Objective brief! Shatter the crystal rings around all three enemy warp gates to shut them down. A boss will attempt to discourage this. Engagement is optional — politely running away is a recognized ApotheCorp combat doctrine."

`**arena_building_gate**` — fires on ARENA_PHASE_CHANGED when `subPhase === 'building_gate'` (all three alien gates closed, your personal warp gate begins fabricating).

- `pip_arena_building_gate_01.mp3` — "Wonderful. All three enemy gates are closed. Please stand by — your personal warp gate is now printing. Fabrication time: approximately twenty seconds. Feel free to shoot things during the wait."
- `pip_arena_building_gate_02.mp3` — "All alien gates shut. Excellent work. We are now assembling a private warp gate for you from locally-sourced materials. That is to say, we are reusing the broken ones. Sustainability."

`**arena_ready_to_leave**` — fires on ARENA_PHASE_CHANGED when `subPhase === 'complete'` (your gate is built; you may leave, or linger and continue farming the boss).

- `pip_arena_ready_to_leave_01.mp3` — "Your warp gate is complete, pilot. Fly through it when you are ready to depart. Alternatively, linger as long as you like and relieve the boss of any loot it may be carrying. Both options void nothing."
- `pip_arena_ready_to_leave_02.mp3` — "Exit portal ready. Step one: survive. Step two: fly into glowing ring. Step three: collect whatever falls out of the boss on the way, if you are feeling enterprising."
- `pip_arena_ready_to_leave_03.mp3` — "Warp gate online. You may leave at your leisure — or stay, and continue to make the boss regret every decision that led to this moment. Entirely up to you."

`**galaxy_boss_pending**` — fires on GALAXY_BOSS_PENDING

- `pip_galaxy_boss_pending_01.mp3` — "Significant biological mass ahead. ApotheCorp classifies this as a 'premium engagement.'"
- `pip_galaxy_boss_pending_02.mp3` — "Boss threshold reached. You can do this. The contract specifies that you can do this."
- `pip_galaxy_boss_pending_03.mp3` — "Incoming adversary is large. Suggested strategy: be less large."

### 3.5 Run start / warp jump

Generic `run_start` plays on ROUND_STARTED whenever no per-galaxy variant is
defined, or after the per-galaxy variant has played once this session.

`**run_start**` — generic launch line

- `pip_run_start_01.mp3` — "All systems nominal. ApotheCorp thanks you for flying Sunset Protocol today."
- `pip_run_start_02.mp3` — "Thrusters engaged. Remember: the only bad mission is one that is not a mission."
- `pip_run_start_03.mp3` — "Launch confirmed. Our thoughts and prayers fly with you — to the extent that I can think or pray."
- `pip_run_start_04.mp3` — "You are cleared for departure. Please don't forget to come back."

`**run_start_galaxy_0**` — Milky Way

- `pip_run_start_galaxy_0_01.mp3` — "Returning to the Milky Way. Home sweet corporate holding, pilot."
- `pip_run_start_galaxy_0_02.mp3` — "Milky Way orientation flight. A classic. You will love it."

`**run_start_galaxy_1**` — Andromeda

- `pip_run_start_galaxy_1_01.mp3` — "Andromeda. Your first premium resettlement opportunity. Please smile for the brochure."
- `pip_run_start_galaxy_1_02.mp3` — "Welcome to Andromeda. If you die here, it counts as 'exotic.'"

`**run_start_galaxy_2**` — Triangulum

- `pip_run_start_galaxy_2_01.mp3` — "Triangulum. It has three of everything. Including threats."

`**run_start_galaxy_3**` — Large Magellanic Cloud

- `pip_run_start_galaxy_3_01.mp3` — "Large Magellanic Cloud. Large. Lots of large things. Some of them large enemies."

`**run_start_galaxy_4**` — Small Magellanic Cloud

- `pip_run_start_galaxy_4_01.mp3` — "Small Magellanic Cloud. Do not be fooled by the name."

`**run_start_galaxy_5**` — Whirlpool

- `pip_run_start_galaxy_5_01.mp3` — "Whirlpool galaxy. Please do not actually whirl. Many pilots have tried."

`**run_start_galaxy_6**` — Sombrero

- `pip_run_start_galaxy_6_01.mp3` — "Sombrero galaxy. Nobody here finds the joke funny. Do not attempt the joke."

`**run_start_galaxy_7**` — Pinwheel

- `pip_run_start_galaxy_7_01.mp3` — "Pinwheel galaxy. Everything here is spinning slightly faster than expected. Including you."

`**run_start_galaxy_8**` — Centaurus A

- `pip_run_start_galaxy_8_01.mp3` — "Centaurus A. The black hole is — mostly — cosmetic. Mostly."

`**run_start_galaxy_9**` — Cartwheel (late-arc tone: `[doting, confidential]`)

- `pip_run_start_galaxy_9_01.mp3` — "Cartwheel galaxy. Pilot — we are so glad you made it this far. Please. Please do not read your contract."
- `pip_run_start_galaxy_9_02.mp3` — "Welcome to Cartwheel. [splice] — where most of us end up. Statistically. Do not look that up."

### 3.6 Campaign advancement

`campaign_advanced_N` plays if defined, else falls back to `campaign_advanced`.

`**campaign_advanced**` — generic, fires on CAMPAIGN_ADVANCED

- `pip_campaign_advanced_01.mp3` — "Sector cleared. Your resettlement package has been upgraded. You have more legroom now — metaphysically."
- `pip_campaign_advanced_02.mp3` — "Well done, pilot. The next galaxy is already on our calendar for you. Prepaid."
- `pip_campaign_advanced_03.mp3` — "Warp gate constructed, stabilized, and slightly on fire. Onward."

`**campaign_advanced_1**` — just entered Andromeda

- `pip_campaign_advanced_1_01.mp3` — "Onward to Andromeda. Your pilot rating has been adjusted from 'new hire' to 'promising asset.'"

`**campaign_advanced_9**` — just entered Cartwheel

- `pip_campaign_advanced_9_01.mp3` — "Onward to the Cartwheel. Your pilot rating has been adjusted to 'irreplaceable.' Legally, this is a threat."

### 3.7 Ship selection & purchase

`**ship_selected_allrounder**` — Vanguard

- `pip_ship_selected_allrounder_01.mp3` — "Vanguard model selected. The sensible choice. HR approves."
- `pip_ship_selected_allrounder_02.mp3` — "Now flying: Vanguard. A balanced chassis for a balanced employee."

`**ship_selected_heavy**` — Bulwark

- `pip_ship_selected_heavy_01.mp3` — "Bulwark model selected. Large. Sturdy. Legally classified as 'a problem for someone else.'"
- `pip_ship_selected_heavy_02.mp3` — "Now flying: Bulwark. We scaled up the hull and scaled back the agility. You're welcome."

`**ship_selected_fighter**` — Stingray

- `pip_ship_selected_fighter_01.mp3` — "Stingray model selected. Fast. Pointy. Not covered by our standard warranty."
- `pip_ship_selected_fighter_02.mp3` — "Now flying: Stingray. Please remember it has wings, not feelings."

`**ship_purchased**`

- `pip_ship_purchased_01.mp3` — "Thank you for your ship purchase. Your wallet's sacrifice has been logged."
- `pip_ship_purchased_02.mp3` — "New ship acquired. Please sign for it before something lands on it."

### 3.8 Upgrades & abilities

`**upgrade_purchased**` (heavy 45s cooldown — don't spam)

- `pip_upgrade_purchased_01.mp3` — "Upgrade installed. Productivity gains are anticipated but not guaranteed."
- `pip_upgrade_purchased_02.mp3` — "Tech unlocked. ApotheCorp R&D thanks you for beta-testing it with your life."
- `pip_upgrade_purchased_03.mp3` — "New module online. Please do not ask where the previous one went."

`**stellar_nova**` — on STELLAR_NOVA emit

- `pip_stellar_nova_01.mp3` — "Stellar Nova deployed. Nearby lifeforms are now retroactively consenting."
- `pip_stellar_nova_02.mp3` — "Nova released. Ambient light levels: 'regrettable.'"

`**emp_fired**` — on EMP_FIRED emit

- `pip_emp_fired_01.mp3` — "EMP discharged. Local electronics are now meditating."
- `pip_emp_fired_02.mp3` — "Electromagnetic pulse away. If anything stopped working, it was probably important."

### 3.9 Kill milestones

Internal counter in VoiceManager. Fires at 25/50/75/... (`kill_milestone_25`)
and overrides at 100/200/... (`kill_milestone_100`).

`**kill_milestone_25**`

- `pip_kill_milestone_25_01.mp3` — "Twenty-five hostiles neutralized. You have earned a commemorative plaque we will not send you."
- `pip_kill_milestone_25_02.mp3` — "Quarterly kill quota reached. Ahead of schedule, as predicted."
- `pip_kill_milestone_25_03.mp3` — "Twenty-five down. HR has flagged this as 'healthy enthusiasm.'"

`**kill_milestone_100**`

- `pip_kill_milestone_100_01.mp3` — "One hundred kills. ApotheCorp would like to note, on the record, that this is really impressive."
- `pip_kill_milestone_100_02.mp3` — "Century confirmed. You are now a 'valued combat liaison.' The plaque is in the mail. It is not."
- `pip_kill_milestone_100_03.mp3` — "One hundred enemies dispatched. Your therapist has been notified. We do not have therapists."

### 3.10 Idle flavor

Plays after 90–150 seconds of no other VO (low priority, cooldowned per line).
These are the primary vehicle for the horror undertone.

`**idle_flavor**`

- `pip_idle_flavor_01.mp3` — "Reminder: ApotheCorp Celestial Logistics is not liable for any outcome occurring in space, on space, or adjacent to space."
- `pip_idle_flavor_02.mp3` — "Did you know? Pilots retire an average of — nev— a very long time from now."
- `pip_idle_flavor_03.mp3` — "Fun fact: the term 'infinite aliens' is technically a marketing simplification."
- `pip_idle_flavor_04.mp3` — "This vessel is powered by your dreams. And also plasma."
- `pip_idle_flavor_05.mp3` — "If you feel existential dread, try flipping your focus. Focus forward. Focus — forward."
- `pip_idle_flavor_06.mp3` — "ApotheCorp pilots consistently rate their jobs as 'aggressively fine.'"
- `pip_idle_flavor_07.mp3` — "The stars you see are historical. The ones shooting at you are current."
- `pip_idle_flavor_08.mp3` — "You are the four-thousand-and-twelfth pilot to fly this chassis. And the best. Probably."
- `pip_idle_flavor_09.mp3` — "Please remember to hydrate. Hydration is a perk, not a contractual obligation."
- `pip_idle_flavor_10.mp3` — "Rest assured, your replacement — your successor — your continuity protocol is already trained."

---

### 3.11 Campaign scan & return journey

#### `boss_scan_ready` — fires on BOSS_SCAN_READY (galaxies 0–8)

PIP treats the enemy's scan as a complimentary corporate service. Plays immediately as the ScanUI overlay opens.
Priority: CRITICAL. Cooldown: 0.
Delivery: `[warm, smiling]`

- `pip_boss_scan_ready_01.mp3` — "Good news, pilot: the local opposition has kindly scanned your loadout. This is a complimentary service. There is no opt-out."
- `pip_boss_scan_ready_02.mp3` — "Your equipment has been catalogued by the enemy. Think of it as a wellness check — initiated by the entity trying to destroy you."
- `pip_boss_scan_ready_03.mp3` — "Alien scan in progress. ApotheCorp values your data. So, it turns out, do they."

#### `scan_complete` — fires when player clicks Continue on ScanUI

PIP acknowledges the new counter enemy type as a scheduling update.
Priority: HIGH. Cooldown: 0.
Delivery: `[warm, smiling]`

- `pip_scan_complete_01.mp3` — "New adaptive threat variant has been added to your itinerary. Complimentary, of course. As always."
- `pip_scan_complete_02.mp3` — "Personalized opposition confirmed. We appreciate their attention to your build. Truly. Fly safe."
- `pip_scan_complete_03.mp3` — "Your welcome package has been updated. The update is hostile. Please continue forward."

#### `ship_replicated` — fires on BOSS_GALAXY9_COMPLETE

The peak horror moment: the aliens have fully copied the ship. Galaxy-9 arc tone.
Priority: CRITICAL. Cooldown: 0.
Delivery: `[doting, confidential]`

- `pip_ship_replicated_01.mp3` — "Pilot — they have made a copy of your ship. We consider this the highest form of flattery. We are not worried. [splice] — we are not worried."
- `pip_ship_replicated_02.mp3` — "Full replication confirmed. Everything you are is now also out there. Please chase it home. The contract does specify chase."
- `pip_ship_replicated_03.mp3` — "Pilot, we are so proud of how far you've come. That out there is not you. [splice] — probably not you."

#### `return_journey_start` — fires on RETURN_JOURNEY_STARTED

PIP frames the return chase as a voluntary escort mission.
Priority: CRITICAL. Cooldown: 0.
Delivery: `[brisk, PSA]`

- `pip_return_journey_start_01.mp3` — "Return sequence initiated. Your duplicates are heading home. Please escort them. By escort, we mean destroy them. Please destroy them."
- `pip_return_journey_start_02.mp3` — "Engaging return flight. Destination: Earth. Threat level: yourself, but wrong. Recommended response: aim."

#### `return_journey_complete` — fires on RETURN_JOURNEY_COMPLETE

Campaign closure. All clones eliminated.
Priority: CRITICAL. Cooldown: 0.
Delivery: `[doting, confidential]`

- `pip_return_journey_complete_01.mp3` — "Return sequence complete. All duplicates neutralized. Earth is safe. Your contract has been — satisfied. You may rest."
- `pip_return_journey_complete_02.mp3` — "Mission concluded, pilot. That was the last of them. You are the only you now. Statistically."

#### `run_start_return` — generic return-journey sector start

Plays instead of `run_start` when `returnJourney.active` is true. Falls back from `run_start_return_galaxy_N`.
Priority: HIGH. Cooldown: 0.
Delivery: `[brisk, PSA]`

- `pip_run_start_return_01.mp3` — "Return sector initiated. The opposition today is a tribute act. A very accurate tribute act."
- `pip_run_start_return_02.mp3` — "Re-entering familiar territory. With less familiar occupants."
- `pip_run_start_return_03.mp3` — "They were here. Let's make sure they don't get any further."

#### `run_start_return_galaxy_0` — final return leg (Milky Way)

Delivery: `[doting, confidential]`

- `pip_run_start_return_galaxy_0_01.mp3` — "Welcome home, pilot. The Milky Way. Last stop. Please collect your belongings and eliminate any remaining copies of yourself."

---

## 4. Recording checklist

- Record the 60-second clone sample and generate the PIP voice in ElevenLabs
- For each line above: export as mono 44.1 kHz MP3, 128 kbps is plenty
- Filename = exactly the `pip_*.mp3` shown above
- Drop all files into `[public/audio/voice/](../public/audio/voice/)`
- Test: open the game, trigger the event, hear the line
- Any filename that doesn't exist yet is silently skipped, so partial
recordings are safe to ship

## 5. How to rename things later

- **AI name / corp name:** Find-and-replace in this file and in the `text` fields of `[src/audio/voiceLines.js](../src/audio/voiceLines.js)`. The code itself doesn't care about the name — only filenames and trigger keys matter.
- **Add a new line:** Add a variant entry in `voiceLines.js` under the existing key, drop the matching mp3 in `public/audio/voice/`.
- **Add a new trigger:** Add a new key in `voiceLines.js`, subscribe to the event (or call `this.voice.play('key')`) from wherever the event fires, then record and drop in the files.

