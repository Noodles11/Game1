import type { CardDef, CardInstance, CardStats, DeckKind, ImprintStat } from './types';

const EMPTY: CardStats = {
  cost: 0,
  damage: 0,
  hits: 1,
  aoe: false,
  block: 0,
  draw: 0,
  energy: 0,
  tag: 0,
  weak: 0,
  exposed: 0,
  heal: 0,
  biomass: 0,
  empower: 0,
  drain: 0,
  chain: 0,
  shatter: 0,
  retain: false,
  swarm: 0,
  bioCost: 0,
  triage: 0,
  lifesteal: 0,
  selfHarm: 0,
};

/** Medic cards: free to play, they mend integrity. Some are paid for in biomass. */
export const MEDIC_CARDS = ['clot', 'poultice', 'knit', 'dressing', 'knitter'];

export function isMedic(defId: string): boolean {
  return MEDIC_CARDS.includes(defId);
}

export const CARDS: Record<string, CardDef> = {
  // ---- Combat deck ----
  scalpel: {
    id: 'scalpel', name: 'Scalpel', deck: 'combat', glyph: '╱',
    base: { cost: 1, damage: 6 },
    flavor: 'Standard issue. Still warm from the printer.',
  },
  brace: {
    id: 'brace', name: 'Brace', deck: 'combat', glyph: '▢',
    base: { cost: 1, block: 5 },
    flavor: 'Lock the joints. Let the body take it.',
  },
  harpoon: {
    id: 'harpoon', name: 'Harpoon', deck: 'combat', glyph: '↣',
    base: { cost: 1, damage: 4, tag: 1 },
    flavor: 'Hooked meat keeps. Tagged prey yields double biomass.',
  },
  flense: {
    id: 'flense', name: 'Flense', deck: 'combat', glyph: '≋',
    base: { cost: 2, damage: 8, exposed: 2 },
    flavor: 'Peel it open. Let the cold in.',
  },
  scatter: {
    id: 'scatter', name: 'Scatter Rounds', deck: 'combat', glyph: '⁂',
    base: { cost: 1, damage: 4, aoe: true },
    flavor: 'Rusted flechettes. They find everything.',
  },
  spike: {
    id: 'spike', name: 'Neural Spike', deck: 'combat', glyph: '⌇',
    base: { cost: 1, damage: 3, weak: 2 },
    flavor: 'It forgets how to hurt you.',
  },
  bonesaw: {
    id: 'bonesaw', name: 'Bonesaw', deck: 'combat', glyph: '⋀',
    base: { cost: 2, damage: 5, hits: 2 },
    flavor: 'The teeth are someone else’s.',
  },
  adrenal: {
    id: 'adrenal', name: 'Adrenal Leak', deck: 'combat', glyph: '✚',
    base: { cost: 0, energy: 1, draw: 1 },
    flavor: 'Borrowed from the next body.',
  },
  echo: {
    id: 'echo', name: 'Cold Echo', deck: 'combat', glyph: '◌',
    base: { cost: 1, draw: 2, block: 3 },
    flavor: 'You remember this fight. You never had it.',
  },
  hook: {
    id: 'hook', name: 'Salvage Hook', deck: 'combat', glyph: '⌐',
    base: { cost: 1, damage: 5, tag: 1, block: 2 },
    flavor: 'Reel it close. Keep it fresh.',
  },
  graft: {
    id: 'graft', name: 'Graft', deck: 'combat', glyph: '✣',
    base: { cost: 1, damage: 4, heal: 2 },
    flavor: 'Take a piece. Wear it. It helps, for now.',
  },
  jack: {
    id: 'jack', name: 'Overclock Jack', deck: 'combat', glyph: '⟴',
    base: { cost: 1, damage: 4, empower: 2 },
    flavor: 'Patch the wound wrong, on purpose. Something else learns to hit harder.',
  },
  siphon: {
    id: 'siphon', name: 'Siphon Blade', deck: 'combat', glyph: '⟠',
    base: { cost: 2, damage: 9, drain: 50 },
    flavor: 'Half of what it takes, it gives back to you.',
  },

  // ---- Medic: free heals ----
  clot: {
    id: 'clot', name: 'Clot Patch', deck: 'combat', glyph: '✚',
    base: { cost: 0, heal: 2 }, keywords: ['consume'],
    flavor: 'A synthetic scab. Slap it on and keep moving.',
  },
  poultice: {
    id: 'poultice', name: 'Biomass Poultice', deck: 'combat', glyph: '✚',
    base: { cost: 0, heal: 4, bioCost: 2 }, keywords: ['consume'],
    flavor: 'Somebody else’s tissue, pressed into your wound. It takes.',
  },
  knit: {
    id: 'knit', name: 'Marrow Knit', deck: 'combat', glyph: '✚',
    base: { cost: 0, heal: 7, bioCost: 4 }, keywords: ['consume'],
    flavor: 'Bone grows back in seconds. You hear it more than feel it.',
  },

  triage: {
    id: 'triage', name: 'Triage Tag', deck: 'combat', glyph: '⌖',
    base: { cost: 1, damage: 3, tag: 1, triage: 1 },
    flavor: 'Mark them. When they drop, the printer turns what’s left into bandages.',
  },

  // ---- Imprint cards: they change themselves, or others, for the rest of the run ----
  needle: {
    id: 'needle', name: 'Harvest Needle', deck: 'combat', glyph: '⟟',
    base: { cost: 1, damage: 3, tag: 1 },
    rules: ['If the target was tagged: heal 1 per tagged enemy.', 'Every 6 health drawn: Imprint Tag +1.'],
    brief: 'Tagged target: heal. Grows Tag.',
    flavor: 'It drinks from the marked ones first. It remembers who was marked.',
  },
  unscarred: {
    id: 'unscarred', name: 'Unscarred Edge', deck: 'combat', glyph: '⟋',
    base: { cost: 1, damage: 4 }, keywords: ['hold'],
    rules: ['Each round you lose no integrity while it is held: +2 damage this fight. A hit wipes it.', 'Every 3 clean rounds: Imprint +1 damage.'],
    brief: 'Clean rounds: +2. Grows.',
    flavor: 'A print that has never been cut. It intends to stay that way.',
  },
  scartissue: {
    id: 'scartissue', name: 'Scar Tissue', deck: 'combat', glyph: '≈',
    base: { cost: 1, block: 3 }, keywords: ['hold'],
    rules: ['Each time you lose integrity while it is held: Imprint +1 on another random tactic.'],
    brief: 'Hurt while held: imprint a tactic.',
    flavor: 'Every wound rewrites a line of you. Some lines come back stronger.',
  },
  feeding: {
    id: 'feeding', name: 'Feeding Blade', deck: 'combat', glyph: '⟆',
    base: { cost: 1, damage: 5 },
    rules: ['Each kill: Imprint +2 damage.'],
    brief: 'Kill: +2 forever.',
    flavor: 'It learns the shape of everything it opens.',
  },
  callus: {
    id: 'callus', name: 'Callus', deck: 'combat', glyph: '▣',
    base: { cost: 1, block: 4 },
    rules: ['Each hit its plating fully stops: Imprint +1 plating.'],
    brief: 'Full block: +1 plate forever.',
    flavor: 'Skin that remembers every blow, and thickens where it landed.',
  },
  donor: {
    id: 'donor', name: 'Donor Cell', deck: 'combat', glyph: '⊕',
    base: { cost: 0 }, keywords: ['consume'],
    rules: ['Choose a card in hand: Imprint +2 damage (or +2 plating).'],
    brief: 'Give a card +2 forever.',
    flavor: 'Three doses of someone else. Then nothing left of them at all.',
  },
  sibling: {
    id: 'sibling', name: 'Sibling Print', deck: 'combat', glyph: '⧉',
    base: { cost: 1, damage: 4 }, keywords: ['sibling'],
    brief: 'Shares every Imprint.',
    flavor: 'Printed from the same line. What one of them learns, all of them know.',
  },
  cannibal: {
    id: 'cannibal', name: 'Cannibal Print', deck: 'combat', glyph: '⊘',
    base: { cost: 1, damage: 2 }, keywords: ['consume'],
    rules: ['Then Consume another card in hand: Imprint exactly what is printed on it now (damage, plating, tag) onto this.'],
    brief: 'Then eat a card: take its printed numbers.',
    flavor: 'The failed prints have to go somewhere. This is where.',
  },
  flask: {
    id: 'flask', name: 'Mutagen Flask', deck: 'combat', glyph: '⚗',
    base: { cost: 1 }, keywords: ['unstable', 'consume'],
    rules: ['Choose a card in hand: splice a free random gene. One time in three it is a defect. Consumed.'],
    brief: 'Random gene to a card. Risky.',
    flavor: 'Unlabelled. Warm. The printer rejected it for a reason.',
  },
  hunger: {
    id: 'hunger', name: 'Hunger Clock', deck: 'combat', glyph: '◷',
    base: { cost: 2, damage: 11 },
    rules: ['Each kill: Imprint +3 damage.', 'A fight you win without playing it: Imprint −2 damage.'],
    brief: 'Kill: +3. Unused: −2.',
    flavor: 'It has to be fed. It counts the fights it wasn’t.',
  },
  grief: {
    id: 'grief', name: 'Grief Engine', deck: 'combat', glyph: '⊗',
    base: { cost: 1, block: 3, draw: 1 },
    rules: ['Whenever any card is Consumed: Imprint +1 plating.'],
    brief: 'Card consumed: +1 forever.',
    flavor: 'It keeps what the others lose. It is getting heavy.',
  },

  // ---- Secret rooms: only found through gateways ----
  apex: {
    id: 'apex', name: 'Apex Print', deck: 'combat', glyph: '▲',
    base: { cost: 2, damage: 10, hits: 2 },
    flavor: 'The print they were aiming for. It was never finished. It does not need to be.',
  },
  lazarus: {
    id: 'lazarus', name: 'Lazarus Cell', deck: 'combat', glyph: '✚',
    base: { cost: 1, heal: 6, block: 6 },
    flavor: 'It was dead in the vat. It got better. So will you.',
  },
  overwrite: {
    id: 'overwrite', name: 'Overwrite', deck: 'combat', glyph: '⟲',
    base: { cost: 0, energy: 2, draw: 1 },
    flavor: 'Root access to your own nervous system. Nobody should have this.',
  },

  // ---- Kessra (Glass Caves) ----
  resonant: {
    id: 'resonant', name: 'Resonant Strike', deck: 'combat', glyph: '≀',
    base: { cost: 1, damage: 5, chain: 1 },
    flavor: 'Hit it twice. The cave hits it a third time.',
  },
  shatter: {
    id: 'shatter', name: 'Shatter', deck: 'combat', glyph: '✧',
    base: { cost: 2, damage: 2, shatter: 2 },
    flavor: 'The harder the shell, the louder it breaks.',
  },
  crystalskin: {
    id: 'crystalskin', name: 'Crystal Skin', deck: 'combat', glyph: '◇',
    base: { cost: 1, block: 6, retain: true },
    flavor: 'It grows over the wound and does not leave.',
  },
  splitlens: {
    id: 'splitlens', name: 'Split Lens', deck: 'combat', glyph: '⟁',
    base: { cost: 1, damage: 3, aoe: true, swarm: 1 },
    flavor: 'One beam in. Many beams out.',
  },
  echoscar: {
    id: 'echoscar', name: 'Echo Scar', deck: 'combat', glyph: '≋',
    base: { cost: 1, damage: 4 },
    rules: ['When Resonance plays it twice: Imprint +1 damage on it and every Resonant Strike.'],
    brief: 'Resonance: +1 forever.',
    flavor: 'The cave repeats you. Each echo is cut a little deeper.',
  },

  // ---- Survey deck ----
  override: {
    id: 'override', name: 'Override', deck: 'survey', action: 'override', glyph: '⌬',
    base: { cost: 1 },
    flavor: 'Old codes. They still answer to your voice.',
  },
  cutter: {
    id: 'cutter', name: 'Plasma Cutter', deck: 'survey', action: 'cut', glyph: '⟋',
    base: { cost: 1 },
    flavor: 'Through wreckage. Through anything.',
  },
  scan: {
    id: 'scan', name: 'Echo Scan', deck: 'survey', action: 'scan', glyph: '◎',
    base: { cost: 1 },
    flavor: 'Ping the dark. Something pings back.',
  },
  pry: {
    id: 'pry', name: 'Pry Bar', deck: 'survey', action: 'pry', glyph: '⌙',
    base: { cost: 1 },
    flavor: 'Supply lockers. Some still hold supplies.',
  },
  stim: {
    id: 'stim', name: 'Suture Gel', deck: 'survey', action: 'stim', glyph: '✚',
    base: { cost: 2, heal: 6 },
    flavor: 'Seals the tissue. Mostly.',
  },
  flare: {
    id: 'flare', name: 'Flare', deck: 'survey', action: 'flare', glyph: '✶',
    base: { cost: 1, exposed: 1 },
    flavor: 'Red light. Things in it flinch.',
  },
  dressing: {
    id: 'dressing', name: 'Field Dressing', deck: 'survey', glyph: '✚',
    base: { cost: 0, heal: 2 }, keywords: ['consume'],
    flavor: 'Gauze from a locker. The expiry date is a century ago.',
  },
  knitter: {
    id: 'knitter', name: 'Flesh Knitter', deck: 'survey', glyph: '✚',
    base: { cost: 0, heal: 6, bioCost: 3 }, keywords: ['consume'],
    flavor: 'A handheld printer. Feed it biomass, and it prints you back.',
  },
  notes: {
    id: 'notes', name: 'Field Notes', deck: 'survey', action: 'notes', glyph: '✎',
    base: { cost: 1 },
    rules: ['For each hidden thing it reveals: Imprint +1 damage on a random tactic.'],
    brief: 'Each find: +1 dmg to a tactic.',
    flavor: 'Write down what you find. The next print will read it.',
  },
  beacon: {
    id: 'beacon', name: 'Beacon', deck: 'survey', glyph: '◈',
    base: { cost: 1, draw: 1, biomass: 1 },
    flavor: 'A pulse into the dark. Something always answers.',
  },
};

export const STARTER_COMBAT = ['scalpel', 'scalpel', 'scalpel', 'scalpel', 'brace', 'brace', 'harpoon', 'flense'];
export const STARTER_SURVEY = ['override', 'override', 'cutter', 'cutter', 'scan', 'pry', 'stim'];
export const REWARD_COMBAT = [
  'scatter', 'spike', 'bonesaw', 'adrenal', 'echo', 'hook', 'flense', 'harpoon', 'graft', 'jack', 'siphon',
  'clot', 'clot', 'poultice', 'poultice', 'knit', 'triage', 'triage',
  'needle', 'unscarred', 'scartissue', 'feeding', 'callus', 'donor', 'sibling', 'cannibal', 'flask', 'hunger', 'grief',
];
/** Cards that only come from secret rooms. */
export const SECRET_CARDS = ['apex', 'lazarus', 'overwrite'];
export const REWARD_SURVEY = ['flare', 'scan', 'stim', 'pry', 'override', 'cutter', 'beacon', 'notes', 'dressing', 'dressing', 'knitter'];

// ---- Genes: how cards evolve ----

export interface Gene {
  id: string;
  name: string;
  prefix: string;
  deck: DeckKind | 'any';
  cost: number;
  text: string;
  canApply: (s: CardStats, def: CardDef) => boolean;
  apply: (s: CardStats) => void;
  /** A defect: only ever arrives from an Unstable mutation, never offered at a pod. */
  defect?: boolean;
  /** Elite mutation: rare at pods, strong, and always with a drawback. */
  elite?: boolean;
  /** The drawback, shown in red. */
  drawback?: string;
  /** Maximum integrity paid when spliced. */
  maxHpCost?: number;
  /** Rules text for a triggered effect the stat lines cannot express. */
  rule?: string;
}

export const GENES: Record<string, Gene> = {
  serrated: {
    id: 'serrated', name: 'Serrated', prefix: 'Serrated', deck: 'combat', cost: 4,
    text: '+3 damage', canApply: (s) => s.damage > 0, apply: (s) => { s.damage += 3; },
  },
  twin: {
    id: 'twin', name: 'Twinned', prefix: 'Twinned', deck: 'combat', cost: 7,
    text: '+1 hit', canApply: (s) => s.damage > 0 && s.hits < 4, apply: (s) => { s.hits += 1; },
  },
  reflex: {
    id: 'reflex', name: 'Reflex', prefix: 'Twitching', deck: 'any', cost: 6,
    text: '−1 cost', canApply: (s) => s.cost > 0, apply: (s) => { s.cost -= 1; },
  },
  chitin: {
    id: 'chitin', name: 'Chitin', prefix: 'Chitinous', deck: 'combat', cost: 4,
    text: '+4 plating', canApply: () => true, apply: (s) => { s.block += 4; },
  },
  marker: {
    id: 'marker', name: 'Marker', prefix: 'Branding', deck: 'combat', cost: 3,
    text: 'Tag +1', canApply: (s) => s.damage > 0, apply: (s) => { s.tag += 1; },
  },
  neurotoxin: {
    id: 'neurotoxin', name: 'Neurotoxin', prefix: 'Numbing', deck: 'combat', cost: 4,
    text: 'Weaken +1', canApply: (s) => s.damage > 0, apply: (s) => { s.weak += 1; },
  },
  corrosive: {
    id: 'corrosive', name: 'Corrosive', prefix: 'Weeping', deck: 'combat', cost: 4,
    text: 'Expose +1', canApply: (s) => s.damage > 0, apply: (s) => { s.exposed += 1; },
  },
  echoing: {
    id: 'echoing', name: 'Echoing', prefix: 'Echoing', deck: 'any', cost: 5,
    text: 'Draw +1', canApply: () => true, apply: (s) => { s.draw += 1; },
  },
  spread: {
    id: 'spread', name: 'Shrapnel', prefix: 'Bursting', deck: 'combat', cost: 8,
    text: 'Hits ALL enemies', canApply: (s) => s.damage > 0 && !s.aoe, apply: (s) => { s.aoe = true; },
  },
  mending: {
    id: 'mending', name: 'Mending', prefix: 'Mending', deck: 'survey', cost: 3,
    text: 'Also heal 3', canApply: () => true, apply: (s) => { s.heal += 3; },
  },
  scavenger: {
    id: 'scavenger', name: 'Scavenger', prefix: 'Scavenging', deck: 'survey', cost: 3,
    text: 'Also +2 biomass', canApply: () => true, apply: (s) => { s.biomass += 2; },
  },
  overclock: {
    id: 'overclock', name: 'Overclock', prefix: 'Overclocked', deck: 'combat', cost: 6,
    text: 'On hit, empower another card +2', canApply: (s) => s.damage > 0, apply: (s) => { s.empower += 2; },
  },
  faceted: {
    id: 'faceted', name: 'Faceted', prefix: 'Faceted', deck: 'combat', cost: 6,
    text: '+1 hit, −2 damage', canApply: (s) => s.damage >= 4 && s.hits < 4,
    apply: (s) => { s.hits += 1; s.damage -= 2; },
  },
  clotting: {
    id: 'clotting', name: 'Clotting', prefix: 'Clotting', deck: 'any', cost: 4,
    text: '+2 heal', canApply: (s) => s.heal > 0, apply: (s) => { s.heal += 2; },
  },
  frugal: {
    id: 'frugal', name: 'Frugal', prefix: 'Frugal', deck: 'any', cost: 5,
    text: '−1 biomass price', canApply: (s) => s.bioCost > 0, apply: (s) => { s.bioCost -= 1; },
  },
  triagegene: {
    id: 'triagegene', name: 'Triage', prefix: 'Triaging', deck: 'combat', cost: 5,
    text: 'Tagged deaths this fight print a Clot Patch', canApply: (s) => s.tag > 0, apply: (s) => { s.triage += 1; },
  },
  // ---- Elite mutations: rare, strong, with a price ----
  mirror: {
    id: 'mirror', name: 'Mirror Neurons', prefix: 'Mirroring', deck: 'combat', cost: 14, elite: true,
    text: 'Learns from your other attacks', rule: 'While in hand: each hit by another card, +1 damage this fight.',
    drawback: '+1 cost', canApply: (s) => s.damage > 0, apply: (s) => { s.cost += 1; },
  },
  bloodlust: {
    id: 'bloodlust', name: 'Bloodlust', prefix: 'Frenzied', deck: 'combat', cost: 12, elite: true, maxHpCost: 5,
    text: 'Feeds on every death', rule: 'While in hand: each enemy death, +3 damage this fight.',
    drawback: '−5 max integrity when spliced', canApply: (s) => s.damage > 0, apply: () => {},
  },
  painengine: {
    id: 'painengine', name: 'Pain Engine', prefix: 'Agonized', deck: 'combat', cost: 12, elite: true,
    text: 'Hurts into power', rule: 'While in hand: each time you lose integrity, +2 damage this fight.',
    drawback: 'costs 1 biomass to play', canApply: (s) => s.damage > 0, apply: (s) => { s.bioCost += 1; },
  },
  hiveshell: {
    id: 'hiveshell', name: 'Hive Shell', prefix: 'Hived', deck: 'combat', cost: 12, elite: true,
    text: 'Thickens as you act', rule: 'While in hand: each other card you play, +1 plating this fight.',
    drawback: '+1 cost', canApply: (s) => s.block > 0, apply: (s) => { s.cost += 1; },
  },
  parasite: {
    id: 'parasite', name: 'Parasite', prefix: 'Parasitic', deck: 'combat', cost: 13, elite: true,
    text: 'Heal 1 per hit that lands', drawback: '−2 damage',
    canApply: (s) => s.damage > 2, apply: (s) => { s.lifesteal += 1; s.damage -= 2; },
  },
  glassmarrow: {
    id: 'glassmarrow', name: 'Glass Marrow', prefix: 'Glass', deck: 'combat', cost: 10, elite: true,
    text: '+7 damage', drawback: 'lose 2 integrity per play',
    canApply: (s) => s.damage > 0, apply: (s) => { s.damage += 7; s.selfHarm += 2; },
  },
  brittle: {
    id: 'brittle', name: 'Brittle', prefix: 'Brittle', deck: 'combat', cost: 0, defect: true,
    text: '−2 damage (defect)', canApply: (s) => s.damage > 0, apply: (s) => { s.damage -= 2; },
  },
  sluggish: {
    id: 'sluggish', name: 'Sluggish', prefix: 'Sluggish', deck: 'any', cost: 0, defect: true,
    text: '+1 cost (defect)', canApply: () => true, apply: (s) => { s.cost += 1; },
  },
  leech: {
    id: 'leech', name: 'Leech', prefix: 'Leeching', deck: 'combat', cost: 5,
    text: '+25% damage dealt as biomass', canApply: (s) => s.damage > 0, apply: (s) => { s.drain += 25; },
  },
};

export function cardDef(card: CardInstance): CardDef {
  const def = CARDS[card.defId];
  if (!def) throw new Error(`Unknown card ${card.defId}`);
  return def;
}

export function cardStats(card: CardInstance): CardStats {
  const s: CardStats = { ...EMPTY, ...cardDef(card).base };
  for (const g of card.genes) GENES[g].apply(s);
  const im = card.imprint;
  if (im) {
    s.damage += im.damage ?? 0;
    s.block += im.block ?? 0;
    s.tag += im.tag ?? 0;
  }
  s.damage = Math.max(0, s.damage);
  s.block = Math.max(0, s.block);
  s.cost = Math.max(0, s.cost);
  s.bioCost = Math.max(0, s.bioCost);
  return s;
}

export function cardLevel(card: CardInstance): number {
  return card.genes.length;
}

export function cardName(card: CardInstance): string {
  const def = cardDef(card);
  if (card.genes.length === 0) return def.name;
  const last = GENES[card.genes[card.genes.length - 1]];
  return `${last.prefix} ${def.name}`;
}

/** Biomass price to splice a gene into a card. Grows with the card's level. */
export function spliceCost(card: CardInstance, geneId: string): number {
  return Math.round(GENES[geneId].cost * 1.5) + 3 * cardLevel(card);
}

export function genesFor(card: CardInstance): Gene[] {
  const def = cardDef(card);
  const s = cardStats(card);
  return Object.values(GENES).filter(
    (g) => !g.defect && !g.elite && (g.deck === 'any' || g.deck === def.deck) && g.canApply(s, def),
  );
}

/** Elite mutations that could bond with this card. */
export function eliteGenesFor(card: CardInstance): Gene[] {
  const def = cardDef(card);
  const s = cardStats(card);
  return Object.values(GENES).filter((g) => g.elite && (g.deck === 'any' || g.deck === def.deck) && g.canApply(s, def));
}

/** Genes an Unstable mutation can land: good ones and defects, both filtered to fit the card. */
export function mutationsFor(card: CardInstance, printed?: CardStats): { good: Gene[]; bad: Gene[] } {
  const def = cardDef(card);
  const s = printed ?? cardStats(card);
  const fits = (g: Gene) => (g.deck === 'any' || g.deck === def.deck) && g.canApply(s, def);
  const all = Object.values(GENES).filter((g) => !g.elite && fits(g));
  return { good: all.filter((g) => !g.defect), bad: all.filter((g) => g.defect) };
}

/** Total of a card's Imprints, for display: e.g. { damage: 6, block: 0, tag: 1 }. */
export function imprintTotal(card: CardInstance): number {
  const im = card.imprint;
  if (!im) return 0;
  return Math.abs(im.damage ?? 0) + Math.abs(im.block ?? 0) + Math.abs(im.tag ?? 0);
}

/** Add to one Imprint stat on a card (no cap, can go negative). */
export function addImprint(card: CardInstance, stat: ImprintStat, n: number) {
  card.imprint = { ...card.imprint, [stat]: (card.imprint?.[stat] ?? 0) + n };
  card.mem = { ...card.mem, imprints: (card.mem?.imprints ?? 0) + 1 };
}

export function splice(card: CardInstance, geneId: string): CardInstance {
  const gene = GENES[geneId];
  if (!gene) throw new Error(`Unknown gene ${geneId}`);
  const def = cardDef(card);
  if (!(gene.deck === 'any' || gene.deck === def.deck) || !gene.canApply(cardStats(card), def)) {
    throw new Error(`Gene ${geneId} cannot bond with ${def.id}`);
  }
  return { ...card, genes: [...card.genes, geneId] };
}

const ACTION_TEXT: Record<string, string> = {
  override: 'Open a hatch ahead.',
  cut: 'Cut wreckage ahead.',
  scan: 'Reveal and light 3 ahead.',
  pry: 'Open a locker.',
  stim: '',
  flare: 'Light 2 ahead.',
  notes: 'Reveal and light 3 ahead.',
};

const KEYWORD_TEXT: Record<string, string> = {
  hold: 'Hold.', sibling: 'Sibling.', unstable: 'Unstable.', consume: '',
};

/**
 * Card rules text, generated from its current stats. Pass `statsOverride`
 * to describe a temporarily-buffed version (e.g. mid-fight, after Empower).
 */
export function cardText(card: CardInstance, statsOverride?: CardStats, brief = false): string[] {
  const def = cardDef(card);
  const s = statsOverride ?? cardStats(card);
  const lines: string[] = [];
  for (const k of def.keywords ?? []) if (KEYWORD_TEXT[k]) lines.push(KEYWORD_TEXT[k]);
  if (def.action && ACTION_TEXT[def.action]) lines.push(ACTION_TEXT[def.action]);
  if (s.damage > 0) {
    const hits = s.hits > 1 ? ` ×${s.hits}` : '';
    lines.push(`Deal ${s.damage}${hits}${s.aoe ? ' to ALL' : ''}.`);
  }
  if (s.shatter > 0) lines.push(`+${s.shatter}× target's plating, then strip it.`);
  if (s.chain > 0) lines.push(`+${s.chain} hit if your last card was an attack.`);
  if (s.swarm > 0) lines.push(`+${s.swarm} hit if 2+ enemies.`);
  if (s.block > 0) lines.push(s.retain ? `Plate ${s.block}. It lasts into next turn.` : `Plate ${s.block}.`);
  if (s.tag > 0) lines.push(`Tag ${s.tag}.`);
  if (s.weak > 0) lines.push(`Weaken ${s.weak}.`);
  if (s.exposed > 0) lines.push(def.deck === 'survey' ? `Foes there: Expose ${s.exposed}.` : `Expose ${s.exposed}.`);
  if (s.energy > 0) lines.push(`+${s.energy} Energy.`);
  if (s.draw > 0) lines.push(`Draw ${s.draw}.`);
  if (s.heal > 0) lines.push(`Heal ${s.heal}.`);
  if (s.lifesteal > 0) lines.push(`Heal ${s.lifesteal} per hit.`);
  if (s.selfHarm > 0) lines.push(`Lose ${s.selfHarm} integrity.`);
  for (const gid of new Set(card.genes)) {
    const r = GENES[gid]?.rule;
    if (r) lines.push(brief ? r.replace('While in hand: each', 'In hand:').replace(' this fight', '') : r);
  }
  if (s.bioCost > 0 && !brief) lines.push(`Costs ${s.bioCost} biomass.`);
  if (s.triage > 0) {
    lines.push(brief
      ? `Tagged deaths: +${s.triage} Clot Patch.`
      : `This fight: each tagged enemy that dies prints ${s.triage > 1 ? `${s.triage} Clot Patches` : 'a Clot Patch'} into your hand.`);
  }
  if (s.biomass > 0) lines.push(`+${s.biomass} biomass.`);
  if (s.empower > 0) lines.push(`On hit, choose a card in hand: +${s.empower} damage, this fight.`);
  if (s.drain > 0) lines.push(s.drain >= 100 ? 'Gain biomass equal to damage dealt.' : `Gain biomass equal to ${s.drain}% of damage dealt.`);
  if (brief && def.brief) lines.push(def.brief);
  else lines.push(...(def.rules ?? []));
  if (def.id === 'donor') lines.push(`Doses left: ${3 - (card.mem?.doses ?? 0)}.`);
  return lines;
}

/** Does this combat card need the player to pick one enemy? */
export function needsTarget(card: CardInstance): boolean {
  const s = cardStats(card);
  const def = cardDef(card);
  return def.deck === 'combat' && !s.aoe && (s.damage > 0 || s.tag > 0 || s.weak > 0 || s.exposed > 0);
}
