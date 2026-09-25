# Body slots — design decisions

Status: **decided, not built yet.** The questions and answers from the concept review.
Nothing here is implemented.

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

## Still open

- Exact numbers: total starting health and each limb's rounded share.
- Which existing card goes to which slot type.
- Each enemy's targeting preference.
- The "limbs stop at 1 health" germline gene: its name and whether it replaces one of the ten.
