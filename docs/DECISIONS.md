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

## How the answers map to the build

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
