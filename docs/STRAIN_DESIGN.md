# Reprint: Strain — Alternative Version Design

Status: **design draft v1.** A second game built beside *Reprint*, not a patch on it.
Working title: **Strain**. Same lore, new systems.

What changes, in one line each:

- **Traits grow, cards don't.** Six body traits drive every card number. Upgrading a trait upgrades the whole deck.
- **Two decks only.** Tactical deck + Exploration deck, from the pre-body-slot card sets. No limb sub-decks.
- **Battles look like Game Boy Pokémon.** Enemy top-right, clone bottom-left, text box, but moves are cards.
- **Exploration is an open world.** A procedurally generated planet map. Walk anywhere.
- **Travel between planets.** A run is a chain of landings. Planets unlock as you progress.
- **Visual style: calmer print.** Same ink-and-paper sci-fi, less halftone, fewer effects.

Unanswered choices are marked **[Q]** and collected in section 14.

---

## 1. Pillars

1. **The clone is the build.** Your trait sheet is your character. The deck is how you express it.
2. **Every point matters everywhere.** Each trait works in battle *and* while exploring.
3. **Death feeds the next print.** Every run pays out meta-currency, even a bad one.
4. **Readable at a glance.** One-thumb portrait play. Big numbers. No hidden math.
5. **Weird, grim, curious.** The tone stays. The visuals get cleaner.

---

## 2. Lore delta

Unchanged spine: humanity's last project brute-forces a survivable genome. You are one print.

New framing for the new systems:

- The lab ship is now a **hub**, the *Printer*. You wake there between runs.
- Traits are the **genome sequence**. The Printer rewrites it between prints (meta-progression).
- On a planet, **splice pods** push the current body past its sequence (run-only boosts).
- Cards are **techniques**: fixed patterns the body performs. A stronger body performs them harder.
- Planets are the three **seed-probe worlds** (Kessra, Mireth, Orun) plus the derelict and Origin.

---

## 3. Traits

Six traits in three domains. Every trait has one battle job and one exploration job.

| Domain | Trait | Glyph | Battle | Exploration |
|---|---|---|---|---|
| **Physical** | **Might** (MGT) | ✊ | Damage of strikes, cleaves | Cutter clears debris of density ≤ MGT÷2. Forcing a gate costs less. |
| | **Hide** (HDE) | ⬢ | Plating, max integrity | Hazard tiles hurt less (cold, acid, radiation). |
| **Neural** | **Reflex** (RFX) | ⚡ | Initiative, multi-hit, hand size | Sneak up on mobs (first strike). Flee chance. Walk speed. |
| | **Focus** (FOC) | ◎ | Debuffs (Weak, Expose), draw, energy | Override opens locks of rating ≤ FOC÷2. Scan radius. |
| **Visceral** | **Metabolism** (MET) | ✚ | Healing, biomass yield, lifesteal | Oxygen capacity. Rest heals more. |
| | **Aberrance** (ABR) | ⟁ | Drain, Rot, unstable and "wrong" cards | See gateways, read alien events, aberrant choices. |

### 3.1 Levels

| Layer | Name | How | Kept on death? |
|---|---|---|---|
| Base | **Sequence** | Bought at the Printer with **Codons** | Yes |
| Run | **Somatic** | Splice pods on planets, paid with **biomass** | No |
| Fight | **Surge** | Card effects ("+2 Might this fight") | No |

- **Effective trait = Sequence + Somatic + Surge.**
- New clone: all traits at **3**. Sequence cap: **12**. Somatic cap: **+4** per trait per run.
- Chassis (section 10) change starting spreads.

### 3.2 Derived stats

| Stat | Formula | At all-3 | At all-10 |
|---|---|---|---|
| Max integrity | 26 + 4·HDE + 2·MGT | 44 | 86 |
| Energy / turn | 3, +1 at FOC 8, +1 at FOC 14 | 3 | 4 |
| Hand size | 5, +1 at RFX 9 | 5 | 6 |
| Initiative | RFX (enemies have their own) | 3 | 10 |
| Oxygen | 5 + MET | 8 | 15 |
| Exploration hand | 4, +1 at FOC 10 | 4 | 5 |
| Biomass per rendered corpse | base × (1 + MET/10) | ×1.3 | ×2 |
| Heal from eating a corpse | base + MET | +3 | +10 |

### 3.3 Card formulas

Every card number is **base + trait × weight**, rounded down.
Card text shows the **final number**, tinted by its trait. Tap-hold shows the math.

```
SCALPEL            cost 1      ┃  Deal 6 ✊
─────────────────────────────  ┃  hold → "3 + Might 3"
```

Rules:
- Weights are **½, 1, or 2**. Nothing else. Keeps mental math possible.
- A card uses **one or two** traits. Never three.
- **Thresholds** add a line when a trait reaches a value:
  `RFX 8: +1 hit`. Unmet lines show dimmed, so the player sees what's coming.
- Cost never scales with traits. Only thresholds may lower it.

Thresholds are the key. Linear scaling makes cards bigger. Thresholds make cards **different**.
That replaces the "card name and text change" feeling of genes and imprints.

### 3.4 Build identity

Investing in one trait makes its cards scale faster than the rest.
Card rewards lean toward your **two highest traits** (50% of offers), so decks follow the sheet.

| Build | Traits | Plays like |
|---|---|---|
| Butcher | MGT + MET | Big hits, eat everything, heal off kills |
| Carapace | HDE + MGT | Plate high, hit back, reflect |
| Needle | RFX + FOC | Many cheap hits, draw, Expose then burst |
| Surgeon | FOC + MET | Weak/Expose control, tags, triage heals |
| Mutant | ABR + MET | Drain, Rot, unstable gambles |
| Glass | RFX + ABR | Self-harm for huge output |

---

## 4. Decks

Source: the card sets from **before body slots** (commit `8c6e423`). Genes, mutations and Imprints are removed.
Cards with Imprint mechanics are rebuilt around **fight-scoped** growth or traits.

### 4.1 Tactical deck (battle)

**Starter (8):** Scalpel ×4, Brace ×2, Harpoon, Flense. Values below at all traits = 3.

| Card | Cost | Formula | At 3 | Threshold |
|---|---|---|---|---|
| Scalpel | 1 | Deal 3 + MGT | 6 | MGT 9: Expose 1 |
| Brace | 1 | Plate 2 + HDE | 5 | HDE 8: plating stays 1 extra turn |
| Harpoon | 1 | Deal 1 + MGT. Tag 1 | 4 | RFX 7: Tag 2 |
| Flense | 2 | Deal 2 + 2·MGT. Expose 1 + FOC÷2 | 8 · 2 | — |
| Scatter Rounds | 1 | Deal 1 + RFX to ALL | 4 | RFX 10: hits twice |
| Neural Spike | 1 | Deal FOC. Weak 1 + FOC÷2 | 3 · 2 | FOC 9: cost 0 |
| Bonesaw | 2 | Deal 2 + MGT, 2 hits | 5×2 | RFX 8: 3 hits |
| Adrenal Leak | 0 | +1 energy. Draw 1 | — | MET 8: draw 2 |
| Cold Echo | 1 | Draw 2. Plate HDE | 3 | FOC 10: draw 3 |
| Salvage Hook | 1 | Deal 2 + MGT. Tag 1. Plate 2 | 5 · 2 | — |
| Graft | 1 | Deal 1 + MGT. Heal MET − 1 | 4 · 2 | — |
| Overclock Jack | 1 | Deal 1 + RFX. Next card +(FOC − 1) | 4 · 2 | — |
| Siphon Blade | 2 | Deal 3 + 2·MGT. Heal half the damage | 9 | ABR 7: heal all of it |
| Triage Tag | 1 | Deal FOC. Tag 1. Triage 1 | 3 | — |
| Harvest Needle | 1 | Deal FOC. Tag 1. Tagged: heal 1 per tagged enemy | 3 | MET 8: heal 2 each |
| Unscarred Edge | 1 | Hold. Deal 1 + RFX. +2 per clean round held (this fight) | 4 | — |
| Scar Tissue | 1 | Hold. Plate HDE. Losing integrity while held: +1 Might (this fight) | 3 | — |
| Feeding Blade | 1 | Deal 2 + MGT. Each kill this fight: +ABR | 5 | — |
| Callus | 1 | Plate 1 + HDE. Each fully stopped hit: +1 (this fight) | 4 | — |
| Donor Cell | 0 | Consume. A card in hand uses your **highest trait** this fight | — | — |
| Sibling Print | 1 | Deal 1 + MGT. +2 per other Sibling played this fight | 4 | — |
| Cannibal Print | 1 | Consume a card in hand. Gain its cost as energy. Deal MGT | 3 | — |
| Mutagen Flask | 1 | Consume. Unstable: +2 to a random trait this fight (1 in 3: −1) | — | ABR 8: you pick the trait |
| Hunger Clock | 2 | Deal 5 + 2·MGT | 11 | Won fight without playing it: next fight costs 1 more |
| Grief Engine | 1 | Plate HDE. Draw 1. +1 per card Consumed this run | 3 | — |
| Clot Patch ✚ | 0 | Consume. Heal MET − 1 | 2 | — |
| Biomass Poultice ✚ | 0 | Consume. Heal 1 + MET. Costs 2 biomass | 4 | — |
| Marrow Knit ✚ | 0 | Consume. Heal 4 + MET. Costs 4 biomass | 7 | — |

**Secret cards** (gateway rooms): Apex Print (2: Deal 4 + 2·MGT, 2 hits), Lazarus Cell (1: Heal 3 + MET, Plate 3 + HDE),
Overwrite (0: +2 energy, Draw 1; ABR 8: +3 energy).

**Planet cards** (only drop on their planet):

| Planet | Card | Cost | Formula |
|---|---|---|---|
| Kessra | Resonant Strike | 1 | Deal 2 + MGT. If last card was an attack, repeat |
| | Shatter | 2 | Deal 2. Remove target plating, deal 2× that |
| | Crystal Skin | 1 | Plate 3 + HDE. Doesn't fade next turn |
| | Split Lens | 1 | Deal RFX to ALL. 2+ enemies: hit twice |
| Mireth | Rot Needle | 1 | Apply Rot 1 + ABR |
| | Symbiote | 1 | Heal equal to all Rot on enemies |
| | Canopy Cut | 2 | Deal 2 + MGT to ALL. Rot ABR÷2 to ALL |
| | Sap Graft | 0 | Deal ABR. Heal the damage |
| Orun | Signal Spike | 1 | Deal 1 + FOC. Reveal all intents |
| | Salvage Rig | 1 | Plate 1 + HDE. Next cache: +1 card choice |
| | Overcharge | 0 | +2 energy. Take 6 − HDE÷2 damage |
| | Colony Protocol | 2 | Draw 1 + FOC÷3. Drawn cards cost 1 less this turn |

### 4.2 Exploration deck (open world)

Played on the tile you face, or on yourself. Costs **oxygen**.

**Starter (7):** Override ×2, Plasma Cutter ×2, Echo Scan, Pry Bar, Suture Gel.

| Card | O₂ | Use | Scales with |
|---|---|---|---|
| Override | 1 | Open a sealed door or terminal. Rating ≤ FOC÷2 | FOC |
| Plasma Cutter | 1 | Clear debris or crystal. Density ≤ MGT÷2. **Tool:** stays in hand | MGT |
| Echo Scan | 1 | Reveal fog, caches and hidden tiles in radius 2 + FOC÷2 | FOC |
| Pry Bar | 1 | Open a cache. MGT 6: +1 item | MGT |
| Suture Gel | 2 | Heal 3 + MET | MET |
| Flare | 1 | Light a dark zone. Mobs hit start Exposed 1 + FOC÷3 | FOC |
| Field Notes | 1 | Reveal hidden things in radius 3. +1 Codon each | FOC |
| Beacon | 1 | Plant a beacon. Fast travel to it. Refill O₂ once there | — |
| Field Dressing ✚ | 0 | Consume. Heal MET − 1 | MET |
| Flesh Knitter ✚ | 0 | Consume. Heal 3 + MET. Costs 3 biomass | MET |

New cards the open world needs:

| Card | O₂ | Use | Scales with |
|---|---|---|---|
| Jet Pack | 2 | Cross a chasm or ledge | RFX 6: costs 1 |
| Hazard Seal | 1 | Walk hazard tiles unharmed for 6 + HDE steps | HDE |
| Lure | 1 | Pull a mob toward you or away, 3 tiles | ABR |
| Stalk | 1 | Next mob you touch: you strike first. Its plating is 0 | RFX |
| Core Drill | 2 | Dig a buried cache (shown by Scan) | MGT |
| Sample Kit | 1 | Harvest flora: 2 + MET÷2 biomass | MET |

### 4.3 Gates and forcing

World obstacles have a **rating 1–6**. The matching card opens it if the trait allows it.

| Obstacle | Card | Trait check |
|---|---|---|
| Sealed door | Override | FOC÷2 ≥ rating |
| Debris / crystal | Plasma Cutter | MGT÷2 ≥ rating |
| Chasm | Jet Pack | — |
| Dark zone | Flare / Echo Scan | — (dark just hides mobs and loot) |
| Hazard field | Hazard Seal | Or walk through and take damage |
| Gateway (violet tear) | — | Visible at ABR 6+ |

**No softlocks.** Any gate on the path to the boss can be **forced**: pay integrity = 3 × rating − HDE (min 1).
Optional gates (vaults, side zones) cannot be forced. They are the reason to return with a stronger sequence.

---

## 5. Battles

### 5.1 Screen (portrait)

```
┌───────────────────────────────┐
│ SHARDLING ✦        ⚔ 7 → you  │  enemy plate: name, intent
│ HP ▰▰▰▰▰▰▱▱▱  12/18  ⬢3       │
│                    ▲▲         │
│                  ◢◣◢◣  ← enemy│  on a ground ellipse, upper right
│                 ═══════       │
│   ◯◯                          │
│  ▐██▌  ← clone (back view)    │  lower left, on its own ellipse
│ ═══════                       │
│             CLONE-0047  ⬢5    │  player plate
│             INT ▰▰▰▰▰▱ 31/44  │
├───────────────────────────────┤
│ SCALPEL deals 6 to SHARDLING! │  text box, 2 lines, tap to skip
├───────────────────────────────┤
│ [card][card][card][card][card]│  hand
│ ●●●○  energy      [END TURN]  │
└───────────────────────────────┘
```

- Enemies stand on the upper platform, **up to 3**. Front one is large; others stand behind, smaller.
  Tap an enemy to target it. It steps forward.
- The clone is shown **from behind**, like a Pokémon back sprite. Its look reflects the chassis and traits
  (high Might = heavier shoulders; high Aberrance = extra growths). Cheap to do with procedural drawing.
- The **text box** narrates each step, one line at a time: *"THE PRISM MOTHER splits the light!"*
- Hit feedback: sprite blink ×3, plate HP bar drains in steps, screen shake on big hits. Game Boy grammar.

### 5.2 Flow

1. **Intro.** Enemy slides in from the right, clone from the left. *"A LATTICE CRAWLER blocks the way!"*
2. **Initiative.** Compare RFX with the enemy's speed. Winner acts first in round 1 only.
   Stalk or a sneak from behind = you always go first, enemy plating 0.
3. **Player turn.** Draw to hand size. Energy refills. Play cards. End turn.
4. **Enemy turn.** Each enemy performs its shown intent, one text line each.
5. Repeat. Intents are always visible (except Orun's Signal twist).

Plating: cuts **every hit** by its value, clears at the start of its owner's next turn (current rule, kept).
Statuses kept: Weak, Expose, Tag, Triage, Rot (Mireth). All shown as small icons on the plate.

### 5.3 Leaving a battle

- **Flee:** a menu button. Chance = 40% + 5% × (RFX − enemy speed). Costs 2 O₂. Not vs elites or bosses.
  The mob stays on the map, alerted.
- **Win:** each corpse is **Eaten** (heal) or **Rendered** (biomass). Tagged corpses give double. Kept from Reprint.
- **Lose:** the clone dies. Run ends (section 9).

### 5.4 Enemies use traits too

Enemies get a small trait block: **Might, Hide, Speed, Will**. Their intents are formulas like cards.
Planet **tier** adds to all of them. This keeps one scaling rule for everything.

| Tier | Enemy trait bonus | HP multiplier |
|---|---|---|
| 1 (first landing) | +0 | ×1.0 |
| 2 | +2 | ×1.5 |
| 3 | +4 | ×2.1 |
| Origin | +6 | ×2.8 |

Existing rosters carry over: lab (Hull Tick, Mewling Copy, Custodian Husk, Sentry Drone, Vat Bloom, The Choir, The First),
Kessra (Shardling, Lattice Crawler, Singing Geode, Refractor, Prism Mother), Mireth and Orun as in `WORLDS.md`.
Enemies target the clone as a whole. No limbs.

---

## 6. Exploration: the open world

### 6.1 View and movement

- **Top-down, ¾ tiles,** like the Pokémon overworld. The clone walks tile by tile.
- Portrait screen shows about **11 × 15 tiles**. The map scrolls.
- Controls: **tap a tile** to path there, or a virtual d-pad (setting). One thumb.
- Tap an object next to you: context actions and matching exploration cards light up.
- Walking is free. **No random encounters.** Mobs are visible and move.

### 6.2 Pressure

Mobs don't respawn, so grinding is impossible. Pressure comes from:

- **Oxygen.** Exploration cards cost O₂. O₂ refills at vents, beacons, the ship, and +2 after each won battle.
- **Hazards.** Cold, acid, radiation tiles cost integrity per step (less with Hide).
- **The storm.** Each planet has a **storm clock**: after about 600 steps, a front rolls in from the edge.
  Storm zones drain O₂ per step. Mobs in storm zones get +1 tier. Push to the boss, or accept worse fights.
- **Integrity.** It carries over between battles. Healing is scarce: corpses, medic cards, vents.

### 6.3 Map generation

Seeded and deterministic, like the current core.

1. **Grid:** 48 × 48 tiles for tier 1, 56 × 56 for tier 2, 64 × 64 for tier 3.
2. **Zones:** scatter 10–16 seed points (Poisson disk). Voronoi cells become zones.
3. **Ring by distance** from the landing site: *Safe → Wild → Deep → Lair.* Danger rises outward.
4. **Links:** minimum spanning tree between neighbouring zones, plus 25% extra edges for loops.
   Some edges become **gates** (door, debris, chasm) with rating = ring + tier.
5. **Critical path:** landing → boss lair. Every gate on it is forcible (4.3).
6. **Terrain:** per-zone noise picks floor, walls, flora and hazard patches from the planet's biome kit.
7. **Points of interest** from a budget per ring (table below). Minimum spacing keeps them spread.
8. **Validate:** flood fill proves the boss is reachable. Reroll a zone if not.

| POI | Safe | Wild | Deep | Lair |
|---|---|---|---|---|
| Mobs (packs of 1–3) | 2 | 4 | 5 | 2 |
| Elite | — | 1 (50%) | 1 | — |
| Cache (loot) | 2 | 2 | 2 | 1 |
| Event | 1 | 1 | 1 | — |
| Upgrade site | 1 | 1 | 1 | — |
| Vent (rest) | 1 | — | 1 | 1 (before boss) |
| Hidden (Scan to find) | — | 1 | 2 | — |
| Gateway (ABR 6+) | — | 1 (50%) | 1 (50%) | — |
| Boss | — | — | — | 1 |

Per zone type counts. Per planet: ~25 fights, 2–3 elites, 1 boss. About 12–18 minutes.

### 6.4 Points of interest

| POI | What happens |
|---|---|
| **Mob pack** | Roams a small area. Touch it: battle. Some chase on sight (vision cone; RFX lowers detection). |
| **Elite** | Stays put, guards a cache. Reward: a planet card choice + implant. |
| **Boss lair** | A set-piece arena. Boss fight. Unlocks launch. |
| **Cache** | Needs Pry Bar or a gate. Gives a card choice, biomass, or an implant. |
| **Event** | Text choice with trait checks (section 6.5). Holds a log fragment. |
| **Splice pod** | **Upgrade site.** Pay biomass: +1 somatic to one of 2 offered traits. |
| **Printer terminal** | **Upgrade site.** Add 1 of 3 cards to a deck. Costs biomass. |
| **Surgery bay** | **Upgrade site.** Remove a card (Excise). Costs biomass. |
| **Vent** | Rest once: heal 25% + MET, refill O₂, refill exploration hand. |
| **Beacon** | Player-placed. Fast travel + O₂ refill once. |
| **Gateway** | Secret room (Reliquary, Lair, Vat room, Fold), as in Reprint. |
| **Landing site** | The ship. Save, O₂ refill, launch once the boss is dead. |

Upgrade site types are always distinct in one ring, so the player can plan a route.

Splice pod price: **6 + 4 × (somatic points already bought this run)**.
Printer: **5** biomass. Surgery: **4 + 2 per excise this run**.

### 6.5 Events use trait checks

Each option lists a trait and a target. Success is certain at or above it, else a chance:
`chance = 100% − 15% × (target − trait)`.

Example — *The Humming Geode* (Kessra):
- **Crack it open** (MGT 6): +biomass. Fail: 6 damage.
- **Listen** (FOC 5): a log fragment + Codons.
- **Press your face to it** (ABR 7): +1 somatic Aberrance. Fail: Rot 3 until you rest.
- **Leave.**

Aberrance options are always the strangest and best-paying. They're how the "weird, wrong" tone survives.

### 6.6 Loot

- **Cards** for either deck. Offers of 3, weighted to your top two traits.
- **Biomass.** Run currency for all upgrade sites and medic cards.
- **Implants** — new. Passive run items, like relics. They fill the role genes used to play.
  Examples:

| Implant | Effect |
|---|---|
| Rib Lattice | Start every battle with plating = HDE |
| Second Stomach | Eating also gives 2 biomass |
| Spinal Relay | First card each battle costs 0 |
| Wet Eye | See mob vision cones. +1 Scan radius |
| Tumor Engine | +1 Aberrance. −4 max integrity |
| Adrenal Sac | Winning at > 50% integrity: +1 O₂ |

About 30 at launch. Some planet-specific.

---

## 7. Planets and the run

### 7.1 Run structure

```
PRINTER (hub, between runs)
  └─ spend Codons, pick chassis, launch
       └─ LANDING 1: Derelict (tier 1, small, tutorial-grade)
            └─ boss dies → star chart: pick next planet
                 └─ LANDING 2: Kessra | Mireth | Orun (tier 2)
                      └─ boss dies → pick next
                           └─ LANDING 3: one of the other two (tier 3)
                                └─ boss dies → run won, ending text
                                     └─ ORIGIN (tier 4) if unlocked
```

- **Tier comes from the landing number, not the planet.** Kessra at landing 2 is tier 2; at landing 3, tier 3.
  Order becomes a real choice: which biome's cards and implants do you want early?
- **Target length:** ~12 min derelict, ~15 min per world → **~45 min full run.**
  Longer than Reprint's 30-minute cap. **[Q1]** Auto-save on every step makes it splittable.
- Between landings the ship refuels: full O₂, 30% heal, exploration hand refilled.

### 7.2 Planets

| Planet | Biome | Twist | Signature |
|---|---|---|---|
| **Derelict** (the old lab ship) | Corridors, vats, windows | None. Teaches gates. | Current lab cast. Boss: The First. |
| **Kessra** | Glass caves | **Resonance:** every 3rd card each turn resolves twice | Crystal debris gates. Dark caverns. Boss: Prism Mother. |
| **Mireth** | Drowned forest | **Rot:** status that ticks. Deep water tiles (Jet Pack or swim for damage) | Heaviest biomass. Boss: Drowned Titan. |
| **Orun** | Dead colony | **Signal:** relay masts hide intents until destroyed or Scanned | Most doors (FOC). Boss: Arbiter. |
| **Origin** | All three, mixed | All twists, one per zone | Unlocked by clearing all three. Boss: The Architect. |

Each planet: 3 mobs, 1 elite, 1 boss, 4 planet cards, ~5 implants, 4 events, 5 log fragments, one ending line.
Mob and card content is already written in `WORLDS.md`.

### 7.3 Unlocking planets (meta)

- New save: only the **Derelict** exists. Its boss reveals **Kessra** on the star chart.
- Clearing a world reveals the next. After first reveal, worlds are always offered.
- Clearing all three once (in any runs) unlocks **Origin** as a 4th landing.
- So early runs are short (1–2 landings). The run grows as the galaxy opens. This softens [Q1].

---

## 8. Meta-progression

### 8.1 Codons

Meta currency. **Always kept on death.**

| Source | Codons |
|---|---|
| Each mob killed | 1 |
| Elite | 5 |
| Boss | 15 × tier |
| Log fragment (first time only) | 5 |
| Field Notes finds | 1 each |
| Landing survived | 5 × tier |

A failed first run earns ~20–30. A full run ~150–200.

### 8.2 The Printer (hub)

Between runs you stand in the Printer bay. Four stations:

| Station | Spend | Buys |
|---|---|---|
| **Sequencer** | Codons | +1 Sequence to a trait. Cost **6 + 3 × current level** (3→4: 15, 11→12: 39) |
| **Archive** | Codons | Unlock cards into reward pools (new cards don't appear until unlocked) |
| **Chassis bay** | Codons | Unlock chassis (section 10) |
| **Codex** | — | Logs, bestiary, endings |

Full sequence (all six at 12) costs ~1,400 Codons. About 10–15 good runs. A long tail, not a wall.

### 8.3 Germline genes

World bosses still offer **1 of 3 germline genes** (permanent passives), reworked for traits:

| Gene | Effect |
|---|---|
| Crystalline Bones | Start every battle with 4 plating |
| Resonant Core | First card of every battle resolves twice |
| Mitochondrial Surplus | +1 energy every turn |
| Deep Lungs | +3 O₂ |
| Dense Marrow | +8 max integrity (replaces Clinging Flesh; no limbs) |
| Carrion Gut | Eating heals 50% more |
| Second Heart | Once per run, a killing blow leaves you at 30% |
| Spare Cell | Draw 2 extra on the first turn of every battle |
| Heirloom Print | Start with one card from the last clone's deck |
| Plastic Genome | Somatic cap +2 (was Pineal Gate; gateways are now ABR-gated) |

### 8.4 Anti-trivialising

Meta power makes early planets easy. Two guards:

- **Tier by landing number** (7.1) keeps each run's curve intact.
- **Signal strength** (like ascension): after the first Origin clear, raise difficulty 1–10 for bonus Codons.

---

## 9. Death

Lost: run deck, biomass, implants, somatic levels, current map.
Kept: Codons, Sequence, unlocked cards, chassis, germline genes, planets revealed, codex.

The death screen shows **Codons earned** and the trait you could now afford. The next print is always a step stronger.

---

## 10. Chassis (starting classes)

| Chassis | MGT | HDE | RFX | FOC | MET | ABR | Starter deck change | Unlock |
|---|---|---|---|---|---|---|---|---|
| Standard Print | 3 | 3 | 3 | 3 | 3 | 3 | — | Start |
| Brute Print | 5 | 4 | 2 | 2 | 3 | 2 | Scalpel → Bonesaw ×1 | 40 Codons |
| Scout Print | 2 | 2 | 5 | 4 | 3 | 2 | +Stalk, +Scatter Rounds | 40 Codons |
| Leech Print | 2 | 3 | 3 | 2 | 4 | 4 | Brace → Graft ×1 | 60 Codons |

Chassis spreads **add to** your Sequence levels (each trait −3 + chassis value). A Brute with Sequence MGT 8 fights at MGT 10.

---

## 11. Visual direction

Keep: ink on paper, spot inks, hand-drawn procedural creatures, the palette in `src/render/palette.ts`.
Dial down: halftone density, off-register, paper grain, line boil.

| Element | Reprint (now) | Strain |
|---|---|---|
| Colour | 6 spot inks, all at once | **4-tone ramp per planet + 1 accent**, like a Game Boy Color palette |
| Halftone | All mid-tones | **Shadows only**, larger dots |
| Off-register | Everywhere | Only on card art and title screens |
| Outlines | Boiling lines | **Steady** 2px ink lines; boil only on creatures idling |
| UI | Paper cards, plates | Flat panels, **double-rule borders**, chunky pixel-ish HP bars |
| Type | — | Condensed monospace caps for names and the text box |

Planet ramps (dark → light, + accent):

| Planet | Ramp | Accent |
|---|---|---|
| Derelict | void · hull · boneDim · bone | sodium |
| Kessra | deep blue · cobalt · cryo · ice white | violet |
| Mireth | black water · moss · toxin · pale lime | flesh |
| Orun | ash · rust · sodium · bone | vermilion |

Trait colours (card tint, HUD): Might vermilion, Hide bone, Reflex mustard, Focus cobalt, Metabolism radium green, Aberrance violet.

---

## 12. Technical plan

Build beside Reprint. Share what is engine-neutral.

```
src/core/rng.ts             shared (seeded RNG)
src/render/palette.ts       shared
src/render/sketch.ts        shared (line style)
src/render/creatures.ts     shared; add back-view clone and front battle poses
src/strain/core/
  traits.ts                 trait math, derived stats, thresholds
  cards.ts                  card data as formulas; text renderer
  battle.ts                 battle state machine, intents, initiative
  enemies.ts                enemy trait blocks, tier scaling
  world/gen.ts              zones, links, gates, POIs, validation
  world/explore.ts          movement, mobs AI, O₂, storm, interactions
  run.ts                    landings, star chart, rewards, death
  meta.ts                   Codons, Sequence, unlocks, save (localStorage "strain.meta")
src/strain/render/          tile renderer, battle scene, print pass (light preset)
src/strain/ui/              HUD, hand, text box, Printer hub
strain.html                 second Vite entry
tests/strain/               rules tests + bot sim (reuse the 120-run approach)
```

- Pure, deterministic core. No DOM. Same discipline as Reprint.
- Card effects as **data**: `{ op: 'damage', base: 3, trait: 'mgt', weight: 1 }`.
  One evaluator reads effective traits. Text and numbers come from the same data, so they can't drift.
- Bot sim measures: clear rate per landing, Codons per run, runs to first world clear.

---

## 13. Milestones

| # | Milestone | Playable result |
|---|---|---|
| S1 | **Trait core + battle** | Headless battles with formula cards. Bot sim. |
| S2 | **Battle screen** | Pokémon-style scene, text box, hand. Test arena vs lab mobs. |
| S3 | **Open world: Derelict** | Map gen, walking, mobs, caches, gates, exploration deck, boss. |
| S4 | **Meta loop** | Printer hub, Codons, Sequencer, death and relaunch. *First full loop.* |
| S5 | **Kessra** | Planet kit, twist, star chart, tier scaling. |
| S6 | **Upgrade sites, events, implants** | Splice pods, printer, surgery, trait-check events. |
| S7 | **Mireth, Orun** | Rot, Signal. |
| S8 | **Origin, chassis, signal strength** | Endgame and long tail. |

S1 → S4 proves the core promise: *upgrade a trait, and every card hits harder next run.*

---

## 14. Open questions

Defaults are chosen so work can start. Change any of them.

| # | Question | Default in this doc |
|---|---|---|
| Q1 | Run length. A full 3-landing run is ~45 min, over the old 30-min cap. OK? | Yes, with save-anywhere. Early runs are shorter anyway. |
| Q2 | Six traits, or fewer (e.g. 3: Body, Mind, Gut)? | Six. Fewer makes builds samey. |
| Q3 | Somatic (run-only) trait boosts, or meta-only? | Both. Pods give runs their own shape. |
| Q4 | Do cards ever upgrade at all? | Never. Only thresholds unlock with traits. |
| Q5 | Up to 3 enemies per battle, or strict 1-v-1 like Pokémon? | Up to 3. Keeps AoE and Tag cards useful. |
| Q6 | Overworld: tap-to-path or d-pad? | Tap-to-path, d-pad as a setting. |
| Q7 | Can the player return to a cleared planet in the same run? | No. Forward only. |
| Q8 | Title? | *Reprint: Strain* (working). |
| Q9 | Keep the halftone print pass on the overworld, or battles only? | Light preset everywhere, stronger on battle intros. |
| Q10 | Separate codebase or same repo? | Same repo, second entry point, shared render utils. |
