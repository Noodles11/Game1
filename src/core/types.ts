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
  line?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  biomass: number;
  pattern: Intent[];
  flavor: string;
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
}

export type FeatureKind = 'none' | 'door' | 'debris' | 'crate' | 'pod' | 'enemies' | 'exit';

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
  /** Set on a sector's final fight. Winning it offers a run modifier. */
  sectorBoss?: number;
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
