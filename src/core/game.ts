import {
  REWARD_COMBAT, REWARD_SURVEY, STARTER_COMBAT, STARTER_SURVEY,
  cardDef, cardStats, genesFor, needsTarget, splice, spliceCost,
} from './cards';
import { ENEMIES } from './enemies';
import { Rng } from './rng';
import type { CardInstance, Corpse, DeckKind, EnemyState, Intent, Segment, Statuses } from './types';

export type Phase = 'explore' | 'combat' | 'harvest' | 'reward' | 'loot' | 'splice' | 'dead' | 'won';

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
  | { type: 'splice'; uid: number };

export interface CombatState {
  enemies: EnemyState[];
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  energy: number;
  turn: number;
  ambush: boolean;
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

const freshStatus = (): Statuses => ({ weak: 0, exposed: 0, tagged: 0, strength: 0 });

const WHISPERS = [
  'The walls are warm. They should not be warm.',
  'Scratched into the panel: DON’T TRUST THE PRINTER.',
  'Your handwriting. You never wrote this.',
  'A heartbeat in the vents. Slower than yours.',
  'Somewhere ahead, someone hums your lullaby.',
  'Frost on the glass. Fingerprints on the inside.',
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

  constructor(seed: number, cloneNo = 1) {
    this.rng = new Rng(seed);
    this.cloneNo = cloneNo;
    this.combatDeck = STARTER_COMBAT.map((id) => this.makeCard(id));
    this.surveyDeck = STARTER_SURVEY.map((id) => this.makeCard(id));
    this.segments = this.buildCorridor();
    this.sDraw = this.rng.shuffle([...this.surveyDeck]);
    this.updateVisibility();
    this.newSurveyTurn();
    this.emit({ type: 'whisper', text: this.segments[0].whisper ?? '' });
  }

  // ------------------------------------------------------------------ setup

  private makeCard(defId: string): CardInstance {
    return { uid: this.nextUid++, defId, genes: [] };
  }

  private buildCorridor(): Segment[] {
    const seg = (feature: Segment['feature'], extra: Partial<Segment> = {}): Segment => ({
      feature, dark: false, lit: false, revealed: false, cleared: false, ...extra,
    });
    const whispers = this.rng.sample(WHISPERS, 3);
    return [
      seg('none', { whisper: `PRINT COMPLETE. CLONE #${String(this.cloneNo).padStart(4, '0')}. Walk.` }),
      seg('crate'),
      seg('enemies', { encounter: ['tick', 'tick'], whisper: 'Clicking. Many small legs.' }),
      seg('debris', { whisper: whispers[0] }),
      seg('pod', { whisper: 'A splice pod. It still remembers how to rewrite you.' }),
      seg('door', { dark: true }),
      seg('enemies', { encounter: ['copy', 'husk'], dark: true, whisper: 'It has your face. Almost.' }),
      seg('crate', { whisper: whispers[1] }),
      seg('none', { whisper: whispers[2] }),
      seg('pod', { whisper: 'Another pod. The liquid is the wrong color.' }),
      seg('door'),
      seg('enemies', { encounter: ['choir'], whisper: 'Singing. In your voice. In all of them.' }),
      seg('exit'),
    ];
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
      case 'exit': return 'Light. Real light. Keep walking.';
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
    if (here.feature === 'exit') {
      this.phase = 'won';
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

  private light(range: number, exposed: number) {
    for (let i = this.pos + 1; i <= this.pos + range && i < this.segments.length; i++) {
      const seg = this.segments[i];
      seg.lit = true;
      seg.revealed = true;
      if (exposed > 0) seg.flareExposed = (seg.flareExposed ?? 0) + exposed;
    }
  }

  // ----------------------------------------------------------------- loot

  private openLoot() {
    const combat = this.rng.sample(REWARD_COMBAT, 2).map((defId) => ({ defId, deck: 'combat' as const }));
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
      if (offer.deck === 'combat') this.combatDeck.push(card);
      else {
        this.surveyDeck.push(card);
        this.sDiscard.push(card);
      }
    }
    this.offers = [];
    const wasReward = this.phase === 'reward';
    this.phase = 'explore';
    if (wasReward) this.newSurveyTurn();
    else this.message = this.exploreHint();
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
      turn: 0,
      ambush,
    };
    this.playerStatus = freshStatus();
    this.corpses = [];
    this.phase = 'combat';
    this.startPlayerTurn();
    this.message = ambush
      ? 'AMBUSH. They were waiting in the dark. −1 energy this turn.'
      : 'Tap a card, then tap it again to play.';
  }

  intentOf(e: EnemyState): Intent {
    const p = ENEMIES[e.defId].pattern;
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
    c.turn++;
    this.playerBlock = 0;
    c.energy = MAX_ENERGY - (c.ambush && c.turn === 1 ? 1 : 0);
    this.drawCombat(COMBAT_HAND);
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
    return null;
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
    let targets: EnemyState[] = [];
    if (s.aoe) targets = living;
    else if (needsTarget(card)) {
      const t = living.find((e) => e.uid === targetUid) ?? (living.length === 1 ? living[0] : undefined);
      if (!t) {
        this.message = 'Choose a target.';
        return false;
      }
      targets = [t];
    }

    c.energy -= s.cost;
    c.hand = c.hand.filter((h) => h !== card);
    c.discard.push(card);

    if (s.block > 0) {
      this.playerBlock += s.block;
      this.emit({ type: 'block', amount: s.block });
    }
    for (const t of targets) {
      for (let h = 0; h < s.hits && t.alive; h++) {
        const dmg = this.scale(s.damage + this.playerStatus.strength, this.playerStatus.weak > 0, t.status.exposed > 0);
        this.damageEnemy(t, dmg);
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
    c.energy += s.energy;
    if (s.draw > 0) this.drawCombat(s.draw);
    this.message = '';

    if (this.livingEnemies().length === 0) this.winCombat();
    return true;
  }

  private damageEnemy(e: EnemyState, amount: number) {
    if (amount <= 0) return;
    const blocked = Math.min(e.block, amount);
    e.block -= blocked;
    e.hp -= amount - blocked;
    this.emit({ type: 'enemyHit', uid: e.uid, amount: amount - blocked, blocked });
    if (e.hp <= 0) {
      e.hp = 0;
      e.alive = false;
      const def = ENEMIES[e.defId];
      this.corpses.push({ uid: e.uid, defId: e.defId, biomass: def.biomass, tagged: e.status.tagged > 0, taken: false });
      this.emit({ type: 'enemyDie', uid: e.uid });
    }
  }

  endTurn(): void {
    const c = this.combat;
    if (!c || this.phase !== 'combat') return;
    c.discard.push(...c.hand);
    c.hand = [];
    this.tickStatus(this.playerStatus);

    for (const e of c.enemies) {
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

  private damagePlayer(amount: number) {
    const blocked = Math.min(this.playerBlock, amount);
    this.playerBlock -= blocked;
    const taken = amount - blocked;
    this.hp -= taken;
    this.emit({ type: 'playerHit', amount: taken, blocked });
    if (this.hp <= 0) this.die();
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
    this.offers = this.rng.sample(REWARD_COMBAT, 3).map((defId) => ({ defId, deck: 'combat' as const }));
    this.phase = 'reward';
  }

  private healPlayer(amount: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) this.emit({ type: 'heal', amount: this.hp - before });
  }

  private gainBiomass(amount: number) {
    this.biomass += amount;
    this.emit({ type: 'biomass', amount });
  }

  // ------------------------------------------------------------ helpers

  get isDead(): boolean {
    return this.phase === 'dead';
  }

  get progress(): number {
    return this.pos / (this.segments.length - 1);
  }
}
