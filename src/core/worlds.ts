import type { Rng } from './rng';
import type { MapNode, NodeKind, WorldMap } from './types';

export interface Boon {
  id: string;
  name: string;
  text: string;
  flavor: string;
  glyph: string;
}

export interface WorldDef {
  id: string;
  name: string;
  subtitle: string;
  pitch: string;
  /** False until the world's content ships. Shown, but not selectable. */
  playable: boolean;
  crash: string;
  whispers: string[];
  /** Encounters for early rows (0-2) and late rows (3+). */
  fightsEarly: string[][];
  fightsLate: string[][];
  elites: string[][];
  boss: string;
  bossWhisper: string;
  /** Extra reward cards found only here. */
  cards: string[];
  events: string[];
  boons: [string, string];
  endingTitle: string;
  ending: string;
  /** The log you get for killing the boss. */
  bossLog: string;
}

/** Germline genes: permanent rewrites of the clone line, offered by world bosses. Ten to collect. */
export const BOONS: Record<string, Boon> = {
  'crystal-bones': {
    id: 'crystal-bones', name: 'Crystalline Bones', glyph: '◇',
    text: 'Start every fight with 4 plating.',
    flavor: 'The lattice grew into your skeleton. It does not hurt. Much.',
  },
  'resonant-core': {
    id: 'resonant-core', name: 'Resonant Core', glyph: '≀',
    text: 'The first card you play in every fight resolves twice.',
    flavor: 'Somewhere under your ribs, a note that never stops ringing.',
  },
  surplus: {
    id: 'surplus', name: 'Mitochondrial Surplus', glyph: '⚡',
    text: '+1 tactic energy every turn.',
    flavor: 'Twice the furnaces in every cell. You run hot now.',
  },
  gatesight: {
    id: 'gatesight', name: 'Pineal Gate', glyph: '⟁',
    text: 'See hidden gateways: secret rooms, rare fights, restoring vats and shortcuts.',
    flavor: 'A third eye, grown shut until now. The walls were never solid.',
  },
  lungs: {
    id: 'lungs', name: 'Deep Lungs', glyph: '◌',
    text: '+1 oxygen while exploring.',
    flavor: 'Extra sacs along the spine. You breathe less and walk further.',
  },
  marrow: {
    id: 'marrow', name: 'Dense Marrow', glyph: '▥',
    text: '+10 max integrity.',
    flavor: 'Heavier bones. The printer was told to stop being careful with you.',
  },
  carrion: {
    id: 'carrion', name: 'Carrion Gut', glyph: '⊕',
    text: 'Eating biomass heals 50% more.',
    flavor: 'Nothing is wasted. Nothing was ever going to be.',
  },
  heart: {
    id: 'heart', name: 'Second Heart', glyph: '♥',
    text: 'Once per run, a killing blow leaves you at 30% integrity instead.',
    flavor: 'It sleeps behind the first one. It wakes exactly once.',
  },
  sparecell: {
    id: 'sparecell', name: 'Spare Cell', glyph: '▤',
    text: 'Draw 2 extra tactics on the first turn of every fight.',
    flavor: 'A reflex arc wired straight to the hands. You are already moving.',
  },
  heirloom: {
    id: 'heirloom', name: 'Heirloom Print', glyph: '⧉',
    text: 'Your last clone’s most-imprinted tactic is reprinted into the next one, Imprints intact.',
    flavor: 'The printer keeps one thing from each of you. It chooses the scars.',
  },
};

export const GERMLINE = Object.keys(BOONS);

export const WORLDS: Record<string, WorldDef> = {
  kessra: {
    id: 'kessra',
    name: 'Kessra',
    subtitle: 'the Glass Caves',
    pitch: 'Cold crystal caverns that hum. The probe found a lattice that remembers.',
    playable: true,
    crash: 'Hull breach. Atmosphere. Impact. The ship dies in a field of glass, still singing.',
    whispers: [
      'Your footsteps come back a half-second late.',
      'The crystal holds shapes. Some of them are shaped like you.',
      'Somewhere deep, a note rings and does not stop.',
      'Frost forms on your breath, then hums.',
      'Light bends wrong here. Your shadow points the other way.',
      'Shards crunch underfoot. Some crunch back.',
    ],
    fightsEarly: [['shardling', 'shardling'], ['crawler'], ['shardling', 'geode']],
    fightsLate: [['crawler', 'geode'], ['shardling', 'shardling', 'shardling'], ['crawler', 'shardling'], ['geode', 'shardling', 'shardling']],
    elites: [['refractor'], ['refractor', 'geode']],
    boss: 'prism',
    bossWhisper: 'The cavern opens into a cathedral of glass. Something vast turns to look at you.',
    cards: ['resonant', 'shatter', 'crystalskin', 'splitlens', 'echoscar', 'flask'],
    events: ['humming-column', 'frozen-print', 'echo-pool', 'probe-wreck'],
    boons: ['crystal-bones', 'resonant-core'],
    endingTitle: 'the lattice remembers',
    ending: 'The Prism Mother comes apart into a thousand clean pieces. In every one, a face. '
      + 'The caves were never caves. They were a record: every print that came here, kept in glass. '
      + 'Yours is the newest. For now.',
    bossLog: 'k5',
  },
  mireth: {
    id: 'mireth',
    name: 'Mireth',
    subtitle: 'the Drowned Forest',
    pitch: 'A flooded, glowing jungle. Everything here eats, and is eaten.',
    playable: false,
    crash: '', whispers: [], fightsEarly: [], fightsLate: [], elites: [], boss: '', bossWhisper: '',
    cards: [], events: [], boons: ['crystal-bones', 'resonant-core'], endingTitle: '', ending: '', bossLog: '',
  },
  orun: {
    id: 'orun',
    name: 'Orun',
    subtitle: 'the Dead Colony',
    pitch: 'Ash desert around a human colony that ran this same project, and lost.',
    playable: false,
    crash: '', whispers: [], fightsEarly: [], fightsLate: [], elites: [], boss: '', bossWhisper: '',
    cards: [], events: [], boons: ['crystal-bones', 'resonant-core'], endingTitle: '', ending: '', bossLog: '',
  },
};

export const WORLD_ORDER = ['kessra', 'mireth', 'orun'];

// ------------------------------------------------------------------ logs

export const LOGS: Record<string, string> = {
  k1: 'PROBE LOG 01 — Seeded Kessra, cycle 0. The lattice responds to bioelectric input. It is learning the shape of us.',
  k2: 'PROBE LOG 02 — Print #0000 entered the lattice voluntarily. Vitals nominal. It has not come out.',
  k3: 'PROBE LOG 03 — The caves repeat everything. Speech. Footsteps. Cell division.',
  k4: 'PROBE LOG 04 — Project directive: find the genome that survives. The directive does not define "survives."',
  k5: 'PROBE LOG 05 — The lattice is a record. Every print, kept in glass. Selection pressure: absolute.',
};

// ---------------------------------------------------------------- events

export interface EventEffect {
  hp?: number;
  heal?: number;
  maxHp?: number;
  biomass?: number;
  card?: string;
  /** Add a random card from the current world's pool. */
  worldCard?: boolean;
}

export interface EventOption {
  label: string;
  detail: string;
  result: string;
  effect: EventEffect;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  log: string;
  options: EventOption[];
}

export const EVENTS: Record<string, EventDef> = {
  'humming-column': {
    id: 'humming-column',
    title: 'The Humming Column',
    text: 'A column of glass, taller than the cavern should allow. It hums at exactly your pitch.',
    log: 'k1',
    options: [
      { label: 'Press your palm to it', detail: '−5 integrity, gain a Kessra card', result: 'It burns cold. When you pull away, you know something new.', effect: { hp: -5, worldCard: true } },
      { label: 'Walk on', detail: 'Nothing happens', result: 'The hum follows you for a while, then lets you go.', effect: {} },
    ],
  },
  'frozen-print': {
    id: 'frozen-print',
    title: 'The Frozen Print',
    text: 'A clone like you, sealed mid-step inside the crystal. The tag on its wrist reads #0000.',
    log: 'k2',
    options: [
      { label: 'Break it open', detail: '+8 biomass, −3 integrity', result: 'The crystal cracks. What is inside is still warm.', effect: { biomass: 8, hp: -3 } },
      { label: 'Leave it be', detail: 'Heal 4', result: 'You feel oddly calm. It would have wanted that.', effect: { heal: 4 } },
    ],
  },
  'echo-pool': {
    id: 'echo-pool',
    title: 'The Echo Pool',
    text: 'Water so still it looks solid. Your reflection moves a little late.',
    log: 'k3',
    options: [
      { label: 'Drink', detail: 'Heal 10', result: 'It tastes like nothing. You feel whole.', effect: { heal: 10 } },
      { label: 'Bottle the echo', detail: 'Gain Crystal Skin', result: 'The reflection stays in the flask, watching you.', effect: { card: 'crystalskin' } },
    ],
  },
  'probe-wreck': {
    id: 'probe-wreck',
    title: 'The Seed-Probe',
    text: 'The original seed-probe, split open on a spire of quartz. Its lights still blink.',
    log: 'k4',
    options: [
      { label: 'Strip the hull', detail: '+6 biomass', result: 'Old insulation, old blood. It all renders down.', effect: { biomass: 6 } },
      { label: 'Pull its data core', detail: '+4 max integrity', result: 'You wire the core into yourself. The directive reads clearer now.', effect: { maxHp: 4, heal: 4 } },
    ],
  },
};

// ------------------------------------------------------------------- map

export const MAP_ROWS = 7;
const COLS = 4;

/** Node kinds each row may roll, in weighted order. */
const ROW_TABLE: NodeKind[][] = [
  ['fight'],
  ['fight', 'fight', 'locker', 'event'],
  ['fight', 'event', 'locker', 'fight'],
  ['pod', 'fight', 'event'],
  ['elite', 'fight', 'event', 'locker'],
  ['fight', 'elite', 'pod', 'event'],
  ['pod', 'locker', 'event'],
];

/**
 * A branching map: MAP_ROWS rows of 2-4 nodes, then one boss.
 * Every node has a way forward, and every node can be reached.
 */
export function generateMap(rng: Rng, world: string): WorldMap {
  const nodes: MapNode[] = [];
  const rows: MapNode[][] = [];
  let id = 0;
  for (let r = 0; r < MAP_ROWS; r++) {
    const width = r === 0 ? 3 : 2 + rng.int(3);
    const cols = rng.sample([0, 1, 2, 3].slice(0, COLS), width).sort((a, b) => a - b);
    const row: MapNode[] = cols.map((col) => {
      const table = ROW_TABLE[r];
      const kind = table[rng.int(table.length)];
      return { id: id++, row: r, col, kind, hidden: r >= 2 && kind !== 'pod' && rng.next() < 0.3, next: [], visited: false, flared: 0 };
    });
    // Make sure the row before the boss has a pod, and some row has an elite.
    if (r === 3 && !row.some((n) => n.kind === 'pod')) row[rng.int(row.length)].kind = 'pod';
    rows.push(row);
    nodes.push(...row);
  }
  if (!nodes.some((n) => n.kind === 'elite')) {
    const late = rows[4];
    late[rng.int(late.length)].kind = 'elite';
  }
  const boss: MapNode = { id: id++, row: MAP_ROWS, col: 1.5, kind: 'boss', hidden: false, next: [], visited: false, flared: 0 };
  nodes.push(boss);

  // Edges: link each node to next-row nodes within one column.
  for (let r = 0; r < MAP_ROWS - 1; r++) {
    const here = rows[r];
    const next = rows[r + 1];
    for (const n of here) {
      for (const m of next) if (Math.abs(m.col - n.col) <= 1) n.next.push(m.id);
      if (n.next.length === 0) n.next.push(nearest(next, n.col).id);
    }
    for (const m of next) {
      if (here.some((n) => n.next.includes(m.id))) continue;
      const roomy = here.filter((n) => n.next.length < 3);
      nearest(roomy.length ? roomy : here, m.col).next.push(m.id);
    }
  }
  for (const n of rows[MAP_ROWS - 1]) n.next.push(boss.id);
  for (const n of nodes) n.next.sort((a, b) => a - b);
  return { world, nodes, rows: MAP_ROWS };
}

function nearest(row: MapNode[], col: number): MapNode {
  return row.reduce((best, n) => (Math.abs(n.col - col) < Math.abs(best.col - col) ? n : best));
}
