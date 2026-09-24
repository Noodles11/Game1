export type DeckKind = 'combat' | 'survey';

export type SurveyAction = 'override' | 'cut' | 'scan' | 'pry' | 'stim' | 'flare';

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
}

export interface CardDef {
  id: string;
  name: string;
  deck: DeckKind;
  base: Partial<CardStats>;
  action?: SurveyAction;
  flavor: string;
  glyph: string;
}

export interface CardInstance {
  uid: number;
  defId: string;
  genes: string[];
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
}

export type FeatureKind = 'none' | 'door' | 'debris' | 'crate' | 'pod' | 'enemies' | 'event' | 'exit';

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
}

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
  boons: string[];
  worldsCleared: string[];
  logs: string[];
}
