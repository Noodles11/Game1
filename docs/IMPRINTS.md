# Imprints — cards that change themselves and each other

The genome drifts. What happens to a clone in play gets printed into its cards.
An **Imprint** is a permanent change to one card for the rest of the run. No cap, and it can go negative.
Genes are bought at pods; Imprints are earned in play. Both stack.

## Keywords

| Keyword | Meaning |
|---|---|
| Imprint | Permanent stat change earned in play. Shown as a violet badge; the card reprints when it changes. |
| Hold | Stays in hand at end of turn. Takes a draw slot. |
| Sibling | Every Imprint (and mutation) on one copy lands on all copies. New copies arrive already grown. |
| Consume | Removes a card from the deck for the rest of the run. |
| Unstable | Random result; one time in three a defect gene (Brittle −2 damage, Sluggish +1 cost). |

## Cards

| Card | Cost | Effect | Permanent part |
|---|---|---|---|
| Harvest Needle | 1 | Deal 3. Tag 1. Tagged target: heal 1 per tagged enemy. | Every 6 health drawn: Tag +1. |
| Unscarred Edge | 1 | Hold. Deal 4. Each clean round held: +2 this fight; a hit wipes it. | Every 3 clean rounds: +1 damage. |
| Scar Tissue | 1 | Hold. Plate 3. | Lose integrity while held: +1 on a random other tactic. |
| Feeding Blade | 1 | Deal 5. | Each kill: +2 damage. |
| Callus | 1 | Plate 4. | Each hit its plating fully stops: +1 plating. |
| Donor Cell | 0 | Choose a card in hand. | It gains +2 damage (or plating). Three doses, then Donor is Consumed. |
| Sibling Print | 1 | Sibling. Deal 4. | Shares every Imprint across copies. |
| Cannibal Print | 1 | Deal 2, then Consume a card in hand. | Gains exactly what is printed on it now: damage, plating, tag (fight bonuses included). |
| Mutagen Flask | 1 | Unstable. Choose a card in hand. | Free random gene, 1 in 3 a defect. Flask is Consumed. |
| Hunger Clock | 2 | Deal 11. | Each kill +3. A won fight where it wasn't played −2. |
| Grief Engine | 1 | Plate 3. Draw 1. | Each Consume anywhere: +1 plating. |
| Echo Scar (Kessra) | 1 | Deal 4. | Resonance doubles it: +1 to it and every Resonant Strike. |
| Field Notes (survey) | 1 | Reveal ahead. | Each hidden thing found: +1 damage on a random tactic. |

## Archetypes

- **Pristine** — Unscarred Edge + Callus + Brace. Per-hit plating makes clean rounds realistic.
- **Scarred** — Scar Tissue + taking hits on purpose. Pulls against Pristine.
- **Butcher** — Harpoon/Hook tags → Harvest Needle heals; Feeding Blade and Hunger Clock grow on kills.
- **Sacrifice** — Donor, Cannibal and Flask thin the deck; Grief Engine grows from each loss.
- **Siblings** — stack Donor doses and mutations on one Sibling; every copy gets them.
- **Resonance** — Echo Scar in Kessra.
- **Explorer** — Field Notes turns scouting into damage.

## Balance note

Autoplay bot, 120 runs: 47 clear Kessra (48 before), 52 die in the lab, 21 in Kessra.
Largest single Imprint seen: +38 damage.

## Rule: copying reads the printed card

Anything that reads or copies a card's numbers (Cannibal, Donor's damage-or-plating choice, Scar Tissue,
Field Notes, Mutagen Flask's gene fit) takes exactly what is printed on it at that moment:
base + genes + Imprints + this fight's bonuses (Empower, Unscarred Edge).

## Medic cards (free heals)

Common, energy/oxygen-free heals with a green frame, red cross and a blood-drop price tag when they cost biomass.
They evolve like any card; two genes fit them best: **Clotting** (+2 heal, any deck) and **Frugal** (−1 biomass price).

| Card | Deck | Effect |
|---|---|---|
| Clot Patch | tactic | Heal 2. |
| Biomass Poultice | tactic | Heal 4. Costs 2 biomass. |
| Marrow Knit | tactic | Heal 7. Costs 4 biomass. |
| Field Dressing | survey | Heal 2. |
| Flesh Knitter | survey | Heal 6. Costs 3 biomass. |

Medic cards are **Consumed** on use: gone from the deck for the rest of the run (Grief Engines notice).
Can't be played without the biomass, or (heal-only cards) at full integrity.

**Triage** — a way to make heals mid-fight. After a Triage card is played, each *tagged* enemy that dies
this fight prints a **fleeting** Clot Patch into your hand (dashed frame; never joins the deck, gone when the fight ends).
Sources: **Triage Tag** (1: Deal 3, Tag 1, Triage 1) and the **Triage** gene (+1 Triage, fits any card that tags).
Stacks: two Triage plays print two patches per tagged death.
Clot Patch, Poultice and Field Dressing are listed twice in reward pools, so they turn up often; offers never repeat a card.

## Splice prices and elite mutations

Splice price = gene price × 1.5 + 3 per gene already on the card (was ×1 + 2).

About 3 cards in 10 at a pod also get an **elite mutation** offer: strong, pricey, and always with a drawback.

| Elite gene | Effect | Drawback | Price |
|---|---|---|---|
| Mirror Neurons | While in hand: each hit by another card, +1 damage this fight | +1 cost | 21 |
| Bloodlust | While in hand: each enemy death, +3 damage this fight | −5 max integrity when spliced | 18 |
| Pain Engine | While in hand: each time you lose integrity, +2 damage this fight | costs 1 biomass to play | 18 |
| Hive Shell | While in hand: each other card played, +1 plating this fight | +1 cost | 18 |
| Parasite | Heal 1 per hit that lands | −2 damage | 20 |
| Glass Marrow | +7 damage | lose 2 integrity per play (through plating) | 15 |

Elite genes never come from Mutagen Flask. Stacking the same elite gene stacks its effect.

Bot sim after this change and single-use medic cards: 31/120 clear Kessra (was 47).

## Splice pods, redefined (pour and mutate)

A pod holds one random **mutation**. You throw biomass into its pool in chunks (+1 / +5 / +10); it never comes back,
even if you walk away without mutating. The pool sets the strength. Pick a card it fits, then press **Mutate**.
One mutation per pod.

| Mutation | Effect | First step | Then |
|---|---|---|---|
| Hypertrophy | +damage | +2 at 5 | +1 per 10 |
| Keratin Bloom | +plating | +2 at 5 | +1 per 10 |
| Mitotic Split | +hits | +1 at 20 | +1 per 25 |
| Lean Atrophy | −cost (never below 0) | −1 at 15 | −1 per 30 |
| Scent Gland | +Tag | +1 at 5 | +1 per 15 |
| Regrowth | +heal | +2 at 5 | +1 per 10 |
| Nerve Bundle | +draw | +1 at 10 | +1 per 20 |
| Proboscis | heal per hit | +1 at 15 | +1 per 25 |

A quarter of pods hold an **elite mutation** instead: it needs its full price (gene cost × 1.5) in the pool.

## Surgery bays

One in lab sector 2, and half of world pod nodes have one after the pod. For biomass, cut out:
a defect gene (8), an elite gene's drawback only (12), a negative imprint scar (2 per point, min 4), or 1 of a biomass price (6).
Several cuts per visit.

Bot sim after this change: 10/120 clear Kessra (31 before). Evolution now costs far more per point; see the note in chat.
