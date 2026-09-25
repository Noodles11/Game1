import type { Aim, Limb } from './body';

export type DeckKind = 'combat' | 'survey';

export type SurveyAction = 'override' | 'cut' | 'scan' | 'pry' | 'stim' | 'flare' | 'notes';

/**
 * hold: stays in hand at end of turn (takes a draw slot).
 * sibling: every Imprint on one copy lands on all copies.
 * unstable: its result can be a defect.
 * consume: removes a card from the deck for the rest of the run.
 */
export type Keyword = 'hold' | 'sibling' | 'unstable' | 'consume';

/** Stats a pod mutation (or a surgery) can change. */
export type MutStat = 'damage' | 'block' | 'hits' | 'cost' | 'tag' | 'heal' | 'draw' | 'lifesteal' | 'bioCost';

/** Stats an Imprint can change. */
export type ImprintStat = 'damage' | 'block' | 'tag';

/** Every number a card can carry. Genes modify these; the text is generated from them. */
export interface CardStats {
  cost: number;
  damage: number;
  hits: number;
  aoe: boolean;
  block: number;
  draw: number;
  energy: number;
  tag: number;
  weak: number;
  exposed: number;
  heal: number;
  biomass: number;
  /** On hit, let the player choose another card in hand to gain +N damage for the rest of the fight. */
  empower: number;
  /** Percent (0-100) of damage this card deals that also becomes biomass, immediately. */
  drain: number;
  /** Extra hits if the previous card played this turn was an attack. */
  chain: number;
  /** Adds target's plating × this to the first hit, then strips that plating. */
  shatter: number;
  /** This card's plating survives into your next turn. */
  retain: boolean;
  /** Extra hits while 2+ enemies are alive. */
  swarm: number;
  /** Biomass paid each time the card is played. */
  bioCost: number;
  /** This fight: each tagged enemy that dies prints this many Clot Patches into your hand. */
  triage: number;
  /** Heal this much per hit that lands. */
  lifesteal: number;
  /** Integrity lost (through plating) each time the card is played. */
  selfHarm: number;
}

export interface CardDef {
  id: string;
  name: string;
  deck: DeckKind;
  base: Partial<CardStats>;
  action?: SurveyAction;
  flavor: string;
  glyph: string;
  keywords?: Keyword[];
  /** Rules text for effects the stat lines cannot express. */
  rules?: string[];
  /** Short form of the rules, for small cards in hand. */
  brief?: string;
}

export interface CardInstance {
  uid: number;
  defId: string;
  genes: string[];
  /** Imprints: permanent, uncapped stat changes earned in play. */
  imprint?: Partial<Record<ImprintStat, number>>;
  /** Printed mid-fight: never part of the deck, gone when the fight ends. */
  temp?: boolean;
  /** Pod mutations: permanent stat changes bought with biomass. */
  mut?: Partial<Record<MutStat, number>>;
  /** Name prefix from the latest mutation. */
  prefix?: string;
  /** Elite genes whose drawback was cut out at a surgery bay. */
  purged?: string[];
  /** Per-card counters that drive Imprints (clean turns, health drawn, doses used, imprint count). */
  mem?: Record<string, number>;
}

export interface Statuses {
  weak: number;
  exposed: number;
  tagged: number;
  strength: number;
}

export interface Intent {
  label: string;
  attack?: number;
  hits?: number;
  block?: number;
  strength?: number;
  weak?: number;
  exposed?: number;
  /** Strength given to every other living enemy. */
  allyStrength?: number;
  /** Enemy id to spawn beside this one. */
  summon?: string;
  line?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  biomass: number;
  pattern: Intent[];
  flavor: string;
  /** Splits into two half-HP copies on its first death. */
  splits?: boolean;
  /** While plated, reflects this share of incoming damage back at you. */
  reflect?: number;
  /** Which part of the clone it goes for. Default: anywhere. */
  aim?: Aim;
  /** Swaps to a harsher pattern once HP drops to `below` of max. */
  phase2?: { below: number; pattern: Intent[]; line?: string };
}

export interface EnemyState {
  uid: number;
  defId: string;
  hp: number;
  maxHp: number;
  block: number;
  status: Statuses;
  intentIdx: number;
  alive: boolean;
  split?: boolean;
  phase2?: boolean;
  /** The limb its next attack will land on. Shown on its intent. */
  target?: Limb;
}

export type FeatureKind = 'none' | 'door' | 'debris' | 'crate' | 'pod' | 'surgery' | 'enemies' | 'event' | 'exit';

export interface Segment {
  feature: FeatureKind;
  encounter?: string[];
  dark: boolean;
  lit: boolean;
  revealed: boolean;
  cleared: boolean;
  whisper?: string;
  /** Exposed stacks enemies here start with (from Flare). */
  flareExposed?: number;
  /** Set on a sector's final fight. 1: offers a run modifier. 2: opens the mainframe. */
  sectorBoss?: number;
  /** A world's final fight. Winning it offers a permanent boon. */
  worldBoss?: boolean;
  /** An elite fight: richer rewards. */
  elite?: boolean;
  /** Event id, for 'event' segments. */
  eventId?: string;
  /** How the section is built. Tunnel is the default closed corridor. */
  shape?: SegmentShape;
  /** A hidden gateway in this section's wall. Only a clone with Gatesight sees it. */
  gate?: SecretKind;
  gateUsed?: boolean;
}

/**
 * Where a gateway leads.
 * reliquary: rare cards at a steep price. lair: an uncommon mob. vat: restores integrity. shortcut: skips ahead.
 */
export type SecretKind = 'reliquary' | 'lair' | 'vat' | 'shortcut';

/** tunnel: closed corridor. cavern: open, walls replaced by structures. window/vats: lab variants. */
export type SegmentShape = 'tunnel' | 'cavern' | 'window' | 'vats';

/** Permanent-for-the-run bonuses picked after a sector boss falls. */
export interface Modifiers {
  biomass: boolean;
  integrity: boolean;
  energy: boolean;
}

export interface Corpse {
  uid: number;
  defId: string;
  biomass: number;
  tagged: boolean;
  taken: boolean;
}

export type NodeKind = 'fight' | 'elite' | 'locker' | 'pod' | 'event' | 'boss';

export interface MapNode {
  id: number;
  row: number;
  col: number;
  kind: NodeKind;
  hidden: boolean;
  next: number[];
  visited: boolean;
  /** Exposed stacks its enemies start with (from Flare on the map). */
  flared: number;
}

export interface WorldMap {
  world: string;
  nodes: MapNode[];
  rows: number;
}

/** Permanent progress. Survives death and new runs. */
export interface Meta {
  /** Germline genes: permanent DNA rewrites earned from world bosses. */
  boons: string[];
  worldsCleared: string[];
  logs: string[];
  /** The last clone's most-imprinted tactic, for the Heirloom gene. */
  heirloom?: { defId: string; genes: string[]; imprint?: CardInstance['imprint'] };
}
