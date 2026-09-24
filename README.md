# Reprint

A dark sci-fi, dual-deck roguelite for mobile browsers.
You are a clone. Walk the corridor. Eat what you kill. Rewrite your cards.

A run: the **lab ship** (2 linear sectors) → beat The First → the **mainframe** → crash-land on an
alien world and cross its **node map** to the world boss, who grants a **permanent boon**.
Playable now: the lab and **Kessra, the Glass Caves**. Mireth and Orun come later — see `docs/WORLDS.md`.

## Play

```bash
npm install
npm run dev        # open the printed URL on your phone (same Wi-Fi)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server, reachable from your phone on the LAN |
| `npm test` | Rules tests, including a 30-seed bot playthrough |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run build:artifact` | Build one self-contained HTML file in `dist-artifact/` |

## Layout

```
src/core/     Game rules. Pure TypeScript, seeded RNG, no DOM. Fully tested.
  cards.ts    Card and gene data, evolution (splicing), card text
  enemies.ts  Enemy stats and intent patterns
  game.ts     State machine: explore, combat, harvest, reward, splice, map, event, boon
  worlds.ts   Worlds, node-map generation, events, logs, boons
src/render/   Canvas drawing: layered corridor, hand-drawn creatures
src/ui/       DOM: HUD, hand, sheets, input
tests/        Vitest specs
docs/         Plan, open questions, decisions
```

Design notes: [docs/GAME_PLAN.md](docs/GAME_PLAN.md), [docs/DECISIONS.md](docs/DECISIONS.md).
