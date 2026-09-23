# Project Plan — Clone & Space Dual-Deck Roguelite (working title: "Cloneward")

Mobile-first, dual-deck roguelite. Inspired by *Shroom and Gloom*.
New lore: clones exploring deep space.

Status: **pre-production**. Answer `docs/OPEN_QUESTIONS.md` before code.

---

## 1. Reference Breakdown (what we borrow)

| Shroom and Gloom pillar | Why it works | Our translation |
|---|---|---|
| Two decks: Combat + Explore | Two decision spaces, one run | **Tactics deck** (combat) + **Survey deck** (exploration) |
| Explore cards: lockpicks, maps, campfires, digging | Dungeon is a puzzle, not a corridor | Airlock hacks, star charts, med-pods, drills, scanners |
| Cook & eat enemies to heal | Combat loop = resource loop | **Salvage & Splice**: harvest alien biomass/DNA to repair your clone |
| Infinite card growth/modification | Build-crafting depth | **Gene-splicing** cards: stack mutations, fuse cards |
| First-person dungeon crawl | Atmosphere, immersion | Mobile: first-person "node view" in 2.5D, one-thumb play |

We copy **structure and feel**, never assets, names, text or code.

---

## 2. Lore Pitch (draft)

You are **Clone #0001** of a long-dead explorer.
A derelict seed-ship prints you when it drifts near a star.
Each run = one clone body. Death = reprint, slightly flawed.
Copy errors (mutations) are both curse and power.
Goal: reach the signal at the galaxy's core. Learn who you were.

Themes: identity, memory, disposability, loneliness, wonder.

Key lore hooks for mechanics:
- **Reprinting** = roguelite death/restart, explained in-world.
- **Genome Bank** = meta-progression (permanent unlocks).
- **Mutations** = run modifiers / card upgrades.
- **Memory Fragments** = story collectibles between runs.
- **Rival clones** = elite enemies (earlier failed copies of you).

---

## 3. Core Loop

```
Meta loop (between runs)
  Genome Bank -> pick clone chassis -> pick starting mutations -> launch
Run loop (~20-30 min, mobile session length)
  Sector map -> enter node -> play Survey cards (explore)
     -> encounter -> play Tactics cards (combat)
     -> Salvage & Splice (heal, upgrade, mutate)
     -> next node ... -> sector boss -> next sector (x3)
  Death/victory -> harvest DNA -> Genome Bank
```

### 3.1 Survey deck (exploration)
- Each node = a room on a derelict / planet / station.
- Draw hand of Survey cards; spend **Oxygen** (exploration energy).
- Card examples: Scan, Hack Airlock, Drill Hull, Deploy Beacon,
  Star Chart (reveal map), Med-Pod (rest), Jetpack (skip hazard).
- Outcomes: loot, traps, events, shortcuts, hidden rooms.

### 3.2 Tactics deck (combat)
- Turn-based, energy-based (StS-style), 1–3 enemies.
- Card types: Attack, Shield, Debuff, Tag (prepare for salvage).
- Enemy intents shown (readable on phone).

### 3.3 Salvage & Splice (the "cooking" analogue)
- Enemies "prepared" by Tag cards drop richer biomass.
- Process biomass: Dissect -> Sequence -> Synthesize -> Absorb.
- Output: heal, temporary buffs, **gene strands** for card mutation.
- Rule: healing mainly comes from defeated enemies.

### 3.4 Card growth
- Cards level up by use or by splicing gene strands.
- Mutation slots per card (e.g. +burn, +draw, +copy).
- Fusion: merge two cards into one hybrid.
- Unbounded scaling allowed; balanced by enemy scaling.

---

## 4. Mobile-First Design Constraints

- **Portrait orientation**, one-thumb reachable hand zone.
- Tap-to-select, tap-to-play; drag optional. No hover.
- Min touch target 44–48 pt. Readable at 5.4" screens.
- Session: pause/resume anywhere; auto-save every action.
- Run length 20–30 min; can split into 5-min chunks.
- Offline play by default. No network required.
- Battery/thermal budget: 30–60 fps, low draw calls.
- Accessibility: colorblind-safe, text scaling, reduced motion.
- Safe areas / notches handled.

---

## 5. Recommended Tech (pending answers)

| Option | Pros | Cons |
|---|---|---|
| **Godot 4 (GDScript/C#)** — *recommended* | Free, light, great 2D, good mobile export, no royalties | Smaller ecosystem than Unity |
| Unity 6 (C#) | Huge ecosystem, ads/IAP SDKs, 3D strength | Heavier builds, licensing history |
| Web: TypeScript + Phaser/PixiJS + Capacitor | Fast iteration, instant web demo, PWA | Perf ceiling, native feel harder |

Architecture (engine-agnostic):
- **Pure game-logic core** (deterministic, seeded RNG, no engine calls).
- Data-driven content: cards/enemies/events in JSON or resources.
- Command/event log -> enables undo, replays, save states, tests.
- View layer subscribes to logic events (animations only).
- Unit tests on the logic core; balance sim scripts (bot runs).

---

## 6. Content Scope (MVP vs Launch)

| Content | Vertical slice | MVP (soft launch) | 1.0 |
|---|---|---|---|
| Sectors (acts) | 1 | 3 | 3 + endless |
| Clone chassis (classes) | 1 | 2 | 4 |
| Tactics cards | 25 | 80 | 150+ |
| Survey cards | 15 | 40 | 80+ |
| Enemies | 6 + 1 boss | 20 + 3 bosses | 40 + 6 bosses |
| Events | 8 | 30 | 60+ |
| Mutations/relics | 10 | 40 | 100+ |

---

## 7. Milestones

| # | Milestone | Goal | Est. (solo dev) |
|---|---|---|---|
| 0 | Pre-production | Answer questions, GDD, paper prototype | 2–3 wks |
| 1 | Logic prototype | Both decks + combat in greybox, headless tests | 3–4 wks |
| 2 | Vertical slice | 1 sector, art style locked, mobile build on device | 6–8 wks |
| 3 | Content & meta | 3 sectors, Genome Bank, saves, tutorial | 8–12 wks |
| 4 | Closed beta | TestFlight / Play internal, analytics, balance | 4–6 wks |
| 5 | Soft launch | 1–2 regions, tune retention/monetization | 4–8 wks |
| 6 | Global launch | Store assets, localization, marketing | — |

---

## 8. Risks

- **IP risk**: too close to source. Mitigate: original names, art, text.
- **Two decks on small screen** = UI clutter. Prototype UI first.
- **Balance explosion** from infinite scaling. Build sim bots early.
- **Scope creep**. Lock MVP list; cut aggressively.
- **Monetization vs fairness** in a roguelite. Decide early.
- **3D first-person on mobile** = cost + perf. Default to 2.5D.

---

## 9. Immediate Next Steps

1. Answer `docs/OPEN_QUESTIONS.md`.
2. Paper-prototype both decks (index cards, 1 hour tests).
3. Write GDD v1 from answers.
4. Scaffold repo: engine project, logic core, tests, CI.
5. Build Milestone 1 greybox.
