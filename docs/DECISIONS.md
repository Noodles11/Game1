# Decisions (answered questions)

| # | Question | Answer |
|---|---|---|
| 1 | Hobby or commercial? | Hobby |
| 2 | Platforms | Web, mobile browser first |
| 3 | Business model | None for now |
| 4 | How close to the source? | Keep the rules: dual decks, layered corridor rendering, cards that evolve inside the deck. Replace cards, enemies, lore and art. |
| 5 | Keep both decks? | Yes |
| 6 | Heal from defeated enemies? | Yes, from their biomass |
| 7 | Tone | Dark, grim, eerie, sci-fi, weird, wrong |
| 8 | Run length | 30 min max |
| 9 | Combat resource | Energy per turn, like the source game |
| 10 | Orientation | Portrait |
| 11 | One-handed play | Required |
| 12 | Art | Simple but interesting, hand-drawn look |
| 13 | Engine | Web: TypeScript + Vite + Canvas 2D, no framework |
| 14 | "Done" for v1 | Walk forward, fight different enemies, simple deck, a chance to evolve cards |
| 14b | Who is the clone, and why? | A synthetic being grown from procedurally-generated DNA. Humanity's last project, before extinction: brute-force trial and error toward a "supreme genome" that could survive. The clone is dropped into a self-contained simulated dungeon built to force evolution-like pressure — fight, adapt, improve, or fail and be reprinted. |
| 15 | World structure | Start on the ship/lab (current 2 sectors). Its boss unlocks the mainframe: pick 1 of 3 alien worlds. The ship crash-lands there. Each world is its own biome (caves, forests, another lab, etc, depending on the world). |
| 16 | Enemies per biome | Tied to the biome. Lab: synthetic mutants and machines (current cast). Each alien world: its own mobs, boss, and biome-specific cards/loot. |
| 17 | Endings | One ending per alien world (3), plus a true ending after clearing all 3 — that unlocks the final destination back at the lab ship. |
| 19 | Does death carry over? | No run state carries over on death. But beating a world's boss grants a **permanent** (cross-run) buff — separate from the current run-only sector modifiers. |
| 23 | Exploration shape | Node map (branching, player-chosen path), not a single fixed corridor. |
| 28 | Multiplayer | Local only. No online play, accounts, or leaderboards. |
| 32 | Saves | Browser storage (localStorage). No accounts, no cloud. |
| — | Worlds | Keep Kessra, Mireth, Orun. |
| — | Replays | Every run starts from the very beginning of the lab. |
| — | World boss reward | A choice of 2 permanent boons. |

## Roadmap this unlocks

The current build (`Reprint`, live) is **Chapter 0: the lab ship** — 2 linear sectors,
ending at The First. That stays as the game's opening chapter. Built on top of it:

1. **World select.** Beating The First opens the mainframe: choose 1 of 3 alien
   worlds (each gets a name, a one-line pitch, and a locked/unlocked state once visited).
2. **Node map.** Replace the fixed linear corridor with a branching node map per biome
   (à la Slay the Spire): several paths from entry to boss, nodes typed the same way
   segments are now (fight / crate / pod / event), player picks the route.
3. **Biomes.** Each world reskins: its own enemy set (2-3 regular + 1 boss), its own
   reward-card pool, its own corridor/node art palette, its own event/whisper pool.
4. **Endings.** A distinct ending screen per world boss, plus a combined true ending
   once all 3 are cleared, unlocking a final chapter back at the lab.
5. **Meta-progression.** A `docs`-promised Genome Bank: world-boss kills grant permanent,
   cross-run bonuses (distinct from the existing per-run sector modifiers), persisted
   in the same save file.
6. **Save/load.** Full game-state persistence to `localStorage`, auto-resuming on load —
   ships first, since every later milestone depends on it and it stands alone.

## How the answers map to the current build

- **Title:** *Reprint*. You are a clone printed on a derelict ship.
- **Survey deck** (explore): costs oxygen, 3 per section, 4-card hand.
  Override opens hatches. Plasma Cutter clears wreckage. Echo Scan lights the dark.
  Pry Bar opens lockers. Suture Gel heals. Flare lights sections and Exposes foes there.
  Blocked with no card? Force through for 4 integrity, so you never get stuck.
- **Tactics deck** (combat): 3 energy, 5-card hand, enemy intents shown.
- **Biomass:** after a fight, each corpse is **eaten** (heal) or **rendered** (biomass).
  Tagged enemies yield double.
- **Evolution:** splice pods let you spend biomass to add **genes** to any card.
  Genes stack without limit. Price rises with card level. The card's name and text change.
- **Corridor:** each section is one hand-drawn bulkhead layer, drawn back to front like a paper diorama.
  Lines "boil" slightly, like hand animation. Dark sections hide what's in them until lit.
- **Death:** reprints you as the next clone number.
