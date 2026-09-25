import {
  REWARD_COMBAT, REWARD_SURVEY, SECRET_CARDS, STARTER_COMBAT, STARTER_SURVEY,
  CARDS, GENES, MUTATIONS, addImprint, applyMutation, applySurgery, cardDef, eliteGenesFor, isMedic, mutationAmount,
  mutationFits, surgeryOps, cardSlot, healsChosenLimb, cardStats, mutationsFor, needsTarget,
} from './cards';
import { AIM_LIMBS, LIMBS, LIMB_NAME, LIMB_TYPE, freshBody, type Body, type Limb } from './body';
import { ENEMIES } from './enemies';
import { Rng } from './rng';
import type {
  CardInstance, CardStats, Corpse, DeckKind, EnemyState, ImprintStat, Intent, MapNode, Meta, Modifiers, SecretKind, Segment,
  Statuses, WorldMap,
} from './types';
import { BOONS, EVENTS, GERMLINE, LOGS, MAP_ROWS, WORLDS, generateMap } from './worlds';

export type Phase =
  | 'explore' | 'combat' | 'harvest' | 'reward' | 'loot' | 'splice' | 'modifier'
  | 'mainframe' | 'map' | 'event' | 'boon' | 'secret' | 'surgery' | 'limb' | 'dead' | 'won';

/** Maximum integrity a Reliquary card costs. */
export const RELIQUARY_PRICE = 8;
const LAIR_BIOMASS = 10;
const GERMLINE_OFFERS = 3;

export const freshMeta = (): Meta => ({ boons: [], worldsCleared: [], logs: [] });

export type GameEvent =
  | { type: 'step' }
  | { type: 'bump' }
  | { type: 'enemyHit'; uid: number; amount: number; blocked: number }
  | { type: 'enemyDie'; uid: number }
  | { type: 'enemyAct'; uid: number }
  | { type: 'playerHit'; amount: number; blocked: number; limb?: Limb }
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
  | { type: 'consumed'; uid: number; defId: string }
  | { type: 'printed'; uid: number; defId: string }
  | { type: 'limbLost'; limb: Limb }
  | { type: 'limbBack'; limb: Limb };

/** A card waiting for the player to choose another card in hand. */
export interface PendingPick {
  kind: 'donor' | 'flask' | 'cannibal' | 'redraw';
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
  /** Extra plating on a card (by uid) for the rest of this fight (Hive Shell). */
  plateBuffs?: Map<number, number>;
  /** The limb a heal card was aimed at, and the limb acting now (for reflected damage). */
  healTo?: Limb;
  acting?: Limb;
  /** Clot Patches printed per tagged death, this fight (Triage). */
  triage?: number;
  /** The card (uid) in each body slot, in LIMBS order. Stale once the card leaves the hand. */
  slots: (number | null)[];
  /** Every enemy is dead, but a card's effect still waits on the player. The fight ends once it resolves. */
  victoryPending?: boolean;
}

export interface Offer {
  defId: string;
  deck: DeckKind;
}

export const MAX_ENERGY = 4;
export const MAX_OXYGEN = 3;
export const SURVEY_HAND = 4;
export const FORCE_COST = 4;
const VIEW_RANGE = 4;
const SAVE_VERSION = 3;
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
  /** Integrity per limb. The head keeps most of it; head at 0 is death. */
  body: Body = freshBody();
  /** Max integrity waiting for the player to choose a limb, and the phase to return to. */
  limbGain: { amount: number; resume: Phase } | null = null;

  /** Total integrity, all limbs. */
  get hp(): number {
    return LIMBS.reduce((n, l) => n + this.body[l].hp, 0);
  }

  get maxHp(): number {
    return LIMBS.reduce((n, l) => n + this.body[l].max, 0);
  }

  /** Test and debug helper: set total integrity. Damage comes off the head first (down to 1), then the limbs. */
  set hp(v: number) {
    for (const l of LIMBS) this.body[l].hp = this.body[l].max;
    let deficit = Math.max(0, this.maxHp - v);
    for (const l of ['head', 'lleg', 'rleg', 'larm', 'rarm'] as Limb[]) {
      const floor = l === 'head' ? 1 : 0;
      const cut = Math.min(deficit, this.body[l].hp - floor);
      this.body[l].hp -= cut;
      deficit -= cut;
    }
  }

  isDisabled(l: Limb): boolean {
    return this.body[l].hp <= 0;
  }
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
  /** The secret room the player is standing in, and where they came from. */
  secret: { kind: SecretKind; from: 'explore' | 'map' } | null = null;
  /** A secret-room fight is in progress (its rewards and exit differ). */
  secretFight: 'explore' | 'map' | null = null;
  /** Gateways at each map junction row (Gatesight only). */
  mapGates: Record<number, { kind: SecretKind; used: boolean }> = {};
  /** Second Heart already spent this run. */
  heartUsed = false;

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
  /** The splice pod in use: what it offers, and the biomass poured in (never given back). */
  vat: { effect: string; elite: boolean; pool: number } | null = null;
  surgeryIndex = -1;

  events: GameEvent[] = [];
  message = '';
  private nextUid = 1;

  constructor(seed: number, cloneNo = 1, meta: Meta = freshMeta()) {
    this.rng = new Rng(seed);
    this.cloneNo = cloneNo;
    this.meta = meta;
    this.combatDeck = STARTER_COMBAT.map((id) => this.makeCard(id));
    this.surveyDeck = STARTER_SURVEY.map((id) => this.makeCard(id));
    const h = meta.heirloom;
    if (this.hasBoon('heirloom') && h && !!CARDS[h.defId]) {
      this.combatDeck.push({
        uid: this.nextUid++, defId: h.defId, genes: [...h.genes],
        imprint: h.imprint ? { ...h.imprint } : undefined, mem: { imprints: 1 },
      });
    }
    const sector1 = this.buildSector1();
    this.sector2Start = sector1.length;
    this.segments = [...sector1, ...this.buildSector2()];
    if (this.hasBoon('gatesight')) this.placeLabGates();
    this.sDraw = this.rng.shuffle([...this.surveyDeck]);
    this.updateVisibility();
    this.newSurveyTurn();
    this.emit({ type: 'whisper', text: this.segments[0].whisper ?? '' });
  }

  // ------------------------------------------------------------------ setup

  /** Gatesight: one hidden gateway in each lab sector. The first may be a shortcut. */
  private placeLabGates() {
    const spots = (from: number, to: number) =>
      this.segments.map((s, i) => ({ s, i })).filter(({ s, i }) => i > from && i < to && (s.feature === 'none' || s.feature === 'crate'));
    const s1 = spots(0, this.sector2Start - 1);
    const s2 = spots(this.sector2Start, this.segments.length - 1);
    if (s1.length) this.rng.pick(s1).s.gate = this.rng.pick<SecretKind>(['reliquary', 'lair', 'vat', 'shortcut']);
    if (s2.length) this.rng.pick(s2).s.gate = this.rng.pick<SecretKind>(['reliquary', 'lair', 'vat']);
  }

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
      seg('surgery', { whisper: 'A surgical arm hangs from the ceiling, still sterile. It will cut anything out of you, for a price.', shape: 'vats' }),
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

  get maxOxygen(): number {
    return MAX_OXYGEN + (this.hasBoon('lungs') ? 1 : 0);
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
    this.oxygen = this.maxOxygen;
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
      case 'pod': return 'A splice pod glows ahead. Pour biomass in to mutate a card.';
      case 'surgery': return 'A surgery bay. It cuts defects and drawbacks out of cards, for biomass.';
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
    this.damagePlayerRaw(FORCE_COST, this.aimAt(['larm', 'rarm']));
    if (this.isDead) return true;
    this.message = 'You tear through. Something in your arm gives.';
    return true;
  }

  /** Interactable in front or underfoot (locker or pod). */
  private interactable(kind: 'crate' | 'pod' | 'surgery'): number {
    for (const i of [this.pos + 1, this.pos]) {
      const s = this.segments[i];
      if (s && s.revealed && s.feature === kind && !s.cleared) return i;
    }
    return -1;
  }

  canUsePod(): boolean {
    return this.phase === 'explore' && this.interactable('pod') >= 0;
  }

  canUseSurgery(): boolean {
    return this.phase === 'explore' && this.interactable('surgery') >= 0;
  }

  surveyPlayable(card: CardInstance): string | null {
    const s = cardStats(card);
    const def = cardDef(card);
    if (s.bioCost > this.biomass) return 'Not enough biomass.';
    if (!def.action && s.heal > 0 && !s.draw && !s.biomass && this.hp >= this.maxHp) return 'Integrity already full.';
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

  playSurvey(uid: number, limb?: Limb): boolean {
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
    this.payBiomass(s.bioCost);
    this.sHand = this.sHand.filter((c) => c !== card);
    if (isMedic(def.id)) {
      this.surveyDeck = this.surveyDeck.filter((c) => c !== card);
      this.emit({ type: 'consumed', uid: card.uid, defId: card.defId });
    } else this.sDiscard.push(card);
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
      if (s.heal > 0) this.healPlayer(s.heal, healsChosenLimb(def.id) ? limb : undefined);
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
    if (s.heal > 0) this.healPlayer(s.heal, healsChosenLimb(def.id) ? limb : undefined);
    if (s.biomass > 0) this.gainBiomass(s.biomass);
    if (s.draw > 0) this.drawSurvey(s.draw);
    if (this.phase === 'explore' && def.action !== 'override' && def.action !== 'cut' && !this.message) {
      this.message = this.exploreHint();
    }
    return true;
  }

  /** Field Notes: each hidden thing found teaches a random tactic +1 damage. */
  private fieldNotes(found: number) {
    const fighters = this.combatDeck.filter((c) => this.displayStats(c).damage > 0);
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

  /** Pick n different card ids. Pools list common cards more than once to weight them. */
  private draft(pool: string[], n: number): string[] {
    const out: string[] = [];
    for (const id of this.rng.shuffle([...pool])) {
      if (!out.includes(id)) out.push(id);
      if (out.length === n) break;
    }
    return out;
  }

  private openLoot() {
    const combat = this.draft(this.rewardPool(), 2).map((defId) => ({ defId, deck: 'combat' as const }));
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
    if (this.secretFight) {
      const from = this.secretFight;
      this.secretFight = null;
      if (from === 'map') this.enterMap();
      else {
        this.phase = 'explore';
        this.newSurveyTurn();
      }
      return;
    }
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
    this.phase = 'explore';
    this.newSurveyTurn();
    if (key === 'integrity') this.askLimbGain(16);
  }

  // ---------------------------------------------------------------- worlds

  /** Mainframe: pick a destination. The ship crash-lands there. */
  chooseWorld(id: string): boolean {
    const def = WORLDS[id];
    if (this.phase !== 'mainframe' || !def?.playable) return false;
    this.world = id;
    this.map = generateMap(this.rng, id);
    this.mapNode = null;
    this.mapGates = {};
    if (this.hasBoon('gatesight')) {
      for (let r = 1; r < MAP_ROWS - 1; r++) {
        if (this.rng.next() < 0.45) this.mapGates[r] = { kind: this.rng.pick<SecretKind>(['reliquary', 'lair', 'vat', 'shortcut']), used: false };
      }
    }
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
        return [
          entry,
          seg('pod', { whisper: 'A splice pod, grown over with crystal. It still works.', ...open(0.6) }),
          ...(this.rng.next() < 0.5 ? [seg('surgery', { whisper: 'A surgical arm, crusted in glass. It still cuts clean.' })] : []),
          exit,
        ];
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

  // --------------------------------------------------------------- gateways

  /** The gateway the player can step through right now, if any. */
  gateHere(): SecretKind | null {
    if (this.phase === 'explore') {
      const seg = this.segments[this.pos];
      return seg?.gate && !seg.gateUsed ? seg.gate : null;
    }
    if (this.phase === 'map') {
      const g = this.mapGates[this.depth];
      return g && !g.used ? g.kind : null;
    }
    return null;
  }

  enterGate(): boolean {
    const kind = this.gateHere();
    if (!kind) return false;
    const from = this.phase === 'map' ? 'map' : 'explore';
    if (from === 'map') this.mapGates[this.depth].used = true;
    else this.segments[this.pos].gateUsed = true;
    this.secret = { kind, from };
    this.phase = 'secret';
    this.offers = kind === 'reliquary' ? this.rng.sample(SECRET_CARDS, 2).map((defId) => ({ defId, deck: 'combat' as const })) : [];
    this.emit({ type: 'warp' });
    return true;
  }

  /** Reliquary: take a card, pay with maximum integrity. */
  secretTake(index: number): boolean {
    if (this.secret?.kind !== 'reliquary' || !this.offers[index]) return false;
    this.combatDeck.push(this.makeCard(this.offers[index].defId));
    this.loseMax(RELIQUARY_PRICE);
    this.leaveSecret();
    return true;
  }

  /** Vat room: float until whole again. */
  secretVat(): boolean {
    if (this.secret?.kind !== 'vat') return false;
    for (const l of LIMBS) this.healLimb(l, this.body[l].max);
    this.leaveSecret();
    return true;
  }

  /** Lair: wake what is sleeping in there. */
  secretFightStart(): boolean {
    if (this.secret?.kind !== 'lair') return false;
    this.secretFight = this.secret.from;
    this.secret = null;
    this.startCombat({ feature: 'enemies', encounter: ['hollow'], dark: false, lit: true, revealed: true, cleared: false });
    return true;
  }

  /** Shortcut: in the lab, fold straight to sector 2; on a map, skip a row. */
  secretShortcut(): boolean {
    if (this.secret?.kind !== 'shortcut') return false;
    const from = this.secret.from;
    this.secret = null;
    this.offers = [];
    if (from === 'explore') {
      if (this.pos < this.sector2Start) this.pos = this.sector2Start;
      this.segments[this.pos].revealed = true;
      this.updateVisibility();
      this.phase = 'explore';
      this.emit({ type: 'warp' });
      this.newSurveyTurn();
      this.message = 'The gateway folds the ship. You step out a sector deeper.';
    } else {
      const skip = this.rng.pick(this.passages());
      skip.visited = true;
      skip.hidden = false;
      this.mapNode = skip.id;
      this.emit({ type: 'warp' });
      this.enterMap();
      this.message = 'The gateway spits you out further down. A whole stretch of cave, skipped.';
    }
    return true;
  }

  leaveSecret(): void {
    if (this.phase !== 'secret' || !this.secret) return;
    const from = this.secret.from;
    this.secret = null;
    this.offers = [];
    this.emit({ type: 'warp' });
    if (from === 'map') this.enterMap();
    else {
      this.phase = 'explore';
      this.newSurveyTurn();
    }
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
    if (e.maxHp) this.askLimbGain(e.maxHp);
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
    this.rememberHeirloom();
    const unowned = GERMLINE.filter((b) => !this.hasBoon(b));
    this.boonOffers = this.rng.sample(unowned, Math.min(GERMLINE_OFFERS, unowned.length));
    this.phase = this.boonOffers.length ? 'boon' : 'won';
  }

  chooseBoon(id: string): boolean {
    if (this.phase !== 'boon' || !this.boonOffers.includes(id)) return false;
    this.meta.boons.push(id);
    this.boonOffers = [];
    this.phase = 'won';
    return true;
  }

  /** Heirloom: remember this clone's most-imprinted tactic for the next one. */
  private rememberHeirloom() {
    let best: CardInstance | null = null;
    for (const c of this.combatDeck) {
      if ((c.mem?.imprints ?? 0) > (best?.mem?.imprints ?? 0)) best = c;
    }
    if (best) this.meta.heirloom = { defId: best.defId, genes: [...best.genes], imprint: best.imprint ? { ...best.imprint } : undefined };
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
    this.phase = 'splice';
    const all = [...this.combatDeck, ...this.surveyDeck];
    // Now and then the pod holds something it should not: an elite mutation.
    const elites = [...new Set(this.combatDeck.flatMap((c) => eliteGenesFor(c).map((g) => g.id)))];
    if (elites.length && this.rng.next() < 0.25) {
      this.vat = { effect: this.rng.pick(elites), elite: true, pool: 0 };
    } else {
      const fits = Object.values(MUTATIONS).filter((m) => all.some((c) => mutationFits(m, c)));
      this.vat = { effect: this.rng.pick(fits).id, elite: false, pool: 0 };
    }
    this.message = 'Pour biomass in. The more you give it, the stronger it takes.';
    return true;
  }

  /** Max integrity to place: the player picks the limb. */
  private askLimbGain(amount: number) {
    this.limbGain = { amount, resume: this.phase };
    this.phase = 'limb';
  }

  chooseLimbGain(l: Limb): boolean {
    const g = this.limbGain;
    if (this.phase !== 'limb' || !g) return false;
    const was = this.isDisabled(l);
    this.body[l].max += g.amount;
    this.body[l].hp += g.amount;
    if (was && !this.isDisabled(l)) this.emit({ type: 'limbBack', limb: l });
    this.phase = g.resume;
    this.limbGain = null;
    return true;
  }

  /** Max integrity lost comes from the limb with the most of it. */
  private loseMax(n: number) {
    const l = [...LIMBS].sort((a, b) => this.body[b].max - this.body[a].max)[0];
    this.body[l].max = Math.max(1, this.body[l].max - n);
    this.body[l].hp = Math.min(this.body[l].hp, this.body[l].max);
  }

  /** A working limb from the list, at random. Falls back to the head. */
  private aimAt(pool: Limb[]): Limb {
    const up = pool.filter((l) => !this.isDisabled(l));
    return up.length ? this.rng.pick(up) : 'head';
  }

  /** Throw biomass into the pod. It does not come back. */
  feedVat(n: number): boolean {
    if (this.phase !== 'splice' || !this.vat || n <= 0 || n > this.biomass) return false;
    this.biomass -= n;
    this.vat.pool += n;
    this.emit({ type: 'biomass', amount: -n });
    return true;
  }

  /** Price of the pod's elite mutation, if that is what it holds. */
  vatElitePrice(): number {
    return this.vat?.elite ? Math.round(GENES[this.vat.effect].cost * 1.5) : 0;
  }

  /** What the pod will do right now: 0 means not enough biomass yet. */
  vatAmount(): number {
    const v = this.vat;
    if (!v) return 0;
    if (v.elite) return v.pool >= this.vatElitePrice() ? 1 : 0;
    return mutationAmount(MUTATIONS[v.effect], v.pool);
  }

  /** Cards this pod's mutation can take hold in. */
  vatTargets(): CardInstance[] {
    const v = this.vat;
    if (!v) return [];
    if (v.elite) return this.combatDeck.filter((c) => eliteGenesFor(c).some((g) => g.id === v.effect));
    const m = MUTATIONS[v.effect];
    return [...this.combatDeck, ...this.surveyDeck].filter((c) => mutationFits(m, c));
  }

  /** Mutate the chosen card with what is in the pool. The pod is spent. */
  mutateCard(uid: number): boolean {
    const v = this.vat;
    if (this.phase !== 'splice' || !v) return false;
    const amount = this.vatAmount();
    const card = this.vatTargets().find((c) => c.uid === uid);
    if (!card || amount <= 0) return false;
    if (v.elite) {
      card.genes = [...card.genes, v.effect];
      card.prefix = undefined;
      card.mem = { ...card.mem, muts: (card.mem?.muts ?? 0) + 1 };
      const price = GENES[v.effect].maxHpCost ?? 0;
      if (price) this.loseMax(price);
    } else {
      applyMutation(card, MUTATIONS[v.effect], amount);
    }
    this.emit({ type: 'splice', uid });
    this.closePod('It takes. The pod drains and goes dark.');
    return true;
  }

  /** Walk away. Whatever was poured in stays in the pod. */
  leavePod(): void {
    if (this.phase !== 'splice') return;
    this.closePod(this.vat?.pool ? 'You walk away. The pod keeps what you gave it.' : 'The pod drains. It will not wake again.');
  }

  private closePod(message: string) {
    this.segments[this.podIndex].cleared = true;
    this.podIndex = -1;
    this.vat = null;
    this.phase = 'explore';
    this.message = message;
  }

  // -------------------------------------------------------------- surgery

  useSurgery(): boolean {
    const i = this.interactable('surgery');
    if (this.phase !== 'explore' || i < 0) return false;
    this.surgeryIndex = i;
    this.phase = 'surgery';
    this.message = 'Pay the arm, and it cuts out what is wrong with a card.';
    return true;
  }

  /** Cut a bad part out of a card, for biomass. The bay stays open for more. */
  operate(uid: number, opId: string): boolean {
    if (this.phase !== 'surgery') return false;
    const card = this.findCard(uid);
    const op = card && surgeryOps(card).find((o) => o.id === opId);
    if (!card || !op) return false;
    if (op.price > this.biomass) {
      this.message = 'Not enough biomass.';
      return false;
    }
    this.biomass -= op.price;
    this.emit({ type: 'biomass', amount: -op.price });
    applySurgery(card, opId);
    this.emit({ type: 'splice', uid });
    return true;
  }

  leaveSurgery(): void {
    if (this.phase !== 'surgery') return;
    this.segments[this.surgeryIndex].cleared = true;
    this.surgeryIndex = -1;
    this.phase = 'explore';
    this.message = 'The arm folds back into the ceiling.';
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
      slots: LIMBS.map(() => null),
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
    c.energyCap = MAX_ENERGY + (this.modifiers.energy ? 1 : 0) + (this.hasBoon('surplus') ? 1 : 0);
    c.energy = c.energyCap - (c.ambush && c.turn === 1 ? 1 : 0);
    // every working limb gets a card; held cards keep theirs
    this.fillSlots();
    if (c.turn === 1 && this.hasBoon('sparecell')) this.drawSpare(2);
    for (const e of this.livingEnemies()) this.chooseAim(e);
  }

  /** The card in a body slot, if it is still in hand. */
  slotCard(i: number): CardInstance | undefined {
    const c = this.combat;
    const uid = c?.slots[i];
    return uid == null ? undefined : c!.hand.find((h) => h.uid === uid);
  }

  /** Slot index of a card in hand, or -1 for a spare. */
  slotOf(uid: number): number {
    const c = this.combat;
    if (!c) return -1;
    const i = c.slots.indexOf(uid);
    return i >= 0 && this.slotCard(i) ? i : -1;
  }

  private fitsSlot(card: CardInstance, i: number): boolean {
    const t = cardSlot(card.defId);
    return t === 'any' || t === LIMB_TYPE[LIMBS[i]];
  }

  /**
   * Draw one card that fits slot i: from the draw pile, else reshuffle that kind from the discard.
   * Mid-turn redraws never reshuffle, so a free card cannot cycle through a small deck forever.
   */
  private drawFor(i: number, reshuffle = true): CardInstance | undefined {
    const c = this.combat!;
    const fits = (h: CardInstance) => this.fitsSlot(h, i);
    let k = -1;
    for (let j = c.draw.length - 1; j >= 0; j--) if (fits(c.draw[j])) { k = j; break; }
    if (k < 0) {
      if (!reshuffle) return undefined;
      const back = c.discard.filter(fits);
      if (!back.length) return undefined;
      c.discard = c.discard.filter((h) => !fits(h));
      c.draw = [...this.rng.shuffle(back), ...c.draw];
      k = back.length - 1;
    }
    return c.draw.splice(k, 1)[0];
  }

  private fillSlots() {
    const c = this.combat!;
    LIMBS.forEach((l, i) => {
      if (this.isDisabled(l)) {
        c.slots[i] = null;
        return;
      }
      if (this.slotCard(i)) return;
      const card = this.drawFor(i);
      c.slots[i] = card ? card.uid : null;
      if (card) c.hand.push(card);
    });
  }

  /** Extra cards beyond the five slots (Spare Cell). They still need a working limb of their kind. */
  private drawSpare(n: number) {
    const c = this.combat!;
    for (let i = 0; i < n && c.draw.length; i++) c.hand.push(c.draw.pop()!);
  }

  /** Redraw one body slot (draw effects). */
  pickSlot(i: number): boolean {
    const c = this.combat;
    const p = c?.pendingPick;
    if (!c || p?.kind !== 'redraw' || this.isDisabled(LIMBS[i])) return false;
    const old = this.slotCard(i);
    if (old) {
      c.hand = c.hand.filter((h) => h !== old);
      c.discard.push(old);
    }
    const card = this.drawFor(i, false);
    c.slots[i] = card ? card.uid : null;
    if (card) c.hand.push(card);
    p.times--;
    if (p.times <= 0) c.pendingPick = null;
    if (!c.pendingPick && c.victoryPending) this.endFightWhenResolved();
    return true;
  }

  /** Pick the limb an enemy will strike next, by its preference. */
  private chooseAim(e: EnemyState) {
    e.target = this.aimAt(AIM_LIMBS[ENEMIES[e.defId].aim ?? 'any']);
  }

  /** The limb a card acts with: its slot, or a working limb of its kind. */
  private limbOfCard(card: CardInstance): Limb {
    const i = this.slotOf(card.uid);
    if (i >= 0) return LIMBS[i];
    const t = cardSlot(card.defId);
    return this.aimAt(t === 'any' ? LIMBS : LIMBS.filter((l) => LIMB_TYPE[l] === t));
  }

  livingEnemies(): EnemyState[] {
    return this.combat?.enemies.filter((e) => e.alive) ?? [];
  }

  combatPlayable(card: CardInstance): string | null {
    if (this.phase !== 'combat' || !this.combat) return 'Not now.';
    const s = this.displayStats(card);
    if (s.cost > this.combat.energy) return 'Not enough energy.';
    if (s.bioCost > this.biomass) return 'Not enough biomass.';
    const t = cardSlot(card.defId);
    if (this.slotOf(card.uid) < 0 && t !== 'any' && LIMBS.every((l) => LIMB_TYPE[l] !== t || this.isDisabled(l))) {
      return `Your ${t === 'arm' ? 'arms are' : t === 'leg' ? 'legs are' : 'head is'} gone.`;
    }
    if ((card.defId === 'donor' || card.defId === 'flask') && this.combat.hand.length < 2) return 'No other card in hand.';
    return null;
  }

  /** Bonus damage this card currently carries from Empower, this fight. */
  combatBonus(card: CardInstance): number {
    return (this.combat?.buffs.get(card.uid) ?? 0) + (this.combat?.held.get(card.uid) ?? 0);
  }

  /**
   * What is printed on the card right now: permanent stats plus this fight's bonuses (Empower, Unscarred).
   * Anything that reads or copies a card's numbers uses this.
   */
  displayStats(card: CardInstance): CardStats {
    const s = cardStats(card);
    const bonus = this.combatBonus(card);
    const plate = this.combat?.plateBuffs?.get(card.uid) ?? 0;
    return bonus || plate ? { ...s, damage: s.damage + (s.damage > 0 ? bonus : 0), block: s.block + plate } : s;
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

  playCombat(uid: number, targetUid?: number, limb?: Limb): boolean {
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

    const acting = this.limbOfCard(card);
    c.energy -= s.cost;
    this.payBiomass(s.bioCost);
    c.hand = c.hand.filter((h) => h !== card);
    c.discard.push(card);
    c.healTo = healsChosenLimb(card.defId) ? limb : undefined;
    c.acting = acting;

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
    for (const h of this.handWith('hiveshell')) {
      const copies = h.genes.filter((g) => g === 'hiveshell').length;
      c.plateBuffs = c.plateBuffs ?? new Map();
      c.plateBuffs.set(h.uid, (c.plateBuffs.get(h.uid) ?? 0) + copies);
    }
    if (s.selfHarm > 0) {
      this.damagePlayer(s.selfHarm, true, acting);
      if (this.isDead) return true;
    }
    // medic cards are used up
    if (isMedic(card.defId)) this.consumeCard(card);
    if (resolved === 2 && card.defId === 'echoscar') {
      this.imprint(card, 'damage', 1);
      for (const o of this.combatDeck) if (o.defId === 'resonant') this.imprint(o, 'damage', 1);
    }
    c.lastWasAttack = s.damage > 0;
    this.message = '';

    if (this.livingEnemies().length === 0) this.endFightWhenResolved();
    return true;
  }

  /** Win the fight, unless a card's permanent effect still needs a choice: resolve that first. */
  private endFightWhenResolved() {
    const c = this.combat!;
    // Empower only lasts this fight: nothing left to give it to.
    c.pendingEmpower = null;
    if (c.pendingPick) {
      c.victoryPending = true;
      this.message = 'The last one falls. Finish what the card started.';
      return;
    }
    c.victoryPending = false;
    this.winCombat();
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

    const plate = s.block + (c.plateBuffs?.get(card.uid) ?? 0);
    if (plate > 0) {
      this.playerBlock += plate;
      if (s.retain) this.retainBlock += plate;
      this.emit({ type: 'block', amount: plate });
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
        const landed = this.damageEnemy(t, dmg);
        dealt += landed;
        if (this.isDead) return;
        if (landed > 0) {
          this.growInHand('mirror', 1);
          if (s.lifesteal > 0) this.healPlayer(s.lifesteal);
        }
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
    if (s.triage > 0) c.triage = (c.triage ?? 0) + s.triage;
    c.energy += s.energy;
    if (s.heal > 0) this.healPlayer(s.heal, c.healTo);
    if (s.draw > 0) {
      const p = c.pendingPick;
      if (p?.kind === 'redraw') p.times += s.draw;
      else if (!p) c.pendingPick = { kind: 'redraw', source: card.uid, times: s.draw };
    }
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

  /** Cards in hand carrying an elite gene: they grow from what happens around them. */
  private handWith(gene: string): CardInstance[] {
    return this.combat?.hand.filter((h) => h.genes.includes(gene)) ?? [];
  }

  /** Grow every held card with this gene by n per copy of the gene (damage this fight). */
  private growInHand(gene: string, n: number) {
    const c = this.combat;
    if (!c) return;
    for (const h of this.handWith(gene)) {
      const copies = h.genes.filter((g) => g === gene).length;
      c.buffs.set(h.uid, (c.buffs.get(h.uid) ?? 0) + n * copies);
    }
  }

  /** Triage: a tagged death prints Clot Patches straight into the hand. They vanish when the fight ends. */
  private printPatches() {
    const c = this.combat;
    const n = c?.triage ?? 0;
    if (!c || n <= 0) return;
    for (let i = 0; i < n && c.hand.length < 10; i++) {
      const patch: CardInstance = { uid: this.nextUid++, defId: 'clot', genes: [], temp: true };
      c.hand.push(patch);
      const empty = LIMBS.findIndex((l, j) => !this.isDisabled(l) && !this.slotCard(j));
      if (empty >= 0) c.slots[empty] = patch.uid;
      this.emit({ type: 'printed', uid: patch.uid, defId: 'clot' });
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
    if (!c || !p || p.kind === 'redraw') return false;
    const target = c.hand.find((h) => h.uid === uid);
    const source = this.combatDeck.find((o) => o.uid === p.source);
    if (!target || !source || target === source) return false;
    c.pendingPick = null;
    if (p.kind === 'donor') {
      const stat: ImprintStat = this.displayStats(target).damage > 0 ? 'damage' : 'block';
      this.imprint(target, stat, 2 * p.times);
      const doses = (source.mem?.doses ?? 0) + 1;
      source.mem = { ...source.mem, doses };
      if (doses >= 3) this.consumeCard(source);
    } else if (p.kind === 'flask') {
      for (let i = 0; i < p.times; i++) this.mutate(target);
      this.consumeCard(source);
    } else {
      // take exactly what is printed on it right now, fight bonuses included
      const v = this.displayStats(target);
      this.consumeCard(target);
      if (v.damage > 0) this.imprint(source, 'damage', v.damage);
      if (v.block > 0) this.imprint(source, 'block', v.block);
      if (v.tag > 0) this.imprint(source, 'tag', v.tag);
    }
    if (c.victoryPending) this.endFightWhenResolved();
    return true;
  }

  skipPick(): void {
    const c = this.combat;
    if (!c) return;
    c.pendingPick = null;
    if (c.victoryPending) this.endFightWhenResolved();
  }

  /** Unstable: a free random gene, and one time in three a defect. */
  private mutate(card: CardInstance) {
    const { good, bad } = mutationsFor(card, this.displayStats(card));
    const pool = bad.length && this.rng.next() < 1 / 3 ? bad : good.length ? good : bad;
    if (!pool.length) return;
    const gene = this.rng.pick(pool);
    const def = cardDef(card);
    const targets = def.keywords?.includes('sibling')
      ? this.combatDeck.filter((o) => cardDef(o).keywords?.includes('sibling'))
      : [card];
    for (const t of targets) {
      t.genes = [...t.genes, gene.id];
      t.prefix = undefined;
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
        // reflected light goes straight through plating
        this.damagePlayer(back, true, this.combat?.acting ?? 'head');
        if (this.isDead) return dealt;
      }
    }
    if (e.hp <= 0) {
      e.hp = 0;
      e.alive = false;
      this.corpses.push({ uid: e.uid, defId: e.defId, biomass: def.biomass, tagged: e.status.tagged > 0, taken: false });
      this.emit({ type: 'enemyDie', uid: e.uid });
      if (e.status.tagged > 0) this.printPatches();
      this.growInHand('bloodlust', 3);
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
    this.chooseAim(e);
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
          this.damagePlayer(this.intentDamage(e), false, e.target ?? 'head');
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
  private damagePlayer(amount: number, pierce = false, limb: Limb = 'head') {
    const blocked = pierce ? 0 : Math.min(this.playerBlock, amount);
    const taken = amount - blocked;
    this.hitLimb(limb, taken, blocked);
    if (this.isDead) return;
    const c = this.combat;
    if (!c) return;
    if (taken > 0) {
      c.hurtRound = true;
      this.growInHand('painengine', 2);
      for (const card of c.hand) {
        if (card.defId === 'unscarred') c.held.delete(card.uid);
        if (card.defId === 'scartissue') {
          const others = this.combatDeck.filter((o) => o.uid !== card.uid);
          if (others.length) {
            const o = this.rng.pick(others);
            this.imprint(o, this.displayStats(o).damage > 0 ? 'damage' : 'block', 1);
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

  private damagePlayerRaw(amount: number, limb: Limb = 'head') {
    if (amount < 0) {
      this.healPlayer(-amount);
      return;
    }
    this.hitLimb(limb, amount, 0);
  }

  /**
   * Damage lands on a limb. A limb already gone passes it to the head. A limb that drops to 0 is torn off
   * (or, with Clinging Flesh, holds at 1), and what is left of the hit goes on to the head.
   */
  private hitLimb(limb: Limb, taken: number, blocked: number) {
    let l = limb;
    if (l !== 'head' && this.isDisabled(l)) l = 'head';
    this.emit({ type: 'playerHit', amount: taken, blocked, limb: l });
    if (taken <= 0) return;
    let rest = taken;
    if (l !== 'head') {
      const b = this.body[l];
      const floor = this.hasBoon('clinging') ? 1 : 0;
      const cut = Math.min(rest, Math.max(0, b.hp - floor));
      b.hp -= cut;
      rest -= cut;
      if (b.hp <= 0) this.loseLimb(l);
      if (rest <= 0) return;
    }
    this.body.head.hp -= rest;
    if (this.body.head.hp <= 0) this.die();
  }

  private loseLimb(l: Limb) {
    this.emit({ type: 'limbLost', limb: l });
    const c = this.combat;
    if (!c) return;
    const i = LIMBS.indexOf(l);
    const card = this.slotCard(i);
    if (card) {
      c.hand = c.hand.filter((h) => h !== card);
      c.discard.push(card);
    }
    c.slots[i] = null;
    for (const e of this.livingEnemies()) if (e.target === l) this.chooseAim(e);
  }

  private die() {
    if (this.hasBoon('heart') && !this.heartUsed) {
      this.heartUsed = true;
      this.body.head.hp = Math.ceil(this.body.head.max * 0.3);
      this.emit({ type: 'heal', amount: this.body.head.hp });
      this.emit({ type: 'whisper', text: 'Something behind your heart kicks once, hard. You are not done.' });
      return;
    }
    this.rememberHeirloom();
    this.body.head.hp = 0;
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
    if (this.segments[this.pos] && !this.secretFight) this.segments[this.pos].cleared = true;
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
    const y = this.corpseYield(k);
    this.healPlayer(this.hasBoon('carrion') ? Math.round(y * 1.5) : y);
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
    if (this.secretFight) {
      this.offers = [...this.rng.sample(SECRET_CARDS, 2), this.rng.pick(this.rewardPool())].map((defId) => ({ defId, deck: 'combat' as const }));
      this.gainBiomass(LAIR_BIOMASS);
      this.phase = 'reward';
      return;
    }
    const pool = seg?.elite && this.world ? WORLDS[this.world].cards : this.rewardPool();
    this.offers = this.draft(pool, 3).map((defId) => ({ defId, deck: 'combat' as const }));
    if (seg?.elite) this.gainBiomass(ELITE_BIOMASS);
    this.phase = 'reward';
  }

  /** Heal a chosen limb, or else the most damaged ones first (by share of their integrity). */
  private healPlayer(amount: number, limb?: Limb) {
    if (limb) {
      const got = this.healLimb(limb, amount);
      if (got > 0) this.emit({ type: 'heal', amount: got });
      return;
    }
    let left = amount;
    let total = 0;
    while (left > 0) {
      const hurt = LIMBS.filter((l) => this.body[l].hp < this.body[l].max);
      if (!hurt.length) break;
      const l = hurt.sort((a, b) => this.body[a].hp / this.body[a].max - this.body[b].hp / this.body[b].max)[0];
      const got = this.healLimb(l, left);
      left -= got;
      total += got;
    }
    if (total > 0) this.emit({ type: 'heal', amount: total });
  }

  /** Heal one limb; returns how much it took. A torn-off limb above 0 works again. */
  private healLimb(l: Limb, amount: number): number {
    const b = this.body[l];
    const was = b.hp <= 0;
    const got = Math.max(0, Math.min(amount, b.max - b.hp));
    b.hp += got;
    if (was && b.hp > 0) {
      this.emit({ type: 'limbBack', limb: l });
      this.message = `Your ${LIMB_NAME[l]} knits back together.`;
      if (this.combat) this.fillOne(LIMBS.indexOf(l));
    }
    return got;
  }

  /** A limb back mid-fight gets a card at once. */
  private fillOne(i: number) {
    const c = this.combat!;
    if (this.slotCard(i)) return;
    const card = this.drawFor(i);
    c.slots[i] = card ? card.uid : null;
    if (card) c.hand.push(card);
  }

  private payBiomass(amount: number) {
    if (amount <= 0) return;
    this.biomass -= amount;
    this.emit({ type: 'biomass', amount: -amount });
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
      body: this.body,
      limbGain: this.limbGain,
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
        ? {
          ...this.combat,
          buffs: [...this.combat.buffs.entries()],
          held: [...this.combat.held.entries()],
          plateBuffs: [...(this.combat.plateBuffs ?? new Map()).entries()],
        }
        : null,
      playerBlock: this.playerBlock,
      playerStatus: this.playerStatus,
      corpses: this.corpses,
      offers: this.offers,
      podIndex: this.podIndex,
      vat: this.vat,
      surgeryIndex: this.surgeryIndex,
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
      secret: this.secret,
      secretFight: this.secretFight,
      mapGates: this.mapGates,
      heartUsed: this.heartUsed,
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
      g.body = d.body;
      g.limbGain = d.limbGain ?? null;
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
      if (g.combat) {
        g.combat.held = new Map(d.combat.held ?? []);
        g.combat.plateBuffs = new Map(d.combat.plateBuffs ?? []);
      }
      g.relinkPiles();
      g.playerBlock = d.playerBlock;
      g.playerStatus = d.playerStatus;
      g.corpses = d.corpses;
      g.offers = d.offers;
      g.podIndex = d.podIndex;
      g.vat = d.vat ?? null;
      g.surgeryIndex = d.surgeryIndex ?? -1;
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
      g.secret = d.secret ?? null;
      g.secretFight = d.secretFight ?? null;
      g.mapGates = d.mapGates ?? {};
      g.heartUsed = d.heartUsed ?? false;
      g.events = [];
      return g;
    } catch {
      return null;
    }
  }
}
