import type { CardDef, CardInstance, CardStats, DeckKind } from './types';

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
};

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
};

export const STARTER_COMBAT = ['scalpel', 'scalpel', 'scalpel', 'scalpel', 'brace', 'brace', 'harpoon', 'flense'];
export const STARTER_SURVEY = ['override', 'override', 'cutter', 'cutter', 'scan', 'pry', 'stim'];
export const REWARD_COMBAT = ['scatter', 'spike', 'bonesaw', 'adrenal', 'echo', 'hook', 'flense', 'harpoon'];
export const REWARD_SURVEY = ['flare', 'scan', 'stim', 'pry', 'override', 'cutter'];

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
};

export function cardDef(card: CardInstance): CardDef {
  const def = CARDS[card.defId];
  if (!def) throw new Error(`Unknown card ${card.defId}`);
  return def;
}

export function cardStats(card: CardInstance): CardStats {
  const s: CardStats = { ...EMPTY, ...cardDef(card).base };
  for (const g of card.genes) GENES[g].apply(s);
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
  return GENES[geneId].cost + 2 * cardLevel(card);
}

export function genesFor(card: CardInstance): Gene[] {
  const def = cardDef(card);
  const s = cardStats(card);
  return Object.values(GENES).filter(
    (g) => (g.deck === 'any' || g.deck === def.deck) && g.canApply(s, def),
  );
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
};

/** Card rules text, generated from its current stats. */
export function cardText(card: CardInstance): string[] {
  const def = cardDef(card);
  const s = cardStats(card);
  const lines: string[] = [];
  if (def.action && ACTION_TEXT[def.action]) lines.push(ACTION_TEXT[def.action]);
  if (s.damage > 0) {
    const hits = s.hits > 1 ? ` ×${s.hits}` : '';
    lines.push(`Deal ${s.damage}${hits}${s.aoe ? ' to ALL' : ''}.`);
  }
  if (s.block > 0) lines.push(`Plate ${s.block}.`);
  if (s.tag > 0) lines.push(`Tag ${s.tag}.`);
  if (s.weak > 0) lines.push(`Weaken ${s.weak}.`);
  if (s.exposed > 0) lines.push(def.deck === 'survey' ? `Foes there: Expose ${s.exposed}.` : `Expose ${s.exposed}.`);
  if (s.energy > 0) lines.push(`+${s.energy} Energy.`);
  if (s.draw > 0) lines.push(`Draw ${s.draw}.`);
  if (s.heal > 0) lines.push(`Heal ${s.heal}.`);
  if (s.biomass > 0) lines.push(`+${s.biomass} biomass.`);
  return lines;
}

/** Does this combat card need the player to pick one enemy? */
export function needsTarget(card: CardInstance): boolean {
  const s = cardStats(card);
  const def = cardDef(card);
  return def.deck === 'combat' && !s.aoe && (s.damage > 0 || s.tag > 0 || s.weak > 0 || s.exposed > 0);
}
