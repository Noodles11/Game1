# Body slots — design decisions

Status: **built.** The questions and answers from the concept review, then the numbers chosen when building it.

## Concept

- Five card slots, left to right: **left leg, left arm, head, right arm, right leg**.
- Each slot only takes cards of its type. A head card can't go in an arm slot, and the reverse.
- The tactics deck is regrouped into body sub-decks.
- Each turn, every working slot gets a random card from its sub-deck.
- Each limb has its own health pool. Together they make up total health.
- Enemies target specific limbs. A disabled limb's cards can't be used until it is healed.
- Energy goes up so the player can play at least the head and one limb each turn.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Death | The clone dies when the **head** reaches 0. Health split: **arms 7% each, legs 15% each, head 56%**. Limbs at 0 are only disabled. |
| 2 | Hits on a disabled limb | Damage aimed at a disabled limb **spills to the head**. |
| 3 | Damage no enemy aims | Forcing a door, Glass Marrow self-harm and reflected damage hit **the limb that acted**. Reliquary costs come out of **total** max health. |
| 4 | Healing | A heal card heals **a limb the player chooses**. Eating biomass heals the **most damaged** limb. Vat rooms heal **every** limb. |
| 5 | Getting a limb back | A limb works again once it is **above 0**. It does **not** recover on its own, not even between fights. Planned germline gene: limbs stop at **1** health instead of being disabled, so they stay usable. |
| 6 | Slot roles | **Arms:** strikes. **Legs:** plate, dodge, kicks, movement. **Head:** tags, debuffs, draw, energy. |
| 7 | Left vs right | **Shared decks:** both arm slots draw from one arm deck, and both leg slots from one leg deck. Each limb still has its own health. |
| 8 | Survey deck | Stays **separate** and is used while exploring, as now. |
| 9 | Plate and statuses | **One shared plate pool.** Weak, Exposed and other statuses affect the whole body. Each enemy attack targets one limb, shown on its intent. |
| 10 | Enemy targeting | Each enemy has a **preference** (for example crawlers go for legs, the Prism Mother for the head). The target limb is shown on the intent. |
| 11 | Slots and energy | Slots **redraw every turn**. **Hold** keeps a card in its slot. Energy goes up **from 3 to 4**. Head cards cost 1–2, limb cards 1–2. |
| 12 | Draw and hand effects | Draw effects (Cold Echo, Adrenal, Spare Cell) **redraw a slot you choose**. "Hand" (Empower, Donor, Cannibal, Mirror Neurons) means the **five slot cards**. Fleeting Clot Patches go into an **empty slot or a sixth spare slot**. |
| 13 | Deck sizes | Starter decks of **3–4 cards per limb type**. A slot whose deck is empty is disabled until it gets a card. |
| 14 | Rewards and max health | New cards and max-health gains go to a **limb type or limb the player picks**. Max-health losses (Bloodlust, Reliquary) come from the limb with the **most max health**. |
| 15 | Cross-limb effects | Sibling, Scar Tissue, Grief Engine, Field Notes, Heirloom and Echo Scar **work across limbs**. |
| 16 | Healing cards | Medic cards are **any-slot** cards. |
| 17 | Resonance | Kessra's "every 3rd card each turn plays twice" and Resonant Core **stay as they are**. |
| 18 | Layout | The **5 slots side by side**, like the hand today. Below them, **one health bar split into 5 segments**, one per limb. A disabled limb's slot shows a **muted placeholder with a limb drawing and an X**. |
| 19 | Lore | Disabled limbs are visibly **torn off**. Surgery bays can **graft** them back. |
| 20 | Technical cost | Build in 3 steps: 1) core rules and data, 2) body UI, 3) card re-categorisation and balance. |

## Built with these numbers

**Starting integrity: 50.** Arms 4 each (8%), legs 7 each (14%), head 28 (56%). With a total near 50,
the exact 7/15/56 split can't be whole numbers, so this is the closest whole-number split.

**Energy:** 4 per turn.

**New germline gene: Clinging Flesh.** Limbs hold at 1 integrity instead of being torn off, and the rest of the blow
goes to the head. It **replaces Dense Marrow**, since +10 integrity would have needed a limb choice at the start of
every run. Saved progress with Dense Marrow becomes Clinging Flesh.

### Tactics by slot

| Slot | Cards |
|---|---|
| Arms (strike) | Scalpel, Harpoon, Flense, Scatter Rounds, Bonesaw, Salvage Hook, Graft, Siphon Blade, Harvest Needle, Unscarred Edge, Feeding Blade, Sibling Print, Cannibal Print, Hunger Clock, Apex Print, Resonant Strike, Shatter, Split Lens, Echo Scar |
| Legs (plate, kick) | Brace, **Heel Stomp** (new: Deal 4, Plate 2), Callus, Scar Tissue, Grief Engine, Crystal Skin, Lazarus Cell |
| Head (mark, weaken, draw, energy) | Neural Spike, Adrenal Leak, Cold Echo, Overclock Jack, Donor Cell, Mutagen Flask, Triage Tag, Overwrite |
| Any slot | Clot Patch, Biomass Poultice, Marrow Knit |

**Starter tactics (12):** arms: Scalpel ×3, Harpoon, Flense. Legs: Brace ×2, Heel Stomp ×2. Head: Neural Spike, Cold Echo, Adrenal Leak.

### Enemy targets

| Enemy | Aims at | Why |
|---|---|---|
| Hull Tick, Shardling, Lattice Crawler, Vat Bloom | legs | low to the floor |
| Mewling Copy, Hollow Twin, Refractor | arms | they want your hands / mirror your strikes |
| Sentry Drone, The Choir, The First, The Prism Mother | head | they go for the mind |
| Custodian Husk, Singing Geode | anywhere | |

The target is picked at the start of each of your turns, from working limbs of that kind (the head if none are left),
and shown on the intent (→ L.ARM). If that limb is torn off before the enemy acts, it picks again.

### Other rules

- Heal cards that let you choose a limb: medic cards and Suture Gel. Graft, Lazarus Cell, Parasite and
  Harvest Needle heal the most damaged limb automatically.
- Draw effects ask which slot to redraw. Mid-turn redraws only take from the draw pile and never reshuffle
  the discard, so a free card like Adrenal Leak can't loop forever.
- Clot Patches from Triage fill an empty working slot, otherwise they sit in a spare slot.
- Saves from before this change can't be loaded. The game starts a new clone.

Bot sim (120 runs): 67 clear Kessra, 38 die in the lab, 15 die in Kessra (10 cleared before this change).

## Stacks and walks (later change)

- **Slot stacks:** unplayed cards stay in their slot at the end of a turn. Each turn a new card goes **under** them,
  up to 3 per slot. Only the top card can be played; the card under it comes up when it is played. Draw effects put the
  new card **on top** of a chosen stack. Hold was removed from Unscarred Edge and Scar Tissue (every card stays now).
- **The walk between fights is one room:** oxygen refills and the survey hand is topped up to 4 only after a fight,
  at each world fork, at the start of lab sector 2, and after a gateway room. Footsteps change nothing.
  Unused survey cards stay in hand.
- **Plasma Cutter is a tool:** it stays in hand after use; oxygen is its only limit.

Bot sim after this change (120 runs): 54 clear Kessra, 52 die in the lab, 14 die in Kessra.
