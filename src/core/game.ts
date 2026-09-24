import {
  REWARD_COMBAT, REWARD_SURVEY, STARTER_COMBAT, STARTER_SURVEY,
  addImprint, cardDef, cardStats, genesFor, mutationsFor, needsTarget, splice, spliceCost,
} from './cards';
import { ENEMIES } from './enemies';
import { Rng } from './rng';
import type {
  CardInstance, CardStats, Corpse, DeckKind, EnemyState, ImprintStat, Intent, MapNode, Meta, Modifiers, Segment, Statuses,
  WorldMap,
} from './types';
import { BOONS, EVENTS, LOGS, WORLDS, generateMap } from './worlds';

export type Phase =
  | 'explore' | 'combat' | 'harvest' | 'reward' | 'loot' | 'splice' | 'modifier'
  | 'mainframe' | 'map' | 'event' | 'boon' | 'dead' | 'won';

export const freshMeta = (): Meta => ({ boons: [], worldsCleared: [], logs: [] });

export type GameEvent =
  | { type: 'step' }
  | { type: 'bump' }
  | { type: 'enemyHit'; uid: number; amount: number; blocked: number }
  | { type: 'enemyDie'; uid: number }
  | { type: 'enemyAct'; uid: number }
  | { type: 'playerHit'; amount: number; blocked: number }
  | { type: 'heal'; amount: number }
  | { type: 'biomass'; amount: number }
  | { type: 'block'; amount: number }
  | { type: 'whisper'; text: string }
  | { type: 'line'; uid: number; text: string }
  | { type: 'reveal' }
  | { type: 'splice'; uid: number }
  | { type: 'empower'; uid: number; amount: number }
  | { type: 'warp' }
  | { type: 'resonate' }
  | { type: 'summon'; uid: number }
  | { type: 'reflect'; amount: number }
  | { type: 'imprint'; uid: number; stat: ImprintStat | 'gene'; amount: number; label: string }
  | { type: 'consumed'; uid: number; defId: string };

/** A card waiting for the player to choose another card in hand. */
export interface PendingPick {
  kind: 'donor' | 'flask' | 'cannibal';
  source: number;
  /** Resonance can resolve the source twice. */
  times: number;
}

export interface CombatState {
  enemies: EnemyState[];
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  energy: number;
  energyCap: number;
  turn: number;
  ambush: boolean;
  /** Extra damage granted to a card (by uid) via Empower, for the rest of this fight. */
  buffs: Map<number, number>;
  /** Set right after an Empower card hits. The player must pick a card in hand to receive it. */
  pendingEmpower: { amount: number } | null;
  playedThisTurn: number;
  playedThisFight: number;
  lastWasAttack: boolean;
  /** Unscarred Edge's clean-round bonus, by card uid. Wiped by a hit. */
  held: Map<number, number>;
  /** Integrity was lost since the last player turn began. */
  hurtRound: boolean;
  /** Callus cards whose plating is up this round. */
  platers: number[];
  /** Every card uid played this fight. */
  played: number[];
  pendingPick: PendingPick | null;
}

export interface Offer {
  defId: string;
  deck: DeckKind;
}

export const MAX_ENERGY = 3;
export const COMBAT_HAND = 5;
export const MAX_OXYGEN = 3;
export const SURVEY_HAND = 4;
export const FORCE_COST = 4;
const VIEW_RANGE = 4;
const SAVE_VERSION = 2;
const MAX_ENEMIES = 4;
const ELITE_BIOMASS = 6;

const freshStatus = (): Statuses => ({ weak: 0, exposed: 0, tagged: 0, strength: 0 });

const WHISPERS = [
  'The walls are warm. They should not be warm.',
  'Scratched into the panel: DON’T TRUST THE PRINTER.',
  'Your handwriting. You never wrote this.',
  'A heartbeat in the vents. Slower than yours.',
  'Somewhere ahead, someone hums your lullaby.',
  'Frost on the glass. Fingerprints on the inside.',
];

const SECTOR2_WHISPERS = [
  'Portholes, all of them starred with impact cracks. None of them broken through.',
  'A logbook, water-warped: WE ARE NOT ALONE ON THIS SHIP. WE NEVER WERE.',
  'The vats down here are older. The labels have worn to nothing.',
  'Gravity stutters for a second. Something heavy just shifted, deeper in.',
  'A viewport shows a moon that isn’t on any of the star charts.',
  'Your reflection in the glass blinks half a second after you do.',
];

export class Game {
  readonly rng: Rng;
  readonly cloneNo: number;
  hp = 42;
  maxHp = 42;
  biomass = 6;
  combatDeck: CardInstance[] = [];
  surveyDeck: CardInstance[] = [];
  segments: Segment[] = [];
  pos = 0;
  phase: Phase = 'explore';
  sector2Start: number;
  modifiers: Modifiers = { biomass: false, integrity: false, energy: false };

  /** Permanent progress, shared with the app and saved separately. */
  meta: Meta;
  /** Current alien world, or null while on the lab ship. */
  world: string | null = null;
  map: WorldMap | null = null;
  /** The map node the player is in or last left. */
  mapNode: number | null = null;
  eventId: string | null = null;
  eventResult: string | null = null;
  boonOffers: string[] = [];
  /** Plating kept into the next turn (Crystal Skin). */
  retainBlock = 0;

  // Survey (explore) piles
  sDraw: CardInstance[] = [];
  sHand: CardInstance[] = [];
  sDiscard: CardInstance[] = [];
  oxygen = MAX_OXYGEN;

  // Combat
  combat: CombatState | null = null;
  playerBlock = 0;
  playerStatus: Statuses = freshStatus();
  corpses: Corpse[] = [];

  // Rewards and splicing
  offers: Offer[] = [];
  podIndex = -1;
  private spliceOffers = new Map<number, string[]>();

  events: GameEvent[] = [];
  message = '';
  private nextUid = 1;

  constructor(seed: number, cloneNo = 1, meta: Meta = freshMeta()) {
    this.rng = new Rng(seed);
    this.cloneNo = cloneNo;
    this.meta = meta;
    this.combatDeck = STARTER_COMBAT.map((id) => this.makeCard(id));
    this.surveyDeck = STARTER_SURVEY.map((id) => this.makeCard(id));
    const sector1 = this.buildSector1();
    this.sector2Start = sector1.length;
    this.segments = [...sector1, ...this.buildSector2()];
    this.sDraw = this.rng.shuffle([...this.surveyDeck]);
    this.updateVisibility();
    this.newSurveyTurn();
    this.emit({ type: 'whisper', text: this.segments[0].whisper ?? '' });
  }

  // ------------------------------------------------------------------ setup

  private makeCard(defId: string): CardInstance {
    return { uid: this.nextUid++, defId, genes: [] };
  }

  private buildSector1(): Segment[] {
    const seg = (feature: Segment['feature'], extra: Partial<Segment> = {}): Segment => ({
      feature, dark: false, lit: false, revealed: false, cleared: false, ...extra,
    });
    const whispers = this.rng.sample(WHISPERS, 3);
    return [
      seg('none', { whisper: `PRINT COMPLETE. CLONE #${String(this.cloneNo).padStart(4, '0')}. Walk.` }),
      seg('crate', { shape: 'vats' }),
      seg('enemies', { encounter: ['tick', 'tick'], whisper: 'Clicking. Many small legs.' }),
      seg('debris', { whisper: whispers[0] }),
      seg('pod', { whisper: 'A splice pod. It still remembers how to rewrite you.' }),
      seg('door', { dark: true }),
      seg('enemies', { encounter: ['copy', 'husk'], dark: true, whisper: 'It has your face. Almost.' }),
      seg('crate', { whisper: whispers[1] }),
      seg('none', { whisper: whispers[2], shape: 'window' }),
      seg('pod', { whisper: 'Another pod. The liquid is the wrong color.' }),
      seg('door'),
      seg('enemies', { encounter: ['choir'], whisper: 'Singing. In your voice. In all of them.', sectorBoss: 1 }),
    ];
  }

  private buildSector2(): Segment[] {
    const seg = (feature: Segment['feature'], extra: Partial<Segment> = {}): Segment => ({
      feature, dark: false, lit: false, revealed: false, cleared: false, ...extra,
    });
    const whispers = this.rng.sample(SECTOR2_WHISPERS, 3);
    return [
      seg('none', { whisper: 'SECTOR 2. The air changes here. Something older breathes it.', shape: 'window' }),
      seg('crate'),
      seg('enemies', { encounter: ['drone'], whisper: 'A thin whine. Something small is hunting with radar, not eyes.' }),
      seg('debris', { whisper: whispers[0] }),
      seg('pod', { whisper: 'A pod down here still hums. Whatever is inside has waited a long time.' }),
      seg('door', { dark: true }),
      seg('enemies', { encounter: ['drone', 'bloom'], dark: true, whisper: 'Wet clicking, and under it, something enormous, breathing slow.' }),
      seg('crate', { whisper: whispers[1] }),
      seg('none', { whisper: whispers[2], shape: 'vats' }),
      seg('pod', { whisper: 'The last pod. The glass is fogged from the inside.' }),
      seg('door'),
      seg('enemies', { encounter: ['first'], whisper: 'A shape too large for the hall. It already knows your name.', sectorBoss: 2 }),
    ];
  }

  get sectorNum(): number {
    return this.pos < this.sector2Start ? 1 : 2;
  }

  /** Which art set to draw: the lab ship, or the current world. */
  get biome(): string {
    return this.world ?? 'lab';
  }

  hasBoon(id: string): boolean {
    return this.meta.boons.includes(id);
  }

  private emit(e: GameEvent) {
    this.events.push(e);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // -------------------------------------------------------------- explore

  get front(): Segment | undefined {
    return this.segments[this.pos + 1];
  }

  /** What stops the player from stepping forward, if anything. */
  blocker(): 'door' | 'debris' | null {
    const f = this.front;
    if (!f || f.cleared || !f.revealed) return null;
    if (f.feature === 'door' || f.feature === 'debris') return f.feature;
    return null;
  }

  private updateVisibility() {
    for (let i = this.pos; i < Math.min(this.segments.length, this.pos + VIEW_RANGE + 1); i++) {
      const s = this.segments[i];
      if (i === this.pos || !s.dark || s.lit) s.revealed = true;
    }
  }

  private newSurveyTurn() {
    this.sDiscard.push(...this.sHand);
    this.sHand = [];
    this.oxygen = MAX_OXYGEN;
    this.drawSurvey(SURVEY_HAND);
    this.message = this.exploreHint();
  }

  private drawSurvey(n: number) {
    for (let i = 0; i < n; i++) {
      if (this.sDraw.length === 0) {
        if (this.sDiscard.length === 0) return;
        this.sDraw = this.rng.shuffle(this.sDiscard);
        this.sDiscard = [];
      }
      this.sHand.push(this.sDraw.pop()!);
    }
  }

  exploreHint(): string {
    const f = this.front;
    if (!f) return '';
    if (!f.revealed) return 'Darkness ahead. Scan it, or walk in blind.';
    if (f.cleared) return 'The way is open.';
    switch (f.feature) {
      case 'door': return `Sealed hatch. Play Override, or force it (−${FORCE_COST} integrity).`;
      case 'debris': return `Wreckage. Play Plasma Cutter, or squeeze through (−${FORCE_COST}).`;
      case 'crate': return 'A supply locker. Pry it open, or walk past.';
      case 'pod': return 'A splice pod glows ahead. Tap it to evolve cards.';
      case 'enemies': return 'Something waits ahead. Advance to fight.';
      case 'exit': return this.world ? 'The way out. Walk on to return to the map.' : 'Light. Real light. Keep walking.';
      case 'event': return 'Something here is worth a look.';
      default: return 'The corridor goes on.';
    }
  }

  advance(): boolean {
    if (this.phase !== 'explore') return false;
    const f = this.front;
    if (!f) return false;
    if (!f.revealed && (f.feature === 'door' || f.feature === 'debris')) {
      f.revealed = true;
      this.emit({ type: 'bump' });
      this.message = `Something blocks the way. ${this.exploreHint()}`;
      return false;
    }
    if (this.blocker()) {
      this.emit({ type: 'bump' });
      this.message = this.exploreHint();
      return false;
    }
    this.pos++;
    this.emit({ type: 'step' });
    const here = this.segments[this.pos];
    here.revealed = true;
    this.updateVisibility();
    if (here.whisper) this.emit({ type: 'whisper', text: here.whisper });
    if (here.feature === 'enemies' && !here.cleared) {
      this.startCombat(here);
      return true;
    }
    if (here.feature === 'event' && !here.cleared && here.eventId) {
      this.startEvent(here.eventId);
      return true;
    }
    if (here.feature === 'exit') {
      if (this.world) this.completeNode();
      else this.phase = 'won';
      return true;
    }
    this.newSurveyTurn();
    return true;
  }

  force(): boolean {
    if (this.phase !== 'explore' || !this.blocker()) return false;
    this.front!.cleared = true;
    this.damagePlayerRaw(FORCE_COST);
    if (this.isDead) return true;
    this.message = 'You tear through. Something in your arm gives.';
    return true;
  }

  /** Interactable in front or underfoot (locker or pod). */
  private interactable(kind: 'crate' | 'pod'): number {
    for (const i of [this.pos + 1, this.pos]) {
      const s = this.segments[i];
      if (s && s.revealed && s.feature === kind && !s.cleared) return i;
    }
    return -1;
  }

  canUsePod(): boolean {
    return this.phase === 'explore' && this.interactable('pod') >= 0;
  }

  surveyPlayable(card: CardInstance): string | null {
    const s = cardStats(card);
    const def = cardDef(card);
    if (this.phase === 'map') {
      if (s.cost > this.oxygen) return 'Not enough oxygen.';
      switch (def.action) {
        case 'scan': case 'notes': return this.mapAhead(2).some((n) => n.hidden) ? null : 'Nothing hidden ahead.';
        case 'flare': return this.mapAhead(1).some((n) => n.kind === 'fight' || n.kind === 'elite') ? null : 'No fight ahead to light.';
        case 'stim': return this.hp < this.maxHp ? null : 'Integrity already full.';
        case 'override': case 'cut': case 'pry': return 'Nothing to use that on here.';
        default: return null;
      }
    }
    if (this.phase !== 'explore') return 'Not now.';
    if (s.cost > this.oxygen) return 'Not enough oxygen.';
    switch (def.action) {
      case 'override': return this.front?.revealed && this.front.feature === 'door' && !this.front.cleared ? null : 'No sealed hatch ahead.';
      case 'cut': return this.front?.revealed && this.front.feature === 'debris' && !this.front.cleared ? null : 'No wreckage ahead.';
      case 'pry': return this.interactable('crate') >= 0 ? null : 'No locker in reach.';
      case 'stim': return this.hp < this.maxHp ? null : 'Integrity already full.';
      default: return null;
    }
  }

  playSurvey(uid: number): boolean {
    const card = this.sHand.find((c) => c.uid === uid);
    if (!card) return false;
    const reason = this.surveyPlayable(card);
    if (reason) {
      this.message = reason;
      return false;
    }
    const s = cardStats(card);
    const def = cardDef(card);
    this.oxygen -= s.cost;
    this.sHand = this.sHand.filter((c) => c !== card);
    this.sDiscard.push(card);
    this.message = '';

    if (this.phase === 'map') {
      if (def.action === 'scan' || def.action === 'notes') {
        const found = this.mapAhead(2).filter((n) => n.hidden).length;
        for (const n of this.mapAhead(2)) n.hidden = false;
        this.message = 'The echo maps the caves ahead.';
        this.emit({ type: 'reveal' });
        if (def.action === 'notes') this.fieldNotes(found);
      } else if (def.action === 'flare') {
        for (const n of this.mapAhead(1)) if (n.kind === 'fight' || n.kind === 'elite') n.flared += s.exposed;
        this.message = 'Red light floods the next row. Whatever waits there will flinch.';
        this.emit({ type: 'reveal' });
      }
      if (s.heal > 0) this.healPlayer(s.heal);
      if (s.biomass > 0) this.gainBiomass(s.biomass);
      if (s.draw > 0) this.drawSurvey(s.draw);
      if (!this.message) this.message = 'Choose your path.';
      return true;
    }

    switch (def.action) {
      case 'override':
        this.front!.cleared = true;
        this.message = 'The hatch sighs open. The air behind it is stale and sweet.';
        break;
      case 'cut':
        this.front!.cleared = true;
        this.message = 'Metal glows, drips, parts.';
        break;
      case 'scan':
        this.light(3, 0);
        this.message = 'The echo returns. Shapes, ahead.';
        this.emit({ type: 'reveal' });
        break;
      case 'notes': {
        const ahead = this.segments.slice(this.pos + 1, this.pos + 4);
        const found = ahead.filter((x) => !x.revealed && x.feature !== 'none').length;
        this.light(3, 0);
        this.emit({ type: 'reveal' });
        this.fieldNotes(found);
        break;
      }
      case 'flare':
        this.light(2, s.exposed);
        this.message = 'Red light floods the corridor.';
        this.emit({ type: 'reveal' });
        break;
      case 'pry': {
        const i = this.interactable('crate');
        this.segments[i].cleared = true;
        this.openLoot();
        break;
      }
      default:
        break;
    }
    if (s.heal > 0) this.healPlayer(s.heal);
    if (s.biomass > 0) this.gainBiomass(s.biomass);
    if (s.draw > 0) this.drawSurvey(s.draw);
    if (this.phase === 'explore' && def.action !== 'override' && def.action !== 'cut' && !this.message) {
      this.message = this.exploreHint();
    }
    return true;
  }

  /** Field Notes: each hidden thing found teaches a random tactic +1 damage. */
  private fieldNotes(found: number) {
    const fighters = this.combatDeck.filter((c) => cardStats(c).damage > 0);
    for (let i = 0; i < found && fighters.length; i++) this.imprint(this.rng.pick(fighters), 'damage', 1);
    this.message = found
      ? `You write down ${found} thing${found > 1 ? 's' : ''} you should not have seen. Your tactics read it.`
      : 'Nothing new to write down. The page stays blank.';
  }

  private light(range: number, exposed: number) {
    for (let i = this.pos + 1; i <= this.pos + range && i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.lit = true;
      seg.revealed = true;
      if (exposed > 0) seg.flareExposed = (seg.flareExposed ?? 0) + exposed;
    }
  }

  // ----------------------------------------------------------------- loot

  /** Combat reward pool: the base pool plus the current world's cards. */
  private rewardPool(): string[] {
    return this.world ? [...REWARD_COMBAT, ...WORLDS[this.world].cards] : REWARD_COMBAT;
  }

  private openLoot() {
    const combat = this.rng.sample(this.rewardPool(), 2).map((defId) => ({ defId, deck: 'combat' as const }));
    const survey = { defId: this.rng.pick(REWARD_SURVEY), deck: 'survey' as const };
    this.offers = [...combat, survey];
    this.gainBiomass(3);
    this.phase = 'loot';
    this.message = 'Inside: 3 biomass, and something useful. Take one.';
  }

  takeOffer(index: number | null): void {
    if (this.phase !== 'loot' && this.phase !== 'reward') return;
    if (index !== null) {
      const offer = this.offers[index];
      const card = this.makeCard(offer.defId);
      // a new Sibling arrives already knowing what the others learned
      const kin = this.combatDeck.find((o) => o.defId === offer.defId && cardDef(o).keywords?.includes('sibling'));
      if (kin?.imprint) card.imprint = { ...kin.imprint };
      if (offer.deck === 'combat') this.combatDeck.push(card);
      else {
        this.surveyDeck.push(card);
        this.sDiscard.push(card);
      }
    }
    this.offers = [];
    const wasReward = this.phase === 'reward';
    const bossSeg = wasReward ? this.segments[this.pos] : undefined;
    if (bossSeg?.sectorBoss) {
      const which = bossSeg.sectorBoss;
      bossSeg.sectorBoss = undefined;
      this.phase = which === 2 ? 'mainframe' : 'modifier';
      this.message = '';
      return;
    }
    if (bossSeg?.worldBoss) {
      bossSeg.worldBoss = undefined;
      this.finishWorld();
      return;
    }
    this.phase = 'explore';
    if (wasReward) this.newSurveyTurn();
    else this.message = this.exploreHint();
  }

  /** Called once after a sector boss falls. Picks a run-long bonus. */
  chooseModifier(key: keyof Modifiers): void {
    if (this.phase !== 'modifier') return;
    this.modifiers[key] = true;
    if (key === 'integrity') {
      const bonus = 16;
      this.maxHp += bonus;
      this.hp = Math.min(this.maxHp, this.hp + bonus);
    }
    this.phase = 'explore';
    this.newSurveyTurn();
  }

  // ---------------------------------------------------------------- worlds

  /** Mainframe: pick a destination. The ship crash-lands there. */
  chooseWorld(id: string): boolean {
    const def = WORLDS[id];
    if (this.phase !== 'mainframe' || !def?.playable) return false;
    this.world = id;
    this.map = generateMap(this.rng, id);
    this.mapNode = null;
    this.segments = [];
    this.pos = 0;
    this.enterMap();
    this.emit({ type: 'whisper', text: def.crash });
    return true;
  }

  private enterMap() {
    this.phase = 'map';
    this.newSurveyTurn();
    this.message = 'The tunnel forks. Choose a passage. Echo Scan and Flare show what waits down them.';
  }

  get currentNode(): MapNode | null {
    if (!this.map || this.mapNode === null) return null;
    return this.map.nodes[this.mapNode];
  }

  /** Depth on the map, 0 before the first node. */
  get depth(): number {
    const n = this.currentNode;
    return n ? n.row + 1 : 0;
  }

  /** Nodes the player may travel to next. */
  reachable(): MapNode[] {
    if (!this.map) return [];
    const here = this.currentNode;
    if (!here) return this.map.nodes.filter((n) => n.row === 0);
    return here.next.map((id) => this.map!.nodes[id]);
  }

  /** The ways forward at a junction, left to right. */
  passages(): MapNode[] {
    return [...this.reachable()].sort((a, b) => a.col - b.col);
  }

  /** Nodes up to `rows` rows ahead of the player. */
  private mapAhead(rows: number): MapNode[] {
    if (!this.map) return [];
    const from = this.currentNode ? this.currentNode.row : -1;
    return this.map.nodes.filter((n) => n.row > from && n.row <= from + rows && n.kind !== 'boss');
  }

  /** Walk into a map node: it becomes a short corridor. */
  travel(nodeId: number): boolean {
    if (this.phase !== 'map' || !this.map) return false;
    const node = this.reachable().find((n) => n.id === nodeId);
    if (!node) return false;
    node.hidden = false;
    node.visited = true;
    this.mapNode = node.id;
    this.segments = this.buildNode(node);
    this.pos = 0;
    this.segments[0].revealed = true;
    this.updateVisibility();
    this.phase = 'explore';
    this.emit({ type: 'warp' });
    if (this.segments[0].whisper) this.emit({ type: 'whisper', text: this.segments[0].whisper });
    this.newSurveyTurn();
    return true;
  }

  private buildNode(node: MapNode): Segment[] {
    const w = WORLDS[this.world!];
    const seg = (feature: Segment['feature'], extra: Partial<Segment> = {}): Segment => ({
      feature, dark: false, lit: false, revealed: false, cleared: false, ...extra,
    });
    const open = (p: number): Partial<Segment> => (this.rng.next() < p ? { shape: 'cavern' } : {});
    const entry = seg('none', { whisper: this.rng.pick(w.whispers), ...open(0.5) });
    const exit = seg('exit');
    const flare = node.flared || undefined;
    switch (node.kind) {
      case 'fight': {
        const pool = node.row < 3 ? w.fightsEarly : w.fightsLate;
        const fight = seg('enemies', { encounter: [...this.rng.pick(pool)], dark: this.rng.next() < 0.3, flareExposed: flare, ...open(0.55) });
        const roll = this.rng.next();
        const obstacle = roll < 0.25 ? [seg('door')] : roll < 0.45 ? [seg('debris')] : [];
        return [entry, ...obstacle, fight, exit];
      }
      case 'elite':
        return [entry, seg('enemies', { encounter: [...this.rng.pick(w.elites)], elite: true, flareExposed: flare, whisper: 'Something bigger. It has been waiting for you.', ...open(0.6) }), exit];
      case 'locker':
        return [entry, seg('crate', open(0.6)), exit];
      case 'pod':
        return [entry, seg('pod', { whisper: 'A splice pod, grown over with crystal. It still works.', ...open(0.6) }), exit];
      case 'event': {
        const unseen = w.events.filter((id) => !this.segmentsSeenEvent(id));
        const id = this.rng.pick(unseen.length ? unseen : w.events);
        this.seenEvents.push(id);
        return [entry, seg('event', { eventId: id, ...open(0.7) }), exit];
      }
      case 'boss':
      default:
        return [
          seg('none', { whisper: w.bossWhisper }),
          seg('enemies', { encounter: [w.boss], worldBoss: true, shape: 'cavern' }),
          exit,
        ];
    }
  }

  /** Events already rolled this run, so a world does not repeat itself. */
  seenEvents: string[] = [];

  private segmentsSeenEvent(id: string): boolean {
    return this.seenEvents.includes(id);
  }

  /** Walked off the end of a node's corridor. */
  private completeNode() {
    this.segments = [];
    this.pos = 0;
    this.emit({ type: 'warp' });
    this.enterMap();
  }

  // ---------------------------------------------------------------- events

  private startEvent(id: string) {
    const ev = EVENTS[id];
    this.eventId = id;
    this.eventResult = null;
    this.phase = 'event';
    if (!this.meta.logs.includes(ev.log)) this.meta.logs.push(ev.log);
  }

  chooseEventOption(index: number): boolean {
    if (this.phase !== 'event' || !this.eventId || this.eventResult !== null) return false;
    const opt = EVENTS[this.eventId].options[index];
    if (!opt) return false;
    const e = opt.effect;
    if (e.maxHp) this.maxHp += e.maxHp;
    if (e.heal) this.healPlayer(e.heal);
    if (e.biomass) this.gainBiomass(e.biomass);
    if (e.card) this.combatDeck.push(this.makeCard(e.card));
    if (e.worldCard && this.world) this.combatDeck.push(this.makeCard(this.rng.pick(WORLDS[this.world].cards)));
    if (e.hp) this.damagePlayerRaw(-e.hp);
    this.eventResult = opt.result;
    return true;
  }

  leaveEvent(): void {
    if (this.phase !== 'event' || this.isDead) return;
    this.segments[this.pos].cleared = true;
    this.eventId = null;
    this.eventResult = null;
    this.phase = 'explore';
    this.newSurveyTurn();
  }

  // ---------------------------------------------------------------- boons

  private finishWorld() {
    const w = WORLDS[this.world!];
    if (!this.meta.worldsCleared.includes(w.id)) this.meta.worldsCleared.push(w.id);
    if (!this.meta.logs.includes(w.bossLog)) this.meta.logs.push(w.bossLog);
    this.boonOffers = w.boons.filter((b) => !this.hasBoon(b));
    this.phase = this.boonOffers.length ? 'boon' : 'won';
  }

  chooseBoon(id: string): boolean {
    if (this.phase !== 'boon' || !this.boonOffers.includes(id)) return false;
    this.meta.boons.push(id);
    this.boonOffers = [];
    this.phase = 'won';
    return true;
  }

  logText(id: string): string {
    return LOGS[id] ?? '';
  }

  boon(id: string) {
    return BOONS[id];
  }

  // ----------------------------------------------------------------- pods

  usePod(): boolean {
    const i = this.interactable('pod');
    if (this.phase !== 'explore' || i < 0) return false;
    this.podIndex = i;
    this.spliceOffers.clear();
    this.phase = 'splice';
    return true;
  }

  /** Up to 3 genes this pod offers for a given card. Stable for the visit. */
  offersFor(uid: number): string[] {
    const card = this.findCard(uid);
    if (!card) return [];
    const cached = this.spliceOffers.get(uid);
    const valid = new Set(genesFor(card).map((g) => g.id));
    if (cached && cached.every((g) => valid.has(g))) return cached;
    const picks = this.rng.sample([...valid], 3);
    this.spliceOffers.set(uid, picks);
    return picks;
  }

  spliceCard(uid: number, geneId: string): boolean {
    if (this.phase !== 'splice') return false;
    const card = this.findCard(uid);
    if (!card) return false;
    const cost = spliceCost(card, geneId);
    if (cost > this.biomass) {
      this.message = 'Not enough biomass.';
      return false;
    }
    card.genes = splice(card, geneId).genes;
    this.biomass -= cost;
    this.spliceOffers.delete(uid);
    this.emit({ type: 'splice', uid });
    return true;
  }

  leavePod(): void {
    if (this.phase !== 'splice') return;
    this.segments[this.podIndex].cleared = true;
    this.podIndex = -1;
    this.phase = 'explore';
    this.message = 'The pod drains. It will not wake again.';
  }

  findCard(uid: number): CardInstance | undefined {
    return this.combatDeck.find((c) => c.uid === uid) ?? this.surveyDeck.find((c) => c.uid === uid);
  }

  // --------------------------------------------------------------- combat

  private startCombat(seg: Segment) {
    const ambush = seg.dark && !seg.lit;
    const enemies: EnemyState[] = (seg.encounter ?? []).map((id) => {
      const def = ENEMIES[id];
      return {
        uid: this.nextUid++,
        defId: id,
        hp: def.hp,
        maxHp: def.hp,
        block: 0,
        status: { ...freshStatus(), exposed: seg.flareExposed ?? 0 },
        intentIdx: this.rng.int(def.pattern.length),
        alive: true,
      };
    });
    this.combat = {
      enemies,
      draw: this.rng.shuffle([...this.combatDeck]),
      hand: [],
      discard: [],
      energy: 0,
      energyCap: MAX_ENERGY,
      turn: 0,
      ambush,
      buffs: new Map(),
      pendingEmpower: null,
      playedThisTurn: 0,
      playedThisFight: 0,
      lastWasAttack: false,
      held: new Map(),
      hurtRound: false,
      platers: [],
      played: [],
      pendingPick: null,
    };
    this.playerStatus = freshStatus();
    this.corpses = [];
    this.phase = 'combat';
    this.playerBlock = 0;
    this.retainBlock = 0;
    this.startPlayerTurn();
    if (this.hasBoon('crystal-bones')) {
      this.playerBlock += 4;
      this.emit({ type: 'block', amount: 4 });
    }
    this.message = ambush
      ? 'AMBUSH. They were waiting in the dark. −1 energy this turn.'
      : 'Tap a card, then tap it again to play.';
  }

  intentOf(e: EnemyState): Intent {
    const def = ENEMIES[e.defId];
    const p = e.phase2 && def.phase2 ? def.phase2.pattern : def.pattern;
    return p[e.intentIdx % p.length];
  }

  /** Damage an intent will deal per hit, after modifiers. For the UI. */
  intentDamage(e: EnemyState): number {
    const intent = this.intentOf(e);
    if (!intent.attack) return 0;
    return this.scale(intent.attack + e.status.strength, e.status.weak > 0, this.playerStatus.exposed > 0);
  }

  private scale(base: number, weak: boolean, exposed: boolean): number {
    let d = base;
    if (weak) d = Math.floor(d * 0.75);
    if (exposed) d = Math.floor(d * 1.5);
    return Math.max(0, d);
  }

  private startPlayerTurn() {
    const c = this.combat!;
    // Unscarred Edge: a clean round while held sharpens it.
    if (c.turn > 0 && !c.hurtRound) {
      for (const card of c.hand) {
        if (card.defId !== 'unscarred') continue;
        c.held.set(card.uid, (c.held.get(card.uid) ?? 0) + 2);
        const clean = (card.mem?.clean ?? 0) + 1;
        card.mem = { ...card.mem, clean };
        if (clean % 3 === 0) this.imprint(card, 'damage', 1);
      }
    }
    c.hurtRound = false;
    c.platers = [];
    c.turn++;
    this.playerBlock = Math.min(this.playerBlock, this.retainBlock);
    this.retainBlock = 0;
    c.playedThisTurn = 0;
    c.lastWasAttack = false;
    c.energyCap = MAX_ENERGY + (this.modifiers.energy ? 1 : 0);
    c.energy = c.energyCap - (c.ambush && c.turn === 1 ? 1 : 0);
    // held cards take their slots
    this.drawCombat(Math.max(0, COMBAT_HAND - c.hand.length));
  }

  private drawCombat(n: number) {
    const c = this.combat!;
    for (let i = 0; i < n; i++) {
      if (c.draw.length === 0) {
        if (c.discard.length === 0) return;
        c.draw = this.rng.shuffle(c.discard);
        c.discard = [];
      }
      c.hand.push(c.draw.pop()!);
    }
  }

  livingEnemies(): EnemyState[] {
    return this.combat?.enemies.filter((e) => e.alive) ?? [];
  }

  combatPlayable(card: CardInstance): string | null {
    if (this.phase !== 'combat' || !this.combat) return 'Not now.';
    if (cardStats(card).cost > this.combat.energy) return 'Not enough energy.';
    if ((card.defId === 'donor' || card.defId === 'flask') && this.combat.hand.length < 2) return 'No other card in hand.';
    return null;
  }

  /** Bonus damage this card currently carries from Empower, this fight. */
  combatBonus(card: CardInstance): number {
    return (this.combat?.buffs.get(card.uid) ?? 0) + (this.combat?.held.get(card.uid) ?? 0);
  }

  /** Stats for display: base stats plus any Empower bonus, so the UI shows the true numbers. */
  displayStats(card: CardInstance): CardStats {
    const s = cardStats(card);
    const bonus = this.combatBonus(card);
    return bonus > 0 ? { ...s, damage: s.damage + bonus } : s;
  }

  /** Resolve a pending Empower by picking the card in hand that gains the bonus. */
  empowerTarget(uid: number): boolean {
    const c = this.combat;
    if (!c?.pendingEmpower) return false;
    const target = c.hand.find((h) => h.uid === uid);
    if (!target) return false;
    const amount = c.pendingEmpower.amount;
    c.buffs.set(uid, (c.buffs.get(uid) ?? 0) + amount);
    c.pendingEmpower = null;
    this.emit({ type: 'empower', uid, amount });
    return true;
  }

  /** Decline to empower anything with a pending bonus. */
  skipEmpower(): void {
    if (this.combat) this.combat.pendingEmpower = null;
  }

  /** Does the card about to be played resolve twice? */
  resonates(): boolean {
    const c = this.combat;
    if (!c) return false;
    if (this.hasBoon('resonant-core') && c.playedThisFight === 0) return true;
    return this.world === 'kessra' && (c.playedThisTurn + 1) % 3 === 0;
  }

  playCombat(uid: number, targetUid?: number): boolean {
    const c = this.combat;
    if (!c || this.phase !== 'combat') return false;
    const card = c.hand.find((h) => h.uid === uid);
    if (!card) return false;
    const reason = this.combatPlayable(card);
    if (reason) {
      this.message = reason;
      return false;
    }
    const s = cardStats(card);
    const living = this.livingEnemies();
    let target: EnemyState | undefined;
    if (!s.aoe && needsTarget(card)) {
      target = living.find((e) => e.uid === targetUid) ?? (living.length === 1 ? living[0] : undefined);
      if (!target) {
        this.message = 'Choose a target.';
        return false;
      }
    }

    c.energy -= s.cost;
    c.hand = c.hand.filter((h) => h !== card);
    c.discard.push(card);

    const times = this.resonates() ? 2 : 1;
    const chained = c.lastWasAttack;
    c.playedThisTurn++;
    c.playedThisFight++;
    c.played.push(card.uid);
    let resolved = 0;
    for (let r = 0; r < times; r++) {
      if (r > 0) this.emit({ type: 'resonate' });
      this.resolveCard(card, s, target, chained);
      resolved++;
      if (this.isDead || this.livingEnemies().length === 0) break;
    }
    if (this.isDead) return true;
    if (resolved === 2 && card.defId === 'echoscar') {
      this.imprint(card, 'damage', 1);
      for (const o of this.combatDeck) if (o.defId === 'resonant') this.imprint(o, 'damage', 1);
    }
    c.lastWasAttack = s.damage > 0;
    this.message = '';

    if (this.livingEnemies().length === 0) this.winCombat();
    return true;
  }

  /** Apply one card's effects once. Resonance calls this twice. */
  private resolveCard(card: CardInstance, s: CardStats, chosen: EnemyState | undefined, chained: boolean) {
    const c = this.combat!;
    const living = this.livingEnemies();
    let targets: EnemyState[] = [];
    if (s.aoe) targets = living;
    else if (needsTarget(card)) {
      const t = chosen && chosen.alive ? chosen : living[0];
      if (t) targets = [t];
    }

    if (s.block > 0) {
      this.playerBlock += s.block;
      if (s.retain) this.retainBlock += s.block;
      this.emit({ type: 'block', amount: s.block });
    }
    const bonus = this.combatBonus(card);
    const hits = s.hits + (chained ? s.chain : 0) + (living.length >= 2 ? s.swarm : 0);
    const taggedBefore = living.filter((e) => e.status.tagged > 0).length;
    const targetTagged = targets.some((t) => t.status.tagged > 0);
    const aliveBefore = targets.filter((t) => t.alive);
    let dealt = 0;
    for (const t of targets) {
      let extra = 0;
      if (s.shatter > 0) {
        extra = t.block * s.shatter;
        t.block = 0;
      }
      for (let h = 0; h < hits && t.alive; h++) {
        const base = s.damage + bonus + this.playerStatus.strength + (h === 0 ? extra : 0);
        const dmg = this.scale(base, this.playerStatus.weak > 0, t.status.exposed > 0);
        dealt += this.damageEnemy(t, dmg);
        if (this.isDead) return;
      }
      if (t.alive) {
        t.status.tagged += s.tag;
        t.status.weak += s.weak;
        t.status.exposed += s.exposed;
      } else if (s.tag > 0) {
        // Tagging a killing blow still marks the corpse.
        const corpse = this.corpses.find((k) => k.uid === t.uid);
        if (corpse) corpse.tagged = true;
      }
    }
    const kills = aliveBefore.filter((t) => !t.alive).length;
    this.afterResolve(card, s, kills, targetTagged ? taggedBefore : 0);
    c.energy += s.energy;
    if (s.heal > 0) this.healPlayer(s.heal);
    if (s.draw > 0) this.drawCombat(s.draw);
    if (s.drain > 0 && dealt > 0) this.gainBiomass(Math.floor(dealt * s.drain / 100));
    if (s.empower > 0 && c.hand.length > 0) {
      c.pendingEmpower = { amount: (c.pendingEmpower?.amount ?? 0) + s.empower };
    }
  }

  /** Imprint effects that fire when a card resolves. */
  private afterResolve(card: CardInstance, s: CardStats, kills: number, taggedHeal: number) {
    const c = this.combat!;
    switch (card.defId) {
      case 'needle':
        if (taggedHeal > 0) {
          this.healPlayer(taggedHeal);
          let drawn = (card.mem?.drawn ?? 0) + taggedHeal;
          while (drawn >= 6) {
            drawn -= 6;
            this.imprint(card, 'tag', 1);
          }
          card.mem = { ...card.mem, drawn };
        }
        break;
      case 'feeding':
        if (kills > 0) this.imprint(card, 'damage', 2 * kills);
        break;
      case 'hunger':
        if (kills > 0) this.imprint(card, 'damage', 3 * kills);
        break;
      case 'callus':
        if (s.block > 0 && !c.platers.includes(card.uid)) c.platers.push(card.uid);
        break;
      case 'donor':
      case 'flask':
      case 'cannibal': {
        if (c.hand.length === 0) break;
        const p = c.pendingPick;
        if (p && p.kind === card.defId && p.source === card.uid) p.times++;
        else c.pendingPick = { kind: card.defId, source: card.uid, times: 1 };
        break;
      }
      default:
        break;
    }
  }

  /** Give a card a permanent Imprint. Siblings share it. */
  private imprint(card: CardInstance, stat: ImprintStat, n: number) {
    if (n === 0) return;
    const def = cardDef(card);
    const targets = def.keywords?.includes('sibling')
      ? this.combatDeck.filter((o) => cardDef(o).keywords?.includes('sibling'))
      : [card];
    if (!targets.includes(card)) targets.push(card);
    const label = `${n > 0 ? '+' : ''}${n} ${stat === 'block' ? 'PLATE' : stat.toUpperCase()}`;
    for (const t of targets) {
      addImprint(t, stat, n);
      this.emit({ type: 'imprint', uid: t.uid, stat, amount: n, label });
    }
  }

  /** Remove a card from the run for good. Grief Engines grow from it. */
  private consumeCard(card: CardInstance) {
    const c = this.combat;
    const drop = (list: CardInstance[]) => list.filter((o) => o.uid !== card.uid);
    this.combatDeck = drop(this.combatDeck);
    if (c) {
      c.hand = drop(c.hand);
      c.draw = drop(c.draw);
      c.discard = drop(c.discard);
    }
    this.emit({ type: 'consumed', uid: card.uid, defId: card.defId });
    for (const g of this.combatDeck) if (g.defId === 'grief') this.imprint(g, 'block', 1);
  }

  /** Resolve a pending Donor / Flask / Cannibal by choosing a card in hand. */
  pickCard(uid: number): boolean {
    const c = this.combat;
    const p = c?.pendingPick;
    if (!c || !p) return false;
    const target = c.hand.find((h) => h.uid === uid);
    const source = this.combatDeck.find((o) => o.uid === p.source);
    if (!target || !source || target === source) return false;
    c.pendingPick = null;
    if (p.kind === 'donor') {
      const stat: ImprintStat = cardStats(target).damage > 0 ? 'damage' : 'block';
      this.imprint(target, stat, 2 * p.times);
      const doses = (source.mem?.doses ?? 0) + 1;
      source.mem = { ...source.mem, doses };
      if (doses >= 3) this.consumeCard(source);
    } else if (p.kind === 'flask') {
      for (let i = 0; i < p.times; i++) this.mutate(target);
      this.consumeCard(source);
    } else {
      const v = cardStats(target);
      this.consumeCard(target);
      if (v.damage > 0) this.imprint(source, 'damage', v.damage);
      if (v.block > 0) this.imprint(source, 'block', v.block);
    }
    return true;
  }

  skipPick(): void {
    if (this.combat) this.combat.pendingPick = null;
  }

  /** Unstable: a free random gene, and one time in three a defect. */
  private mutate(card: CardInstance) {
    const { good, bad } = mutationsFor(card);
    const pool = bad.length && this.rng.next() < 1 / 3 ? bad : good.length ? good : bad;
    if (!pool.length) return;
    const gene = this.rng.pick(pool);
    const def = cardDef(card);
    const targets = def.keywords?.includes('sibling')
      ? this.combatDeck.filter((o) => cardDef(o).keywords?.includes('sibling'))
      : [card];
    for (const t of targets) {
      t.genes = [...t.genes, gene.id];
      t.mem = { ...t.mem, imprints: (t.mem?.imprints ?? 0) + 1 };
      this.emit({ type: 'imprint', uid: t.uid, stat: 'gene', amount: gene.defect ? -1 : 1, label: gene.name.toUpperCase() });
    }
  }

  /** Damages an enemy with one hit and returns how much landed (after their plating). */
  private damageEnemy(e: EnemyState, amount: number): number {
    if (amount <= 0) return 0;
    const def = ENEMIES[e.defId];
    const plated = e.block > 0;
    // Plating works like the player's: it cuts every hit by its value and is not used up.
    const blocked = Math.min(e.block, amount);
    const dealt = amount - blocked;
    e.hp -= dealt;
    this.emit({ type: 'enemyHit', uid: e.uid, amount: dealt, blocked });
    if (def.reflect && plated) {
      const back = Math.floor(amount * def.reflect);
      if (back > 0) {
        this.emit({ type: 'reflect', amount: back });
        this.damagePlayer(back);
        if (this.isDead) return dealt;
      }
    }
    if (e.hp <= 0) {
      e.hp = 0;
      e.alive = false;
      this.corpses.push({ uid: e.uid, defId: e.defId, biomass: def.biomass, tagged: e.status.tagged > 0, taken: false });
      this.emit({ type: 'enemyDie', uid: e.uid });
      if (def.splits && !e.split) {
        const half = Math.max(1, Math.floor(e.maxHp / 2));
        this.spawnEnemy(e.defId, half, true);
        this.spawnEnemy(e.defId, half, true);
      }
    } else if (def.phase2 && !e.phase2 && e.hp <= e.maxHp * def.phase2.below) {
      e.phase2 = true;
      e.intentIdx = 0;
      if (def.phase2.line) this.emit({ type: 'line', uid: e.uid, text: def.phase2.line });
    }
    return dealt;
  }

  /** Add an enemy to the current fight. Clears away the already-dead to make room. */
  private spawnEnemy(defId: string, hp?: number, split = false): boolean {
    const c = this.combat;
    if (!c) return false;
    c.enemies = c.enemies.filter((x) => x.alive);
    if (c.enemies.length >= MAX_ENEMIES) return false;
    const def = ENEMIES[defId];
    const e: EnemyState = {
      uid: this.nextUid++,
      defId,
      hp: hp ?? def.hp,
      maxHp: hp ?? def.hp,
      block: 0,
      status: freshStatus(),
      intentIdx: this.rng.int(def.pattern.length),
      alive: true,
      split,
    };
    c.enemies.push(e);
    this.emit({ type: 'summon', uid: e.uid });
    return true;
  }

  endTurn(): void {
    const c = this.combat;
    if (!c || this.phase !== 'combat') return;
    c.pendingEmpower = null;
    c.pendingPick = null;
    const holds = (h: CardInstance) => !!cardDef(h).keywords?.includes('hold');
    c.discard.push(...c.hand.filter((h) => !holds(h)));
    c.hand = c.hand.filter(holds);
    this.tickStatus(this.playerStatus);

    for (const e of [...c.enemies]) {
      if (!e.alive) continue;
      e.block = 0;
      const intent = this.intentOf(e);
      this.emit({ type: 'enemyAct', uid: e.uid });
      if (intent.line) this.emit({ type: 'line', uid: e.uid, text: intent.line });
      if (intent.block) e.block += intent.block;
      if (intent.attack) {
        const hits = intent.hits ?? 1;
        for (let h = 0; h < hits; h++) {
          this.damagePlayer(this.intentDamage(e));
          if (this.isDead) return;
        }
      }
      if (intent.strength) e.status.strength += intent.strength;
      if (intent.allyStrength) {
        for (const o of c.enemies) if (o !== e && o.alive) o.status.strength += intent.allyStrength;
      }
      // Summoned minions arrive already split, so they never multiply.
      if (intent.summon) this.spawnEnemy(intent.summon, undefined, true);
      if (intent.weak) this.playerStatus.weak += intent.weak;
      if (intent.exposed) this.playerStatus.exposed += intent.exposed;
      this.tickStatus(e.status);
      e.intentIdx++;
    }
    this.startPlayerTurn();
    this.message = '';
  }

  private tickStatus(s: Statuses) {
    if (s.weak > 0) s.weak--;
    if (s.exposed > 0) s.exposed--;
  }

  /** One hit on the player. Plating cuts every single hit by its full value, and is not used up. */
  private damagePlayer(amount: number) {
    const blocked = Math.min(this.playerBlock, amount);
    const taken = amount - blocked;
    this.hp -= taken;
    this.emit({ type: 'playerHit', amount: taken, blocked });
    if (this.hp <= 0) {
      this.die();
      return;
    }
    const c = this.combat;
    if (!c) return;
    if (taken > 0) {
      c.hurtRound = true;
      for (const card of c.hand) {
        if (card.defId === 'unscarred') c.held.delete(card.uid);
        if (card.defId === 'scartissue') {
          const others = this.combatDeck.filter((o) => o.uid !== card.uid);
          if (others.length) {
            const o = this.rng.pick(others);
            this.imprint(o, cardStats(o).damage > 0 ? 'damage' : 'block', 1);
          }
        }
      }
    } else if (blocked > 0 && amount > 0) {
      for (const uid of c.platers) {
        const callus = this.combatDeck.find((o) => o.uid === uid);
        if (callus) this.imprint(callus, 'block', 1);
      }
    }
  }

  private damagePlayerRaw(amount: number) {
    this.hp -= amount;
    this.emit({ type: 'playerHit', amount, blocked: 0 });
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.hp = 0;
    this.phase = 'dead';
    this.combat = null;
  }

  private winCombat() {
    const c = this.combat;
    if (c) {
      for (const card of this.combatDeck) {
        if (card.defId === 'hunger' && !c.played.includes(card.uid)) this.imprint(card, 'damage', -2);
      }
    }
    this.segments[this.pos].cleared = true;
    this.phase = 'harvest';
    this.message = 'Harvest the biomass. Eat it to mend, or render it to splice.';
  }

  // -------------------------------------------------------------- harvest

  corpseYield(k: Corpse): number {
    return k.tagged ? k.biomass * 2 : k.biomass;
  }

  consume(uid: number): void {
    const k = this.corpses.find((x) => x.uid === uid && !x.taken);
    if (!k || this.phase !== 'harvest') return;
    k.taken = true;
    this.healPlayer(this.corpseYield(k));
  }

  render(uid: number): void {
    const k = this.corpses.find((x) => x.uid === uid && !x.taken);
    if (!k || this.phase !== 'harvest') return;
    k.taken = true;
    this.gainBiomass(this.corpseYield(k));
  }

  finishHarvest(): void {
    if (this.phase !== 'harvest') return;
    this.combat = null;
    this.corpses = [];
    this.playerStatus = freshStatus();
    this.playerBlock = 0;
    const seg = this.segments[this.pos];
    const pool = seg?.elite && this.world ? WORLDS[this.world].cards : this.rewardPool();
    this.offers = this.rng.sample(pool, 3).map((defId) => ({ defId, deck: 'combat' as const }));
    if (seg?.elite) this.gainBiomass(ELITE_BIOMASS);
    this.phase = 'reward';
  }

  private healPlayer(amount: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) this.emit({ type: 'heal', amount: this.hp - before });
  }

  private gainBiomass(amount: number) {
    const total = this.modifiers.biomass ? Math.round(amount * 1.5) : amount;
    this.biomass += total;
    this.emit({ type: 'biomass', amount: total });
  }

  // ------------------------------------------------------------ helpers

  get isDead(): boolean {
    return this.phase === 'dead';
  }

  get progress(): number {
    return this.pos / (this.segments.length - 1);
  }

  // -------------------------------------------------------------- save

  /** Snapshot the full run as JSON, for browser-storage saves. */
  serialize(): string {
    return JSON.stringify({
      v: SAVE_VERSION,
      rngState: this.rng.exportState(),
      cloneNo: this.cloneNo,
      hp: this.hp,
      maxHp: this.maxHp,
      biomass: this.biomass,
      combatDeck: this.combatDeck,
      surveyDeck: this.surveyDeck,
      segments: this.segments,
      pos: this.pos,
      phase: this.phase,
      sector2Start: this.sector2Start,
      modifiers: this.modifiers,
      sDraw: this.sDraw,
      sHand: this.sHand,
      sDiscard: this.sDiscard,
      oxygen: this.oxygen,
      combat: this.combat
        ? { ...this.combat, buffs: [...this.combat.buffs.entries()], held: [...this.combat.held.entries()] }
        : null,
      playerBlock: this.playerBlock,
      playerStatus: this.playerStatus,
      corpses: this.corpses,
      offers: this.offers,
      podIndex: this.podIndex,
      nextUid: this.nextUid,
      message: this.message,
      world: this.world,
      map: this.map,
      mapNode: this.mapNode,
      eventId: this.eventId,
      eventResult: this.eventResult,
      boonOffers: this.boonOffers,
      retainBlock: this.retainBlock,
      seenEvents: this.seenEvents,
    });
  }

  /**
   * JSON gives the piles their own copies of each card. Point them back at the deck's objects,
   * so Imprints and splices made during play land on the one true card.
   */
  private relinkPiles() {
    const combat = new Map(this.combatDeck.map((c) => [c.uid, c]));
    const survey = new Map(this.surveyDeck.map((c) => [c.uid, c]));
    const link = (list: CardInstance[], by: Map<number, CardInstance>) => list.map((c) => by.get(c.uid) ?? c);
    if (this.combat) {
      this.combat.hand = link(this.combat.hand, combat);
      this.combat.draw = link(this.combat.draw, combat);
      this.combat.discard = link(this.combat.discard, combat);
    }
    this.sHand = link(this.sHand, survey);
    this.sDraw = link(this.sDraw, survey);
    this.sDiscard = link(this.sDiscard, survey);
  }

  /** Restore a run saved by `serialize()`. Returns null on any mismatch or corruption. */
  static load(json: string, meta: Meta = freshMeta()): Game | null {
    try {
      const d = JSON.parse(json);
      if (d?.v !== SAVE_VERSION) return null;
      const g = new Game(0, d.cloneNo, meta);
      g.rng.importState(d.rngState);
      g.hp = d.hp;
      g.maxHp = d.maxHp;
      g.biomass = d.biomass;
      g.combatDeck = d.combatDeck;
      g.surveyDeck = d.surveyDeck;
      g.segments = d.segments;
      g.pos = d.pos;
      g.phase = d.phase;
      g.sector2Start = d.sector2Start;
      g.modifiers = d.modifiers;
      g.sDraw = d.sDraw;
      g.sHand = d.sHand;
      g.sDiscard = d.sDiscard;
      g.oxygen = d.oxygen;
      g.combat = d.combat
        ? {
          held: [], hurtRound: false, platers: [], played: [], pendingPick: null,
          ...d.combat,
          buffs: new Map(d.combat.buffs),
        }
        : null;
      if (g.combat) g.combat.held = new Map(d.combat.held ?? []);
      g.relinkPiles();
      g.playerBlock = d.playerBlock;
      g.playerStatus = d.playerStatus;
      g.corpses = d.corpses;
      g.offers = d.offers;
      g.podIndex = d.podIndex;
      g.nextUid = d.nextUid;
      g.message = d.message;
      g.world = d.world;
      g.map = d.map;
      g.mapNode = d.mapNode;
      g.eventId = d.eventId;
      g.eventResult = d.eventResult;
      g.boonOffers = d.boonOffers;
      g.retainBlock = d.retainBlock;
      g.seenEvents = d.seenEvents;
      g.events = [];
      return g;
    } catch {
      return null;
    }
  }
}
