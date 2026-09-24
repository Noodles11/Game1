# Worlds, Mobs & Structure — Design Plan

Status: **M1 and M2 shipped.** Mainframe, world select, node map, permanent boons and Kessra are live.
Mireth, Orun and Origin are still proposals (M3–M5).

---

## 1. Lore spine (revealed piece by piece)

- Humanity is dying. Its last project: **brute-force a genome that survives**.
- Millions of random DNA sequences. Each one printed, tested, discarded.
- The **lab ship** is the test chamber. A closed loop built to force evolution.
- Before the end, the project sent seed-probes to **three hostile worlds**.
  Each world was a harder test. Each one ran its own copy of the experiment.
- You are one print. The others you meet — Copies, the Choir, The First — are failed prints.
- The truth arrives in fragments: **logs** found in the world, one per event node.

**Story delivery (proposed answer to Q18):** whispers (already in), log fragments at event
nodes, a short ending text per world. No cutscenes, no NPC dialogue trees.

---

## 2. Run structure

```
LAB SHIP (linear, 2 sectors)          ~12 min
  └─ The First dies → MAINFRAME
       └─ choose 1 of 3 worlds
            └─ ship crash-lands
                 └─ WORLD NODE MAP (7 rows → boss)   ~15 min
                      └─ world boss dies → ENDING + permanent buff
```

- One run = lab + one world. Fits the 30-minute cap.
- Death: full reset. Back to the lab, next clone number.
- Clear all 3 worlds (across runs) → the mainframe shows a 4th destination: **Origin**.

**Replays:** every run starts from the very beginning of the lab (decided). No shortcut.

---

## 3. Node map (worlds only)

Slay-the-Spire-style, portrait, scrolls up.

| Property | Value |
|---|---|
| Rows | 7 plus a boss node |
| Width | 2–4 nodes per row, 2–3 branching paths |
| Node → play | Each node opens a **short corridor** (1–3 segments) in the existing layered renderer |
| Choosing | **In first person.** The tunnel forks into 1–3 passages (left / middle / right), each signed with what lies down it. The node tree is a view-only map you open with the *map* button. |
| Hidden nodes | Some nodes show `?` until revealed |

**Node types**

| Icon | Node | What happens |
|---|---|---|
| ⚔ | Fight | 1–3 regular mobs |
| ☠ | Elite | One tough mob. Better reward (a gene or a rare card) |
| ▣ | Locker | Loot, like now |
| ⌬ | Pod | Splice pod, like now |
| ✦ | Event | Choice + a log fragment |
| ◉ | Boss | World boss |

**Survey deck on the map** (keeps both decks meaningful):
- *Echo Scan* reveals `?` nodes on the next 2 rows.
- *Flare* marks a Fight node: its enemies start Exposed.
- *Override* unlocks a sealed shortcut edge (skip a row).
- Inside a node's corridor: doors, wreckage, darkness — as now.

---

## 4. The three worlds

Each world: its own palette, props, 3 mobs, 1 elite, 1 boss, 4 cards, 1 gene,
a mechanic twist, events, an ending and a permanent buff.

### 4.1 KESSRA — the Glass Caves

Cold crystal caverns that hum. The probe found a lattice that remembers.
Palette: ice cyan, white, deep blue. Props: crystal columns, shard floors, glowing geodes.

**Twist — Resonance.** Every 3rd card you play in a turn is played **twice**.
Enemies resonate too: crystals near them grant plating.

| Mob | Role | Pattern sketch |
|---|---|---|
| **Shardling** | swarm | Weak bites. **Splits into 2 half-HP shardlings on death** (once). |
| **Lattice Crawler** | tank | Gains plating every turn. Hits hard when plating ≥ 10. |
| **Singing Geode** | support | Can't attack. Gives allies +2 strength. Kill it first. |
| **Refractor** *(elite)* | reflect | While plated, reflects 50% of damage back at you. |
| **THE PRISM MOTHER** *(boss)* | phases | P1: splits light — alternates single/all attacks. P2 (<50%): spawns Shardlings each turn. |

| New card | Cost | Effect |
|---|---|---|
| Resonant Strike | 1 | Deal 5. If the last card you played was an attack, deal it again. |
| Shatter | 2 | Deal damage equal to target's plating ×2, then remove it. |
| Crystal Skin | 1 | Plate 6. This plating doesn't fade next turn. |
| Split Lens | 1 | Deal 3 to all. If 2+ enemies, hit twice. |

Gene: **Faceted** — +1 hit, −2 damage per hit.
Permanent buff: **Crystalline Bones** — start every fight with 4 plating.
Ending: *"The lattice was never a cave. It was a record — every print, in glass. Yours is the newest."*

### 4.2 MIRETH — the Drowned Forest

A flooded, bioluminescent jungle. Everything here eats, and everything here is eaten.
Palette: toxin green, violet, black water. Props: roots, hanging vines, glowing water.

**Twist — Rot (new status).** Rot N: take N damage at the start of your turn, then Rot −1.
Enemies apply it to you. New cards apply it to them.

| Mob | Role | Pattern sketch |
|---|---|---|
| **Stiltwader** | striker | Long legs. Big single hits, then a turn exposed. |
| **Leech Swarm** | thief | Steals 2 **biomass** per hit. Kill fast. |
| **Lure Bloom** | debuffer | Applies Rot 3. Heals itself when you have Rot. |
| **Rootmother** *(elite)* | summoner | Summons a Leech each turn. Roots you: −1 energy next turn. |
| **THE DROWNED TITAN** *(boss)* | attrition | Floods: applies Rot to you every turn. Heals from your Rot. Burst it down. |

| New card | Cost | Effect |
|---|---|---|
| Rot Needle | 1 | Apply 4 Rot. |
| Symbiote | 1 | Heal equal to all Rot on enemies. |
| Canopy Cut | 2 | Deal 5 to all. Apply 2 Rot to all. |
| Sap Graft | 0 | Deal 3. Drain 100%. |

Gene: **Rotting** — also apply 2 Rot.
Permanent buff: **Symbiotic Gut** — eating a corpse heals 50% more.
Ending: *"The forest grew from a failed print. It learned to live by eating the rest. It calls you sibling."*

### 4.3 ORUN — the Dead Colony

An ash desert around a human colony that tried the same project and lost control of it.
Palette: rust, ash grey, sodium orange. Props: collapsed habs, antenna masts, ash drifts.

**Twist — Signal.** Relay towers hide enemy intents (shown as `???`)
until you destroy the relay or play a Scan-type card.

| Mob | Role | Pattern sketch |
|---|---|---|
| **Ash Walker** | brawler | An older-generation print. Gains strength each time it's hit. |
| **Colony Warden** | ranged | Drone pair. Volley, then recharge (a free turn for you). |
| **Relay Mast** | jammer | Never attacks. Hides all intents while alive. Plates allies. |
| **Foreman Exo** *(elite)* | armored | Heavy plating. Shatter/Expose are the answer. |
| **ARBITER** *(boss)* | puzzle | The colony AI that ran the project here. 3 shield layers; each drops when you play 3 different card types in one turn. |

| New card | Cost | Effect |
|---|---|---|
| Signal Spike | 1 | Deal 4. Reveal all intents this turn. |
| Salvage Rig | 1 | Plate 4. Next locker gives an extra card choice. |
| Overcharge | 0 | +2 energy. Take 3 damage. |
| Colony Protocol | 2 | Draw 3. Cards drawn cost 1 less this turn. |

Gene: **Jammed** — hit enemies lose their next plating gain.
Permanent buff: **Spare Cell** — draw +1 card on the first turn of every fight.
Ending: *"The colony's clones won. Then the colony had no one left to save. Arbiter kept testing anyway."*

---

## 5. Origin — the true ending

Unlocked after all three permanent buffs are earned.
The mainframe shows a 4th coordinate: the project's origin point.

- One short node map (5 rows) mixing all three worlds' mobs.
- Final boss: **THE ARCHITECT** — what's left of the project itself, not a person.
  Uses one move from each world boss, one per phase.
- Ending: the reveal. The project never had an end state. "Supreme" was never defined.
  You decide: shut the printer down, or print one more.
  *(Two final lines, same ending screen. No branching content to build.)*

---

## 6. Meta-progression (permanent, cross-run)

Stored in `localStorage` under a separate key (`reprint.meta`), survives death and new runs.

| Unlock | How |
|---|---|
| Crystalline Bones / Symbiotic Gut / Spare Cell | Beat that world's boss |
| Lab shortcut | Beat The First once |
| Log fragments (codex) | Visit event nodes; kept forever |
| Origin | Hold all 3 buffs |

Existing **per-run sector modifiers** (biomass / integrity / energy) stay exactly as they are.

---

## 7. Content budget

| Thing | Count |
|---|---|
| New mobs (incl. elites) | 12 |
| New bosses | 3 + The Architect |
| New cards | 12 |
| New genes | 3 |
| New statuses | Rot, hidden intent, split-on-death, reflect |
| Events | ~4 per world (12) |
| Log fragments | 5 per world + 5 lab = 20 |
| Endings | 4 |

Every creature is drawn procedurally in the existing hand-drawn style — no asset pipeline needed.

---

## 8. Milestones (each one playable and shipped on its own)

| # | Milestone | Delivers |
|---|---|---|
| M1 | **Framework** | Mainframe screen after The First, world-select (3 cards), node map engine + renderer, node → corridor bridge, meta save. One world stubbed with lab mobs. |
| M2 | **Kessra** | Full world 1: biome palette, 5 creatures, boss, cards, gene, Resonance, events, ending, buff. |
| M3 | **Mireth** | World 2 + Rot status. |
| M4 | **Orun** | World 3 + hidden intents, Arbiter's shield puzzle. |
| M5 | **Origin** | Codex screen, true-ending chapter, The Architect. |

Recommendation: build M1 → M2 first. That proves the whole loop end to end with one real world.

---

## 9. Decisions

1. **Worlds** — keep Kessra, Mireth and Orun as written.
2. **Replays** — always from the very beginning of the lab.
3. **World boss rewards** — a choice of 2 permanent boons per world. Kessra offers
   *Crystalline Bones* (start every fight with 4 plating) or *Resonant Core*
   (the first card of every fight resolves twice). Re-clearing a world offers whichever you
   don't have yet.

## 10. What shipped in M1 + M2, and where it differs from the plan

- **Mainframe** after The First; Mireth and Orun are shown as "signal lost" until M3/M4.
- **Junctions, not a clickable tree:** you pick your path at a fork in the tunnel. The tree is only a
  "where am I" map. No fork ever has more than 3 passages.
- **Node map:** 7 rows of 2–4 nodes plus the boss, always fully connected; row 3 always has a pod,
  every map has at least one elite. Some nodes are hidden (`?`). *Echo Scan* reveals the next 2 rows,
  *Flare* makes the next row's enemies start Exposed. The *Override shortcut* idea was dropped for now.
- **Kessra Resonance** applies to the player only (every 3rd card each turn resolves twice).
  The "crystals give enemies plating" half was cut; enemies get their plating from their own patterns.
- **Prism Mother** has a second phase below 50%: she sheds Shardlings. Summoned Shardlings arrive
  already split, so they never multiply.
- **Elites** reward a choice of Kessra-only cards plus 6 biomass.
- **Events:** 4 in Kessra, each with a log fragment kept forever. The 5th log comes from the boss.
- Bug fixed along the way: combat cards with *Heal* (Graft) never actually healed. They do now.
