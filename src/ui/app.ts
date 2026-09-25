import {
  GENES, MUTATIONS, applyMutation, applySurgery, cardDef, cardLevel, cardName, cardText, imprintTotal, isMedic, mutationAmount,
  healsChosenLimb, needsTarget, nextStep, surgeryOps,
} from '../core/cards';
import { LIMBS, LIMB_NAME, LIMB_SHORT, LIMB_TYPE, type Limb } from '../core/body';
import { ENEMIES } from '../core/enemies';
import { FORCE_COST, Game, RELIQUARY_PRICE, freshMeta, type GameEvent } from '../core/game';
import type { CardInstance, EnemyState, MapNode, Meta } from '../core/types';
import { BOONS, EVENTS, LOGS, MAP_ROWS, WORLDS, WORLD_ORDER } from '../core/worlds';
import { PASSAGE_SPREAD, Stage, enemySlot, passageSlot } from '../render/stage';
import { LAUNCH_MS } from '../render/stage';
import { cardArt, cardArtDefs, germArt } from './cardart';

/** How long a card takes to print into the hand, and the gap between cards. */
const PRINT_MS = 560;
const PRINT_STAGGER = 110;

const CLONE_KEY = 'reprint.clone';
const INTRO_KEY = 'reprint.introSeen';
const SAVE_KEY = 'reprint.save';
const META_KEY = 'reprint.meta';

function loadMeta(): Meta {
  try {
    const d = JSON.parse(store(META_KEY) ?? 'null');
    if (d && Array.isArray(d.boons) && Array.isArray(d.worldsCleared) && Array.isArray(d.logs)) {
      // Dense Marrow became Clinging Flesh when the body split into limbs
      d.boons = d.boons.map((b: string) => (b === 'marrow' ? 'clinging' : b)).filter((b: string) => BOONS[b]);
      return d;
    }
  } catch {
    /* fall through to a fresh meta */
  }
  return freshMeta();
}

function store(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pad = (n: number) => String(n).padStart(4, '0');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sheet = 'none' | 'intro' | 'decks';

/** Hold-to-inspect text for every effect and resource, keyed by data-hint. */
const HINTS: Record<string, string> = {
  integrity: 'Integrity — your health. Reach 0 and this clone stops for good. Nothing mends it but eating biomass.',
  biomass: 'Biomass — harvested from the dead. Eat it to heal, or spend it at a splice pod to evolve a card.',
  energy: 'Energy — spend it to play Tactics cards. Refills at the start of every combat turn.',
  oxygen: 'Oxygen — spend it to play Survey cards. Refills each time you act while exploring.',
  plate: 'Plating — cuts every single hit by its value and is not used up: with 5 plating, a 3×2 attack deals nothing and 7×2 deals 2×2. Works the same for enemies: hit plated foes hard, or Shatter it off. Clears at the start of the owner\'s next turn.',
  weak: 'Weaken — deals 25% less damage while it lasts. Fades by 1 each turn.',
  exposed: 'Exposed — takes 50% more damage from everything. Fades by 1 each turn.',
  tag: 'Tagged — kill it while tagged and its biomass yields double when harvested.',
  strength: 'Strength — adds flat damage to every attack this enemy makes. Never fades on its own.',
  cost: 'Cost — what this card needs to play: energy in a fight, oxygen while exploring.',
  genes: 'Genes — each dot is one splice. They stack without limit, but each one costs more biomass than the last.',
  resonance: 'Resonance — in Kessra, every 3rd card you play each turn resolves twice.',
  reflect: 'Reflect — while this enemy has plating, half of each hit you land comes back at you, straight through your own plating. Strip its plating first.',
  splits: 'Splits — the first time it dies, it breaks into two copies at half health.',
  allies: 'Chorus — gives every other enemy strength. Kill it first.',
  summon: 'Shed — calls another enemy into the fight.',
  biocost: 'Biomass price — paid every time you play this card. Not enough biomass, no play.',
  hold: 'Hold — stays in your hand at the end of your turn. It takes one of your draw slots.',
  sibling: 'Sibling — printed from one line. Every Imprint one copy gets, all copies get, and new copies arrive already grown.',
  unstable: 'Unstable — the result is random, and one time in three it is a defect.',
  body: 'Body — each limb has its own integrity. Arms and legs torn off at 0 (their slot goes dark until healed). The head at 0 is death. Tap a limb to see it.',
  slot: 'Empty slot — its deck has no card left to give this turn.',
  limblost: 'Torn off — this limb is at 0. Its cards cannot be used until it is healed above 0. Hits aimed at it land on the head.',
  aim: 'Target — the limb this enemy will strike. Hits on a torn-off limb land on the head instead.',
  surgerybay: 'Surgery bay — pay biomass to cut defects, elite drawbacks, negative scars and biomass prices out of your cards.',
  elite: 'Elite mutation — rare at splice pods. Stronger than any normal gene, and it always takes something back.',
  fleeting: 'Fleeting — printed during this fight. It is not part of your deck and is gone when the fight ends.',
  consume: 'Consume — removes a card from your deck for the rest of the run. Grief Engines remember every one.',
  imprint: 'Imprint — a permanent change this card earned in play. No limit. It stays for the whole run.',
  defect: 'Defect — a bad mutation from an Unstable effect. It stays, like any gene.',
  boons: 'Germline — permanent rewrites of your DNA, earned by killing a world boss. Every future clone is born with them. Ten to collect.',
  gate: 'Gateway — a door in the wall only a Pineal Gate lets you see. Behind it: rare cards at a price, a rare fight, a restoring vat, or a shortcut.',
  'node-fight': 'Fight — a short corridor with regular enemies at the end.',
  'node-elite': 'Elite — one tough enemy. Rewards a card from this world, plus biomass.',
  'node-locker': 'Locker — supplies. Bring a Plasma Cutter.',
  'node-pod': 'Splice pod — spend biomass to evolve your cards.',
  'node-event': 'Event — something strange. A choice, and a log that stays with you forever.',
  'node-boss': 'Boss — the heart of this world. Beat it for a permanent boon.',
  'node-hidden': 'Unknown — play Field Notes to see what waits down this passage.',
};

const NODE_GLYPH: Record<string, string> = {
  fight: '✕', elite: '✖', locker: '▣', pod: '◍', event: '✦', boss: '◉',
};
const NODE_NAME: Record<string, string> = {
  fight: 'Fight', elite: 'Elite', locker: 'Locker', pod: 'Splice pod', event: 'Event', boss: 'Boss',
};

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 10;

export class App {
  private game: Game;
  private stage: Stage;
  private selected: number | null = null;
  private sheet: Sheet = 'none';
  private spliceSel: number | null = null;
  private busy = false;
  private whisperTimer = 0;
  private hintTimer = 0;
  private pressTimer = 0;
  private pressStart: { x: number; y: number } | null = null;
  private suppressClick = false;

  private hud: HTMLElement;
  private sectorline: HTMLElement;
  private track: HTMLElement;
  private overlay: HTMLElement;
  private fx: HTMLElement;
  private whisper: HTMLElement;
  private dock: HTMLElement;
  private sheetEl: HTMLElement;
  private hintEl: HTMLElement;
  private mapEl: HTMLElement;
  private meta: Meta;
  /** The node map is a view-only overlay, opened on demand. */
  private mapOpen = false;
  /** When each card in hand started printing (performance.now), and the hand shown last time. */
  private printStart = new Map<number, number>();
  private lastHand = new Set<number>();

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <header class="hud"></header>
      <div class="sectorline"></div>
      <div class="track" aria-hidden="true"></div>
      <main class="stage">
        <canvas aria-label="Corridor view"></canvas>
        <div class="overlay"></div>
        <div class="overlay fx"></div>
        <div class="mapview" hidden></div>
        <p class="whisper" aria-live="polite"></p>
      </main>
      <section class="dock"></section>
      <div class="sheet" hidden></div>
      <div class="hintbubble" role="tooltip" aria-live="polite" hidden></div>
      ${cardArtDefs()}`;
    this.hud = root.querySelector('.hud')!;
    this.sectorline = root.querySelector('.sectorline')!;
    this.track = root.querySelector('.track')!;
    this.overlay = root.querySelector('.overlay')!;
    this.fx = root.querySelector('.fx')!;
    this.whisper = root.querySelector('.whisper')!;
    this.dock = root.querySelector('.dock')!;
    this.sheetEl = root.querySelector('.sheet')!;
    this.hintEl = root.querySelector('.hintbubble')!;
    this.mapEl = root.querySelector('.mapview')!;

    this.meta = loadMeta();
    const saved = store(SAVE_KEY);
    const resumed = saved ? Game.load(saved, this.meta) : null;
    const cloneNo = resumed?.cloneNo ?? (Number(store(CLONE_KEY) ?? '1') || 1);
    this.game = resumed ?? new Game(Date.now() >>> 0, cloneNo, this.meta);
    this.stage = new Stage(root.querySelector('canvas')!, this.game);
    if (!store(INTRO_KEY)) this.sheet = 'intro';

    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('pointerdown', (e) => this.onPressStart(e as PointerEvent));
    root.addEventListener('pointermove', (e) => this.onPressMove(e as PointerEvent));
    root.addEventListener('pointerup', () => this.cancelPress());
    root.addEventListener('pointercancel', () => this.cancelPress());
    root.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement).closest('[data-hint]')) e.preventDefault();
    });
    this.flush();
    this.render();
  }

  // ----------------------------------------------------- hold-to-inspect

  private onPressStart(e: PointerEvent) {
    this.hideHint();
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hint]');
    if (!el) return;
    this.pressStart = { x: e.clientX, y: e.clientY };
    clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => this.firePress(el), LONG_PRESS_MS);
  }

  private onPressMove(e: PointerEvent) {
    if (!this.pressStart) return;
    const dx = e.clientX - this.pressStart.x;
    const dy = e.clientY - this.pressStart.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) this.cancelPress();
  }

  private cancelPress() {
    clearTimeout(this.pressTimer);
    this.pressStart = null;
  }

  private firePress(el: HTMLElement) {
    if (!this.pressStart) return;
    const text = el.dataset.hint === 'card' ? this.cardHintText(Number(el.dataset.uid)) : HINTS[el.dataset.hint!];
    const { x, y } = this.pressStart;
    this.pressStart = null;
    if (!text) return;
    this.suppressClick = true;
    if ('vibrate' in navigator) navigator.vibrate(12);
    this.showHint(text, x, y);
  }

  /** Full rules of a card, for a long press on it. */
  private cardHintText(uid: number): string {
    const g = this.game;
    const card = g.findCard(uid) ?? g.combat?.hand.find((c) => c.uid === uid) ?? g.sHand.find((c) => c.uid === uid);
    if (!card) return '';
    const def = cardDef(card);
    const lines = cardText(card, g.displayStats(card));
    const kw = (def.keywords ?? []).map((k) => HINTS[k]).filter(Boolean);
    return `${cardName(card)} — ${lines.join(' ')}${kw.length ? '\n\n' + kw.join('\n') : ''}`;
  }

  private showHint(text: string, x: number, y: number) {
    const el = this.hintEl;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('on');
    requestAnimationFrame(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      el.style.left = `${Math.min(Math.max(x - w / 2, 12), window.innerWidth - w - 12)}px`;
      el.style.top = `${Math.max(y - h - 16, 8)}px`;
      el.classList.add('on');
    });
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hideHint(), 3200);
  }

  private hideHint() {
    if (this.hintEl.hidden) return;
    this.hintEl.classList.remove('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => {
      this.hintEl.hidden = true;
    }, 200);
  }

  // --------------------------------------------------------------- input

  private onClick(e: Event) {
    if (this.suppressClick) {
      this.suppressClick = false;
      e.preventDefault();
      return;
    }
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || this.busy) return;
    const act = el.dataset.act!;
    const uid = Number(el.dataset.uid);
    const g = this.game;

    switch (act) {
      case 'card': this.tapCard(uid); break;
      case 'foe': this.tapFoe(uid); break;
      case 'advance': this.selected = null; g.advance(); break;
      case 'force': g.force(); break;
      case 'pod': this.spliceSel = null; g.usePod(); break;
      case 'end': this.selected = null; g.endTurn(); break;
      case 'eat': g.consume(uid); break;
      case 'render': g.render(uid); break;
      case 'harvest-done': g.finishHarvest(); break;
      case 'offer': g.takeOffer(Number(el.dataset.i)); break;
      case 'skip': g.takeOffer(null); break;
      case 'splice-card': this.spliceSel = uid; break;
      case 'feed': g.feedVat(Math.min(Number(el.dataset.n), g.biomass)); break;
      case 'mutate': if (this.spliceSel !== null) g.mutateCard(this.spliceSel); this.spliceSel = null; break;
      case 'leave-pod': this.spliceSel = null; g.leavePod(); break;
      case 'surgery': this.spliceSel = null; g.useSurgery(); break;
      case 'op-card': this.spliceSel = uid; break;
      case 'op': if (this.spliceSel !== null) g.operate(this.spliceSel, el.dataset.op!); break;
      case 'leave-surgery': this.spliceSel = null; g.leaveSurgery(); break;
      case 'mod': g.chooseModifier(el.dataset.mod as 'biomass' | 'integrity' | 'energy'); break;
      case 'empower': g.empowerTarget(uid); break;
      case 'pick': g.pickCard(uid); break;
      case 'redraw-slot': g.pickSlot(Number(el.dataset.slot)); break;
      case 'limb': this.tapLimb(el.dataset.limb as Limb); break;
      case 'skip-pick': g.skipPick(); break;
      case 'world': g.chooseWorld(el.dataset.world!); break;
      case 'passage': this.selected = null; this.mapOpen = false; g.travel(Number(el.dataset.node)); break;
      case 'map': this.mapOpen = !this.mapOpen; break;
      case 'event-opt': g.chooseEventOption(Number(el.dataset.i)); break;
      case 'event-leave': g.leaveEvent(); break;
      case 'boon': g.chooseBoon(el.dataset.boon!); break;
      case 'gate': this.mapOpen = false; g.enterGate(); break;
      case 'secret-take': g.secretTake(Number(el.dataset.i)); break;
      case 'secret-vat': g.secretVat(); break;
      case 'secret-fight': g.secretFightStart(); break;
      case 'secret-skip': g.secretShortcut(); break;
      case 'secret-leave': g.leaveSecret(); break;
      case 'skip-empower': g.skipEmpower(); break;
      case 'decks': this.sheet = 'decks'; break;
      case 'close': this.sheet = 'none'; break;
      case 'wake': this.sheet = 'none'; store(INTRO_KEY, '1'); break;
      case 'how': this.sheet = 'intro'; break;
      case 'reprint': this.reprint(); return;
      default: return;
    }
    this.flush();
    this.render();
  }

  private tapCard(uid: number) {
    const g = this.game;
    if (g.phase === 'explore' || g.phase === 'map') {
      const card = g.sHand.find((c) => c.uid === uid);
      if (!card) return;
      if (this.selected === uid) {
        if (g.playSurvey(uid)) this.selected = null;
      } else {
        this.selected = uid;
        const reason = g.surveyPlayable(card);
        g.message = this.describe(card, reason) + (healsChosenLimb(card.defId) && !reason ? ' <strong>Tap a limb to heal it.</strong>' : '');
      }
      return;
    }
    if (g.phase === 'combat' && g.combat) {
      if (g.combat.pendingEmpower) return;
      const card = g.combat.hand.find((c) => c.uid === uid);
      if (!card) return;
      const multi = needsTarget(card) && g.livingEnemies().length > 1;
      if (this.selected === uid && !multi) {
        if (g.playCombat(uid)) this.selected = null;
      } else {
        this.selected = uid;
        const reason = g.combatPlayable(card);
        const ask = multi ? ' <strong>Tap an enemy.</strong>' : healsChosenLimb(card.defId) ? ' <strong>Tap a limb to heal it.</strong>' : '';
        g.message = this.describe(card, reason) + (reason ? '' : ask);
      }
    }
  }

  /** A limb segment: the target of a selected heal card, or where new integrity goes. */
  private tapLimb(l: Limb) {
    const g = this.game;
    if (g.phase === 'limb') {
      g.chooseLimbGain(l);
      return;
    }
    if (this.selected === null) {
      const b = g.body[l];
      g.message = `${LIMB_NAME[l]}: ${b.hp}/${b.max} integrity.${b.hp <= 0 ? ' Torn off — heal it to use it again.' : ''}`;
      return;
    }
    const uid = this.selected;
    if (g.phase === 'combat') {
      const card = g.combat?.hand.find((c) => c.uid === uid);
      if (card && healsChosenLimb(card.defId) && g.playCombat(uid, undefined, l)) this.selected = null;
    } else if (g.phase === 'explore' || g.phase === 'map') {
      const card = g.sHand.find((c) => c.uid === uid);
      if (card && healsChosenLimb(card.defId) && g.playSurvey(uid, l)) this.selected = null;
    }
  }

  private tapFoe(uid: number) {
    const g = this.game;
    if (g.phase !== 'combat' || g.combat?.pendingEmpower) return;
    if (this.selected !== null) {
      if (g.playCombat(this.selected, uid)) this.selected = null;
      return;
    }
    const e = g.combat?.enemies.find((x) => x.uid === uid);
    if (e) {
      const def = ENEMIES[e.defId];
      g.message = `<strong>${def.name}.</strong> <em>${def.flavor}</em>`;
    }
  }

  private describe(card: CardInstance, reason: string | null): string {
    const txt = cardText(card, this.game.displayStats(card)).join(' ');
    const tail = reason ? ` <strong>${reason}</strong>` : ' <em>Tap again to play.</em>';
    return `<strong>${esc(cardName(card))}</strong> — ${txt}${tail}`;
  }

  private reprint() {
    const next = this.game.cloneNo + 1;
    store(CLONE_KEY, String(next));
    this.game = new Game(Date.now() >>> 0, next, this.meta);
    this.stage.setGame(this.game);
    this.selected = null;
    this.sheet = 'none';
    this.mapOpen = false;
    this.flush();
    this.render();
  }

  // -------------------------------------------------------------- events

  private flush() {
    const events = this.game.drainEvents();
    if (events.length) void this.play(events);
  }

  private async play(events: GameEvent[]) {
    const paced = events.some((e) => e.type === 'enemyAct' || e.type === 'launch');
    if (paced) {
      this.busy = true;
      this.dock.classList.add('busy');
    }
    for (const e of events) {
      if (e.type === 'enemyAct') await sleep(420);
      if (e.type === 'launch') {
        this.stage.onEvent(e);
        this.overlay.innerHTML = '';
        await sleep(LAUNCH_MS);
        continue;
      }
      this.stage.onEvent(e);
      this.showEvent(e);
      if (paced && e.type === 'playerHit') await sleep(140);
    }
    if (paced) {
      await sleep(250);
      this.busy = false;
      this.dock.classList.remove('busy');
      this.render();
    }
  }

  private slotOf(uid: number): number | null {
    const g = this.game;
    const list = g.combat?.enemies ?? g.corpses;
    const i = list.findIndex((x) => x.uid === uid);
    return i < 0 ? null : enemySlot(i, list.length) * 100;
  }

  private float(text: string, cls: string, x: number, y: number) {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    this.fx.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  private showEvent(e: GameEvent) {
    switch (e.type) {
      case 'enemyHit': {
        const x = this.slotOf(e.uid);
        if (x !== null) {
          if (e.amount > 0) this.float(`${e.amount}`, 'dmg', x + (Math.random() - 0.5) * 8, 40);
          if (e.blocked > 0) this.float(`▢${e.blocked}`, 'block', x, 52);
        }
        break;
      }
      case 'playerHit':
        if (e.amount > 0) this.float(`−${e.amount}`, 'hurt', 50 + (Math.random() - 0.5) * 20, 62);
        if (e.blocked > 0) this.float(`▢ ${e.blocked} blocked`, 'block', 50, 72);
        break;
      case 'heal': this.float(`+${e.amount} integrity`, 'good', 50, 55); break;
      case 'biomass': this.float(`${e.amount > 0 ? '+' : '−'}${Math.abs(e.amount)} biomass`, 'bio', 50, 45); break;
      case 'block': this.float(`▢ +${e.amount}`, 'block', 50, 70); break;
      case 'splice': this.float('SPLICED', 'bio', 50, 30); break;
      case 'resonate': this.float('RESONANCE', 'res', 50, 34); break;
      case 'reflect': this.float(`REFLECTED ${e.amount}`, 'hurt', 50, 50); break;
      case 'summon': {
        const x = this.slotOf(e.uid);
        this.float('+1', 'res', x ?? 50, 30);
        break;
      }
      case 'empower': this.float(`+${e.amount} ARMED`, 'bio', 50, 40); break;
      case 'imprint':
        // the card reprints itself with its new line of code
        this.printStart.set(e.uid, performance.now());
        this.float(`IMPRINT ${e.label}`, e.amount < 0 ? 'hurt' : 'res', 50, 26);
        break;
      case 'consumed': this.float('CONSUMED', 'hurt', 50, 30); break;
      case 'limbLost': this.float(`${LIMB_NAME[e.limb].toUpperCase()} TORN OFF`, 'hurt', 50, 44); break;
      case 'limbBack': this.float(`${LIMB_NAME[e.limb].toUpperCase()} RESTORED`, 'good', 50, 44); break;
      case 'printed':
        this.printStart.set(e.uid, performance.now());
        this.float('+ CLOT PATCH', 'good', 50, 38);
        break;
      case 'whisper': this.say(e.text); break;
      case 'line': {
        const x = this.slotOf(e.uid);
        const el = document.createElement('div');
        el.className = 'speech';
        el.textContent = e.text.toLowerCase();
        el.style.left = `${x ?? 50}%`;
        el.style.top = '22%';
        this.fx.appendChild(el);
        setTimeout(() => el.remove(), 2700);
        break;
      }
      default: break;
    }
  }

  private say(text: string) {
    if (!text) return;
    this.whisper.textContent = text;
    this.whisper.classList.add('on');
    clearTimeout(this.whisperTimer);
    this.whisperTimer = window.setTimeout(() => this.whisper.classList.remove('on'), 4200);
  }

  // ------------------------------------------------------------- render

  private render() {
    this.renderHud();
    this.renderOverlay();
    this.renderDock();
    this.renderSheet();
    store(SAVE_KEY, this.game.serialize());
    store(META_KEY, JSON.stringify(this.meta));
  }

  private renderHud() {
    const g = this.game;
    const pct = Math.max(0, (g.hp / g.maxHp) * 100);
    const extras: string[] = [];
    if (g.phase === 'combat') {
      if (g.playerBlock > 0) extras.push(`<span class="stat plate" data-hint="plate">plate <b>${g.playerBlock}</b></span>`);
      if (g.playerStatus.weak > 0) extras.push(`<span class="stat bad" data-hint="weak">weak <b>${g.playerStatus.weak}</b></span>`);
      if (g.playerStatus.exposed > 0) extras.push(`<span class="stat bad" data-hint="exposed">exposed <b>${g.playerStatus.exposed}</b></span>`);
    }
    this.hud.innerHTML = `
      <div class="clone">#${pad(g.cloneNo)}<small>clone</small></div>
      <div class="meter">
        <div class="row"><span class="stat" data-hint="integrity">integrity <b>${g.hp}</b>/${g.maxHp}</span>${extras.join('')}</div>
        <div class="bar"><div class="fill" style="width:${pct}%"></div><div class="ticks" style="--seg:${Math.max(2, (10 / g.maxHp) * 100)}%"></div></div>
      </div>
      <div class="biomass" data-hint="biomass">biomass<b>${g.biomass}</b></div>`;
    const mods: string[] = [];
    if (g.modifiers.biomass) mods.push('<span class="mod">biomass +50%</span>');
    if (g.modifiers.integrity) mods.push('<span class="mod">+16 integrity</span>');
    if (g.modifiers.energy) mods.push('<span class="mod">+1 energy</span>');
    if (this.meta.boons.length) {
      mods.push(`<span class="mod boon" data-hint="boons">⧉ ${this.meta.boons.length}/10 germline</span>`);
    }
    const w = g.world ? WORLDS[g.world] : null;
    const where = w ? `${w.name} · depth ${g.depth} / ${MAP_ROWS}` : `lab · sector ${g.sectorNum} / 2`;
    this.sectorline.innerHTML = `<span>${where}</span><span class="mods">${mods.join('')}</span>`;
    if (g.phase === 'map') {
      this.track.innerHTML = Array.from({ length: MAP_ROWS + 1 }, (_, r) => {
        const cls = [r < g.depth ? 'done' : '', r === MAP_ROWS ? 'fight' : ''].filter(Boolean).join(' ');
        return `<i class="${cls}"></i>`;
      }).join('');
      return;
    }
    this.track.innerHTML = g.segments
      .map((s, i) => {
        const cls = [
          i < g.pos ? 'done' : '', i === g.pos ? 'here' : '',
          s.feature === 'enemies' && s.revealed ? 'fight' : '', !g.world && i === g.sector2Start ? 'edge' : '',
        ].filter(Boolean).join(' ');
        return `<i class="${cls}"></i>`;
      })
      .join('');
  }

  private renderOverlay() {
    const g = this.game;
    this.overlay.parentElement!.classList.toggle('fight', g.phase === 'combat' || g.phase === 'harvest');
    const showMap = this.mapOpen && !!g.map && (g.phase === 'map' || g.phase === 'explore');
    this.mapEl.hidden = !showMap;
    this.mapEl.innerHTML = showMap ? this.mapHtml() : '';
    if (g.phase === 'map') {
      this.overlay.classList.remove('crowd');
      // no passage buttons over the crash sequence
      this.overlay.innerHTML = this.busy ? '' : this.passagesHtml();
      return;
    }
    if (g.phase !== 'combat' || !g.combat) {
      this.overlay.innerHTML = '';
      return;
    }
    const n = g.combat.enemies.length;
    const sel = g.combat.hand.find((c) => c.uid === this.selected);
    const targeting = !!sel && needsTarget(sel) && !g.combatPlayable(sel);
    this.overlay.classList.toggle('crowd', n >= 3);
    this.overlay.innerHTML = g.combat.enemies
      .map((e, i) => this.foeHtml(e, enemySlot(i, n) * 100, 100 / (n + 0.5), targeting))
      .join('');
  }

  private mapHtml(): string {
    const g = this.game;
    const map = g.map!;
    const w = WORLDS[map.world];
    const reach = new Set(g.reachable().map((n) => n.id));
    const pos = (n: MapNode) => ({
      x: ((n.col + 0.5) / 4) * 100,
      y: 90 - (n.row / MAP_ROWS) * 80,
    });
    const lines: string[] = [];
    for (const n of map.nodes) {
      const a = pos(n);
      for (const id of n.next) {
        const m = map.nodes[id];
        const b = pos(m);
        const walked = n.visited && m.visited;
        const open = g.mapNode === n.id && reach.has(m.id);
        lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walked' : open ? 'open' : ''}" />`);
      }
    }
    const nodes = map.nodes.map((n) => {
      const p = pos(n);
      const hidden = n.hidden && !n.visited;
      const kind = hidden ? 'hidden' : n.kind;
      const cls = ['mnode', kind, reach.has(n.id) ? 'reach' : '', n.visited ? 'visited' : '', g.mapNode === n.id ? 'here' : '', n.flared ? 'flared' : '']
        .filter(Boolean).join(' ');
      const label = hidden ? 'Unknown' : NODE_NAME[n.kind];
      return `<span class="${cls}" data-hint="node-${kind}" role="img"
        style="left:${p.x}%;top:${p.y}%" aria-label="${label}">${hidden ? '?' : NODE_GLYPH[n.kind]}</span>`;
    }).join('');
    return `
      <div class="maptitle"><b>${w.name}</b> ${w.subtitle}</div>
      <button class="btn small mapclose" data-act="map">close map</button>
      <svg class="mapedges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      ${nodes}`;
  }

  /** Tappable tunnel mouths at a junction, lined up with the ones the stage draws. */
  private passagesHtml(): string {
    const paths = this.game.passages();
    const n = paths.length;
    const dirs = n === 1 ? ['ahead'] : n === 2 ? ['left', 'right'] : n === 3 ? ['left', 'middle', 'right'] : ['far left', 'left', 'right', 'far right'];
    const width = (PASSAGE_SPREAD / n) * 100;
    return paths.map((node, i) => {
      const hidden = node.hidden && !node.visited;
      const kind = hidden ? 'hidden' : node.kind;
      const name = hidden ? 'Unknown' : NODE_NAME[node.kind];
      return `
        <button class="passage ${kind} ${node.flared ? 'flared' : ''}" data-act="passage" data-node="${node.id}"
          style="left:${passageSlot(i, n) * 100}%;width:${width}%" aria-label="${dirs[i]}: ${name}">
          <span class="pdir">${dirs[i]}</span>
          <span class="pname" data-hint="node-${kind}">${name}</span>
        </button>`;
    }).join('');
  }

  private foeHtml(e: EnemyState, x: number, width: number, targeting: boolean): string {
    const g = this.game;
    const def = ENEMIES[e.defId];
    const intent = g.intentOf(e);
    const parts: string[] = [`<b>${intent.label}</b>`];
    if (intent.attack) {
      const hits = intent.hits && intent.hits > 1 ? `×${intent.hits}` : '';
      const dmg = g.intentDamage(e);
      const net = Math.max(0, dmg - g.playerBlock);
      const shown = net < dmg ? `<s>${dmg}</s>${net}` : `${dmg}`;
      parts.push(`<span class="atk${net === 0 ? ' nil' : ''}" data-hint="plate">${shown}${hits}</span>`);
      if (e.target) parts.push(`<span class="tgt" data-hint="aim">→ ${LIMB_SHORT[e.target]}</span>`);
    }
    if (intent.block) parts.push(`<span class="blk" data-hint="plate">▢${intent.block}</span>`);
    if (intent.strength) parts.push(`<span class="dbf" data-hint="strength">+${intent.strength} str</span>`);
    if (intent.weak) parts.push(`<span class="dbf" data-hint="weak">weaken ${intent.weak}</span>`);
    if (intent.exposed) parts.push(`<span class="dbf" data-hint="exposed">expose ${intent.exposed}</span>`);
    if (intent.allyStrength) parts.push(`<span class="dbf" data-hint="allies">+${intent.allyStrength} str allies</span>`);
    if (intent.summon) parts.push('<span class="dbf" data-hint="summon">summon</span>');
    const chips: string[] = [];
    if (def.reflect) chips.push(`<span class="tagchip reflect ${e.block ? '' : 'off'}" data-hint="reflect">REFLECT</span>`);
    if (def.splits && !e.split) chips.push('<span class="tagchip splits" data-hint="splits">SPLITS</span>');
    if (e.block) chips.push(`<span class="tagchip plate" data-hint="plate">▢${e.block}</span>`);
    if (e.status.tagged) chips.push('<span class="tagchip tag" data-hint="tag">TAGGED</span>');
    if (e.status.weak) chips.push(`<span class="tagchip weak" data-hint="weak">WEAK ${e.status.weak}</span>`);
    if (e.status.exposed) chips.push(`<span class="tagchip exp" data-hint="exposed">EXP ${e.status.exposed}</span>`);
    if (e.status.strength) chips.push(`<span class="tagchip str" data-hint="strength">STR ${e.status.strength}</span>`);
    return `
      <button class="foe ${e.alive ? '' : 'dead'} ${targeting && e.alive ? 'targetable' : ''}"
        data-act="foe" data-uid="${e.uid}" style="left:${x}%;width:${width}%"
        aria-label="${def.name}, ${e.hp} of ${e.maxHp} integrity">
        <span class="intent">${parts.join(' ')}</span>
        <span class="tagplate">
          <span class="name">${def.name}</span>
          <span class="hp"><span style="width:${(e.hp / e.maxHp) * 100}%"></span><em>${e.hp}/${e.maxHp}</em></span>
          ${chips.length ? `<span class="nums">${chips.join('')}</span>` : ''}
        </span>
      </button>`;
  }

  private cardHtml(
    card: CardInstance,
    opts: { big?: boolean; dim?: boolean; act?: string; extra?: string; print?: number } = {},
  ): string {
    const def = cardDef(card);
    const s = this.game.displayStats(card);
    const lvl = cardLevel(card);
    const buffed = this.game.combatBonus(card) > 0;
    const cls = [
      'card', def.deck, lvl > 0 ? 'evolved' : '', buffed ? 'buffed' : '', opts.big ? 'big' : '',
      this.selected === card.uid ? 'selected' : '', opts.dim ? 'dim' : '',
      opts.print !== undefined ? 'printing' : '', card.mem?.imprints ? 'imprinted' : '', isMedic(def.id) ? 'medic' : '',
      card.temp ? 'temp' : '',
    ].filter(Boolean).join(' ');
    // a card re-rendered mid-print carries on where it was (negative delay)
    const style = opts.print !== undefined ? `style="--pd:${Math.round(-opts.print)}ms"` : '';
    const genes = lvl > 0 ? `<span class="genes" data-hint="genes" title="${lvl} genes">${'<i></i>'.repeat(Math.min(lvl, 8))}</span>` : '';
    const flavor = opts.big ? `<span class="flavor">${esc(def.flavor)}</span>` : '';
    const imp = card.imprint;
    const marks = card.mem?.imprints ?? 0;
    const impParts = imp
      ? (['damage', 'block', 'tag'] as const)
        .filter((k) => imp[k])
        .map((k) => `${imp[k]! > 0 ? '+' : ''}${imp[k]}${k === 'damage' ? '⚔' : k === 'block' ? '▢' : '⌖'}`)
      : [];
    const defects = card.genes.filter((gid) => GENES[gid]?.defect).length;
    const imprint = marks || imprintTotal(card) || defects
      ? `<span class="imprint" data-hint="${defects ? 'defect' : 'imprint'}">${opts.big ? `${'|'.repeat(Math.min(marks, 8))}${marks > 8 ? `×${marks}` : ''} ` : '⟐'}${impParts.join(' ') || (defects ? 'DEFECT' : '')}</span>`
      : '';
    const kws = [...(def.keywords ?? []), ...(card.temp ? ['fleeting'] : [])]
      .map((k) => `<i class="kw" data-hint="${k}">${k}</i>`).join('');
    return `
      <button class="${cls}" data-act="${opts.act ?? 'card'}" data-uid="${card.uid}" data-hint="card" ${style} ${opts.extra ?? ''}>
        ${cardArt(def.id)}
        <span class="cost" data-hint="cost" aria-label="cost">${s.cost}</span>
        ${s.bioCost > 0 ? `<span class="biocost" data-hint="biocost" aria-label="costs ${s.bioCost} biomass">${s.bioCost}</span>` : ''}
        ${kws ? `<span class="kws">${kws}</span>` : ''}
        <span class="name">${esc(cardName(card))}</span>
        <span class="text">${cardText(card, s, !opts.big).filter((l) => !['Hold.', 'Sibling.', 'Unstable.'].includes(l)).join(' ')}</span>
        ${imprint}
        ${flavor}
        ${genes}
        <span class="kind">${def.deck === 'combat' ? 'tactic' : 'survey'}</span>
      </button>`;
  }

  private renderDock() {
    const g = this.game;
    if (g.phase === 'combat' && g.combat?.pendingEmpower) {
      this.dock.innerHTML = this.empowerHtml(g.combat.pendingEmpower.amount);
      return;
    }
    if (g.phase === 'combat' && g.combat?.pendingPick) {
      this.dock.innerHTML = this.pickHtml(g.combat.pendingPick.kind);
      return;
    }
    this.trackPrinting(
      g.phase === 'combat' ? (g.combat?.hand ?? []) : g.phase === 'map' || g.phase === 'explore' ? g.sHand : [],
    );
    let hand = '';
    let bar = '';
    if (g.phase === 'map') {
      hand = g.sHand.length
        ? g.sHand.map((c) => this.cardHtml(c, { dim: !!g.surveyPlayable(c), print: this.printFor(c.uid) })).join('')
        : '<p class="empty">no survey cards in hand</p>';
      const pips = Array.from({ length: g.maxOxygen }, (_, i) => `<i class="${i < g.oxygen ? 'on' : ''}"></i>`).join('');
      bar = `
        <div class="pips o2" data-hint="oxygen" aria-label="${g.oxygen} oxygen">${pips}<span>o₂</span></div>
        <button class="btn small" data-act="decks">decks</button>
        <button class="btn small cryo" data-act="map">${this.mapOpen ? 'close map' : 'map'}</button>
        <span class="spacer"></span>
        ${g.gateHere() && !this.mapOpen ? '<button class="btn gatebtn" data-act="gate" data-hint="gate" aria-label="gateway">⟁</button>' : ''}
        ${this.mapOpen || g.gateHere() ? '' : '<span class="maphint">tap a passage ▲</span>'}`;
    } else if (g.phase === 'explore') {
      hand = g.sHand.length
        ? g.sHand.map((c) => this.cardHtml(c, { dim: !!g.surveyPlayable(c), print: this.printFor(c.uid) })).join('')
        : '<p class="empty">no survey cards in hand</p>';
      const blocked = g.blocker();
      const pips = Array.from({ length: g.maxOxygen }, (_, i) => `<i class="${i < g.oxygen ? 'on' : ''}"></i>`).join('');
      bar = `
        <div class="pips o2" data-hint="oxygen" aria-label="${g.oxygen} oxygen">${pips}<span>o₂</span></div>
        <button class="btn small" data-act="decks">decks</button>
        ${g.world ? `<button class="btn small cryo" data-act="map">${this.mapOpen ? 'close' : 'map'}</button>` : ''}
        <span class="spacer"></span>
        ${g.canUsePod() ? '<button class="btn cryo" data-act="pod">splice</button>' : ''}
        ${g.canUseSurgery() ? '<button class="btn surgbtn" data-act="surgery" data-hint="surgerybay" aria-label="surgery bay">✂</button>' : ''}
        ${g.gateHere() ? '<button class="btn gatebtn" data-act="gate" data-hint="gate" aria-label="gateway">⟁</button>' : ''}
        ${blocked
          ? `<button class="btn primary danger" data-act="force">force −${FORCE_COST}</button>`
          : '<button class="btn primary" data-act="advance">advance ▲</button>'}`;
    } else if (g.phase === 'combat' && g.combat) {
      const c = g.combat;
      hand = this.slotsHtml((card) => this.cardHtml(card, { dim: !!g.combatPlayable(card), print: this.printFor(card.uid) }));
      const pips = Array.from({ length: c.energyCap }, (_, i) => `<i class="${i < c.energy ? 'on' : ''}"></i>`).join('');
      let res = '';
      if (g.world === 'kessra' || (g.hasBoon('resonant-core') && c.playedThisFight === 0)) {
        const next = g.resonates();
        const dots = g.world === 'kessra'
          ? Array.from({ length: 3 }, (_, i) => `<i class="${i < c.playedThisTurn % 3 ? 'on' : ''}"></i>`).join('')
          : '';
        res = `<div class="resonance ${next ? 'ready' : ''}" data-hint="resonance" aria-label="resonance">${dots}${next ? '<span>×2</span>' : ''}</div>`;
      }
      bar = `
        <div class="pips" data-hint="energy" aria-label="${c.energy} energy">${pips}<span>energy</span></div>
        ${res}
        ${res ? '' : `<div class="piles">draw ${c.draw.length}<br />used ${c.discard.length}</div>`}
        <span class="spacer"></span>
        <button class="btn primary" data-act="end">end turn</button>`;
    } else {
      hand = '<p class="empty">—</p>';
    }
    const showBody = g.phase === 'combat' || g.phase === 'explore' || g.phase === 'map';
    this.dock.innerHTML = `
      <p class="hint">${g.message || '&nbsp;'}</p>
      <div class="hand ${g.phase === 'combat' ? 'slots' : ''}">${hand}</div>
      ${showBody ? this.bodyBarHtml() : ''}
      <div class="bar">${bar}</div>`;
  }

  /** The five body slots, left leg to right leg, then any spare cards. */
  private slotsHtml(render: (card: CardInstance) => string): string {
    const g = this.game;
    const c = g.combat!;
    const out = LIMBS.map((l, i) => {
      const card = g.slotCard(i);
      if (card) return render(card);
      const lost = g.isDisabled(l);
      return `<div class="slot ${lost ? 'lost' : 'empty'}" data-hint="${lost ? 'limblost' : 'slot'}">
        ${limbIcon(LIMB_TYPE[l])}<span>${LIMB_SHORT[l]}</span>${lost ? '<i class="x">✕</i>' : ''}</div>`;
    });
    const spares = c.hand.filter((h) => g.slotOf(h.uid) < 0).map(render);
    return [...out, ...spares].join('');
  }

  /** One integrity bar in five segments, one per limb, under the slots. */
  private bodyBarHtml(): string {
    const g = this.game;
    const sel = this.selected;
    const healing = sel !== null && (() => {
      const card = g.combat?.hand.find((c) => c.uid === sel) ?? g.sHand.find((c) => c.uid === sel);
      return !!card && healsChosenLimb(card.defId);
    })();
    const aimed = new Map<Limb, number>();
    if (g.phase === 'combat') {
      for (const e of g.livingEnemies()) {
        if (e.target && g.intentDamage(e) > 0) aimed.set(e.target, (aimed.get(e.target) ?? 0) + 1);
      }
    }
    const segs = LIMBS.map((l) => {
      const b = g.body[l];
      const pct = Math.max(0, (b.hp / b.max) * 100);
      const cls = [b.hp <= 0 ? 'lost' : '', healing ? 'target' : '', aimed.has(l) ? 'aimed' : '', l === 'head' ? 'head' : ''].filter(Boolean).join(' ');
      return `<button class="seg ${cls}" data-act="limb" data-limb="${l}" aria-label="${LIMB_NAME[l]} ${b.hp} of ${b.max}">
        <span class="fill" style="width:${pct}%"></span>
        <b><i class="lbl">${LIMB_SHORT[l]}</i>${b.hp}<small>/${b.max}</small></b>
        ${aimed.has(l) ? `<i class="aim">◎${aimed.get(l)! > 1 ? aimed.get(l) : ''}</i>` : ''}
      </button>`;
    });
    return `<div class="bodybar" data-hint="body">${segs.join('')}</div>`;
  }

  /** Cards new to the hand start printing, one after another. */
  private trackPrinting(hand: CardInstance[]) {
    const now = performance.now();
    let k = 0;
    for (const c of hand) {
      if (!this.lastHand.has(c.uid)) this.printStart.set(c.uid, now + PRINT_STAGGER * k++);
    }
    this.lastHand = new Set(hand.map((c) => c.uid));
    for (const [uid, t] of this.printStart) if (now - t > PRINT_MS || !this.lastHand.has(uid)) this.printStart.delete(uid);
  }

  /** Milliseconds into its print (negative: still waiting), or undefined once printed. */
  private printFor(uid: number): number | undefined {
    const t = this.printStart.get(uid);
    if (t === undefined) return undefined;
    const elapsed = performance.now() - t;
    return elapsed > PRINT_MS ? undefined : elapsed;
  }

  private pickHtml(kind: 'donor' | 'flask' | 'cannibal' | 'redraw'): string {
    const g = this.game;
    if (kind === 'redraw') {
      const n = g.combat!.pendingPick!.times;
      const slots = LIMBS.map((l, i) => {
        const card = g.slotCard(i);
        if (g.isDisabled(l)) return `<div class="slot lost">${limbIcon(LIMB_TYPE[l])}<span>${LIMB_SHORT[l]}</span><i class="x">✕</i></div>`;
        if (card) return this.cardHtml(card, { act: 'redraw-slot', extra: `data-slot="${i}"` });
        return `<button class="slot empty" data-act="redraw-slot" data-slot="${i}">${limbIcon(LIMB_TYPE[l])}<span>${LIMB_SHORT[l]}</span></button>`;
      });
      return `
        <p class="hint"><strong>Choose a slot to redraw${n > 1 ? ` (${n} left)` : ''}.</strong> <em>Its card goes to the discard; a new one takes its place.</em></p>
        <div class="hand slots">${slots.join('')}</div>
        ${this.bodyBarHtml()}
        <div class="bar"><span class="spacer"></span><button class="btn" data-act="skip-pick">skip</button></div>`;
    }
    const cards = g.combat!.hand.map((c) => this.cardHtml(c, { act: 'pick' }));
    const ask = {
      donor: '<strong>Choose a card to receive the dose.</strong> <em>Imprint +2, for the rest of the run.</em>',
      flask: '<strong>Choose a card to mutate.</strong> <em>A free gene. One time in three, a defect.</em>',
      cannibal: '<strong>Choose a card to consume.</strong> <em>Gone for good. Its damage and plating become this card’s.</em>',
    }[kind as 'donor' | 'flask' | 'cannibal'];
    return `
      <p class="hint">${ask}</p>
      <div class="hand">${cards.join('')}</div>
      <div class="bar"><span class="spacer"></span><button class="btn" data-act="skip-pick">skip</button></div>`;
  }

  private empowerHtml(amount: number): string {
    const g = this.game;
    const cards = g.combat!.hand.map((c) => this.cardHtml(c, { act: 'empower' }));
    return `
      <p class="hint"><strong>Choose a card to empower.</strong> <em>+${amount} damage, for the rest of this fight.</em></p>
      <div class="hand">${cards.length ? cards.join('') : '<p class="empty">no other card to empower</p>'}</div>
      <div class="bar"><span class="spacer"></span><button class="btn" data-act="skip-empower">skip</button></div>`;
  }

  // -------------------------------------------------------------- sheets

  private renderSheet() {
    const g = this.game;
    let html = '';
    let full = false;
    if (g.phase === 'dead') {
      full = true;
      html = `
        <div class="eyebrow">signal lost · ${g.world ? `${WORLDS[g.world].name}, depth ${g.depth}` : `lab, section ${g.pos + 1}`}</div>
        <h2>integrity lost</h2>
        <p>Clone #${pad(g.cloneNo)} stops. Somewhere behind you, the printer hums and warms.
        The next one will remember a little of this. Not enough.</p>
        <div class="actions"><button class="btn primary" data-act="reprint">print #${pad(g.cloneNo + 1)}</button></div>`;
    } else if (g.phase === 'won') {
      full = true;
      html = this.endingHtml();
    } else if (g.phase === 'mainframe') {
      full = true;
      html = this.mainframeHtml();
    } else if (g.phase === 'boon') {
      full = true;
      html = this.boonHtml();
    } else if (g.phase === 'event') {
      html = this.eventHtml();
    } else if (g.phase === 'secret') {
      html = this.secretHtml();
    } else if (g.phase === 'modifier') {
      full = true;
      html = this.modifierHtml();
    } else if (this.sheet === 'intro') {
      full = true;
      html = `
        <div class="eyebrow">print complete · clone #${pad(g.cloneNo)}</div>
        <h2>reprint</h2>
        <p>You wake in a vat on a ship that should be empty. You are a copy of someone who died out here.
        So were the others. Walk the corridor. Find the signal.</p>
        <ul class="rules">
          <li><b class="s">survey</b>Blue cards cost oxygen. Plasma Cutter opens hatches, wreckage and lockers; others heal, light the dark and scout ahead.</li>
          <li><b class="c">tactics</b>Amber cards cost energy. Read what each enemy intends, then strike first.</li>
          <li><b class="b">biomass</b>Nothing heals you but what you kill. Eat it to mend, or render it to splice genes into your cards at a pod.</li>
          <li><b class="v">splice</b>Some cards reach further: empower another card in your hand, or turn the damage they deal straight into biomass.</li>
          <li><b class="w">worlds</b>Beat The First to reach the mainframe and crash-land on an alien world. Its boss grants a boon that every future clone keeps.</li>
        </ul>
        <div class="actions"><button class="btn primary" data-act="wake">wake up</button></div>`;
    } else if (this.sheet === 'decks') {
      html = `
        <h2>your decks</h2>
        <div class="decklist">
          <h3>tactics · ${g.combatDeck.length}</h3>
          <div class="grid">${g.combatDeck.map((c) => this.cardHtml(c, { act: 'none' })).join('')}</div>
          <h3>survey · ${g.surveyDeck.length}</h3>
          <div class="grid">${g.surveyDeck.map((c) => this.cardHtml(c, { act: 'none' })).join('')}</div>
          <h3>germline · ${this.meta.boons.length} / ${Object.keys(BOONS).length}</h3>
          <div class="germline">${Object.values(BOONS).map((b) => `
            <div class="germ ${this.meta.boons.includes(b.id) ? 'on' : ''}">
              <b>${this.meta.boons.includes(b.id) ? esc(b.name) : '— unsequenced —'}</b>
              <small>${this.meta.boons.includes(b.id) ? esc(b.text) : 'Kill a world boss to rewrite it.'}</small>
            </div>`).join('')}</div>
        </div>
        <div class="actions"><button class="btn small" data-act="how">how to play</button><button class="btn primary" data-act="close">close</button></div>`;
    } else if (g.phase === 'harvest') {
      html = this.harvestHtml();
    } else if (g.phase === 'reward' || g.phase === 'loot') {
      html = this.offerHtml();
    } else if (g.phase === 'splice') {
      html = this.spliceHtml();
    } else if (g.phase === 'surgery') {
      html = this.surgeryHtml();
    } else if (g.phase === 'limb') {
      html = `
        <div class="eyebrow">new tissue · +${g.limbGain?.amount} integrity</div>
        <h2>where does it grow?</h2>
        <p>Choose the limb that takes it. It raises that limb's maximum and heals it by the same amount — a torn-off limb comes back.</p>
        <div class="limbpick">${LIMBS.map((l) => `
          <button class="gene" data-act="limb" data-limb="${l}">
            ${limbIcon(LIMB_TYPE[l])}<b>${LIMB_NAME[l]}</b><span class="price">${g.body[l].hp}/${g.body[l].max}</span>
          </button>`).join('')}</div>`;
    }
    this.sheetEl.hidden = !html;
    this.sheetEl.classList.toggle('full', full);
    this.sheetEl.innerHTML = html;
  }

  private mainframeHtml(): string {
    const g = this.game;
    const cards = WORLD_ORDER.map((id) => {
      const w = WORLDS[id];
      const cleared = this.meta.worldsCleared.includes(id);
      const status = !w.playable ? 'signal lost' : cleared ? 'cleared' : 'reachable';
      return `
        <button class="card big world ${id} ${w.playable ? '' : 'locked'}" data-act="world" data-world="${id}" ${w.playable ? '' : 'disabled'}>
          <span class="status">${status}</span>
          <span class="name">${w.name}</span>
          <span class="sub">${w.subtitle}</span>
          <span class="text">${w.pitch}</span>
        </button>`;
    });
    return `
      <div class="eyebrow">the first is quiet · clone #${pad(g.cloneNo)}</div>
      <h2>mainframe online</h2>
      <p>Behind The First, a console still warm from its hands. Three coordinates, each one a seed-probe
      the project sent before the end. Pick one. The ship will not survive the landing.</p>
      <div class="offers">${cards.join('')}</div>`;
  }

  private eventHtml(): string {
    const g = this.game;
    const ev = EVENTS[g.eventId!];
    const log = `<blockquote class="log"><span>log recovered</span>${esc(LOGS[ev.log])}</blockquote>`;
    if (g.eventResult !== null) {
      return `
        <div class="eyebrow">${WORLDS[g.world!].name}</div>
        <h2>${ev.title.toLowerCase()}</h2>
        <p>${esc(g.eventResult)}</p>
        ${log}
        <div class="actions"><button class="btn primary" data-act="event-leave">walk on</button></div>`;
    }
    const opts = ev.options.map((o, i) => `
      <button class="gene evopt" data-act="event-opt" data-i="${i}">
        <b>${esc(o.label)}</b>
        <small>${esc(o.detail)}</small>
      </button>`);
    return `
      <div class="eyebrow">${WORLDS[g.world!].name}</div>
      <h2>${ev.title.toLowerCase()}</h2>
      <p>${esc(ev.text)}</p>
      <div class="evopts">${opts.join('')}</div>
      ${log}`;
  }

  private secretHtml(): string {
    const g = this.game;
    const where = g.secret?.from === 'map' && g.world ? WORLDS[g.world].name : 'lab ship';
    const leave = '<button class="btn" data-act="secret-leave">step back out</button>';
    switch (g.secret?.kind) {
      case 'reliquary': {
        const cards = g.offers.map((o, i) =>
          this.cardHtml({ uid: -1 - i, defId: o.defId, genes: [] }, { big: true, act: 'secret-take', extra: `data-i="${i}"` }));
        return `
          <div class="eyebrow">gateway · ${where} · reliquary</div>
          <h2>the reliquary</h2>
          <p>Prints the project never released, sealed in amber. The seal takes a price from whoever breaks it:
          <b>−${RELIQUARY_PRICE} maximum integrity</b>, for the rest of this run.</p>
          <div class="offers two">${cards.join('')}</div>
          <div class="actions">${leave}</div>`;
      }
      case 'lair':
        return `
          <div class="eyebrow">gateway · ${where} · lair</div>
          <h2>the hollow twin</h2>
          <p>A print from the batch before yours, left behind a door nobody else could see. It has been practising your moves.
          Kill it for sealed prints and a lot of biomass.</p>
          <div class="actions">${leave}<button class="btn primary danger" data-act="secret-fight">wake it</button></div>`;
      case 'vat':
        return `
          <div class="eyebrow">gateway · ${where} · vat room</div>
          <h2>a warm vat</h2>
          <p>Growth fluid, still circulating. Somebody kept this one running for you.</p>
          <div class="actions">${leave}<button class="btn primary" data-act="secret-vat">float · restore integrity</button></div>`;
      case 'shortcut':
        return `
          <div class="eyebrow">gateway · ${where} · fold</div>
          <h2>a fold in the ship</h2>
          <p>${g.secret.from === 'map'
            ? 'The cave bends back on itself here. Step through and a whole stretch of it is behind you, unwalked.'
            : 'Space is thin here. Step through and you come out in sector 2, past whatever sings at the end of this one.'}</p>
          <div class="actions">${leave}<button class="btn primary" data-act="secret-skip">step through</button></div>`;
      default:
        return '';
    }
  }

  private boonHtml(): string {
    const g = this.game;
    const w = WORLDS[g.world!];
    const cards = g.boonOffers.map((id) => {
      const b = BOONS[id];
      return `
        <button class="card big mod boon" data-act="boon" data-boon="${id}">
          ${germArt(id, b.glyph)}
          <span class="name">${b.name}</span>
          <span class="text">${b.text}</span>
          <span class="flavor">${b.flavor}</span>
        </button>`;
    });
    return `
      <div class="eyebrow">${w.name} is silent · germline ${this.meta.boons.length + 1} / ${Object.keys(BOONS).length}</div>
      <h2>rewrite the germline</h2>
      <p>The boss's lattice opens your sequence like a book. One line can be rewritten, and it is written into the printer
      itself: every clone after you is born with it. Choose one.</p>
      <div class="offers">${cards.join('')}</div>`;
  }

  private endingHtml(): string {
    const g = this.game;
    const w = g.world ? WORLDS[g.world] : null;
    const genes = [...g.combatDeck, ...g.surveyDeck].reduce((n, c) => n + c.genes.length, 0);
    const worldLogs = w ? Object.keys(LOGS).filter((k) => k.startsWith(w.id[0])) : [];
    const found = worldLogs.filter((k) => this.meta.logs.includes(k)).length;
    const boons = this.meta.boons.map((id) => BOONS[id]?.name).filter(Boolean).join(', ');
    return `
      <div class="eyebrow">world cleared · clone #${pad(g.cloneNo)}</div>
      <h2>${w ? w.endingTitle : 'the signal is closer'}</h2>
      <p>${w ? esc(w.ending) : ''}</p>
      ${w ? `<blockquote class="log"><span>log recovered</span>${esc(LOGS[w.bossLog])}</blockquote>` : ''}
      <p><em>Integrity ${g.hp}/${g.maxHp} · ${g.combatDeck.length + g.surveyDeck.length} cards · ${genes} genes ·
      logs ${found}/${worldLogs.length}${boons ? ` · boons: ${boons}` : ''}</em></p>
      <p><em>Mireth and Orun are still out there. Their signals come back in a later update.</em></p>
      <div class="actions"><button class="btn primary" data-act="reprint">print #${pad(g.cloneNo + 1)}</button></div>`;
  }

  private harvestHtml(): string {
    const g = this.game;
    const rows = g.corpses.map((k) => {
      const def = ENEMIES[k.defId];
      const y = g.corpseYield(k);
      return `
        <div class="corpse ${k.taken ? 'taken' : ''}">
          <div><b>${def.name}</b><small>${k.biomass} biomass${k.tagged ? ' · <span class="tag">tagged ×2</span>' : ''}</small></div>
          <button class="btn small cryo" data-act="eat" data-uid="${k.uid}" ${k.taken ? 'disabled' : ''}>eat<span>+${y} integrity</span></button>
          <button class="btn small" data-act="render" data-uid="${k.uid}" ${k.taken ? 'disabled' : ''}>render<span>+${y} biomass</span></button>
        </div>`;
    });
    const left = g.corpses.some((k) => !k.taken);
    return `
      <div class="eyebrow">quiet again · integrity ${g.hp}/${g.maxHp} · biomass ${g.biomass}</div>
      <h2>harvest</h2>
      <p>Eat to mend. Render to splice. Tagged prey yields double.</p>
      <div class="corpses">${rows.join('')}</div>
      <div class="actions"><button class="btn primary" data-act="harvest-done">${left ? 'leave the rest' : 'move on'}</button></div>`;
  }

  private offerHtml(): string {
    const g = this.game;
    const loot = g.phase === 'loot';
    const cards = g.offers.map((o, i) => {
      const fake: CardInstance = { uid: -1 - i, defId: o.defId, genes: [] };
      return this.cardHtml(fake, { big: true, act: 'offer', extra: `data-i="${i}"` });
    });
    return `
      <div class="eyebrow">${loot ? 'supply locker' : 'something in the remains'}</div>
      <h2>${loot ? 'take one' : 'new tactic'}</h2>
      <p>${loot ? 'Rations long gone. Tools remain.' : 'Its body remembers how it fought. Learn one move.'} Tap a card to add it to your deck.</p>
      <div class="offers">${cards.join('')}</div>
      <div class="actions"><button class="btn" data-act="skip">take nothing</button></div>`;
  }

  private modifierHtml(): string {
    const g = this.game;
    const opts: { key: 'biomass' | 'integrity' | 'energy'; glyph: string; name: string; text: string; flavor: string }[] = [
      { key: 'biomass', glyph: '◈', name: 'Bioreactor Graft', text: '+50% biomass from every kill and cache.', flavor: 'Your gut learns to keep more of what it takes.' },
      { key: 'integrity', glyph: '✚', name: 'Reinforced Chassis', text: '+16 max integrity, mended in full.', flavor: 'Denser bone. Thicker cabling. It should hold.' },
      { key: 'energy', glyph: '⚡', name: 'Auxiliary Cell', text: '+1 energy every turn, for the rest of the run.', flavor: 'A second heart, wired in wrong. It works anyway.' },
    ];
    const cards = opts.map((o) => `
      <button class="card big mod" data-act="mod" data-mod="${o.key}">
        <span class="glyph" aria-hidden="true">${o.glyph}</span>
        <span class="name">${o.name}</span>
        <span class="text">${o.text}</span>
        <span class="flavor">${o.flavor}</span>
      </button>`);
    return `
      <div class="eyebrow">the choir is silent · clone #${pad(g.cloneNo)}</div>
      <h2>you are not the first copy</h2>
      <p>Something in the wreck remembers how to improve a body. Choose what it changes in you.
      The choice holds for the rest of this run.</p>
      <div class="offers">${cards.join('')}</div>`;
  }

  private spliceHtml(): string {
    const g = this.game;
    const v = g.vat!;
    const targets = g.vatTargets();
    const amount = g.vatAmount();
    let effect: string;
    let next: string;
    let name: string;
    let drawback = '';
    if (v.elite) {
      const gene = GENES[v.effect];
      const price = g.vatElitePrice();
      name = gene.name;
      effect = `${gene.text}${gene.rule ? ` — ${gene.rule}` : ''}`;
      drawback = gene.drawback ? `<p class="drawback">price: ${gene.drawback}</p>` : '';
      next = amount ? 'Ready.' : `Needs ${price} biomass in the pool.`;
    } else {
      const m = MUTATIONS[v.effect];
      name = m.name;
      effect = amount ? m.label(amount) : `${m.label(m.base)} at ${m.min}`;
      const n = nextStep(m, v.pool);
      next = amount
        ? `${m.label(mutationAmount(m, n))} at ${n} (${n - v.pool} more)`
        : `Needs ${m.min} biomass (${m.min - v.pool} more)`;
    }
    const cap = v.elite ? g.vatElitePrice() : Math.max(nextStep(MUTATIONS[v.effect], v.pool), 10);
    const fill = Math.min(100, (v.pool / cap) * 100);
    const sel = targets.find((c) => c.uid === this.spliceSel);
    let preview = '<p class="podhint"><em>Choose the card to mutate.</em></p>';
    if (sel && amount) {
      const after: CardInstance = JSON.parse(JSON.stringify(sel));
      if (v.elite) {
        after.genes = [...after.genes, v.effect];
        after.prefix = undefined;
      } else applyMutation(after, MUTATIONS[v.effect], amount);
      preview = `<p class="podhint">becomes <em>${esc(cardName(after))}</em>: ${cardText(after).join(' ')}</p>`;
    } else if (sel) preview = `<p class="podhint"><em>${esc(cardName(sel))}</em> chosen. The pool is not strong enough yet.</p>`;
    const chunks = [1, 5, 10].map((n) =>
      `<button class="btn small feed" data-act="feed" data-n="${n}" ${g.biomass < 1 ? 'disabled' : ''}>+${n}</button>`).join('');
    const grid = targets.map((c) => {
      const html = this.cardHtml(c, { act: 'splice-card' });
      return this.spliceSel === c.uid ? html.replace('class="card', 'class="card selected') : html;
    });
    return `
      <div class="eyebrow">splice pod · <span class="bioline">${g.biomass} biomass left</span></div>
      <h2>${v.elite ? 'elite mutation' : 'mutate'}</h2>
      <div class="vat ${v.elite ? 'elite' : ''}">
        <div class="vatglass"><div class="vatfill" style="height:${fill}%"></div><b>${v.pool}</b></div>
        <div class="vatinfo">
          <span class="vatname">${esc(name)}</span>
          <span class="vateffect ${amount ? 'on' : ''}">${esc(effect)}</span>
          ${drawback}
          <small>${esc(next)}</small>
          <div class="chunks">${chunks}</div>
        </div>
      </div>
      <p class="podwarn">Biomass thrown in never comes back — even if you leave without mutating.</p>
      ${preview}
      <div class="grid">${grid.length ? grid.join('') : '<p>No card can take this mutation.</p>'}</div>
      <div class="actions">
        <button class="btn" data-act="leave-pod">${v.pool ? 'leave (pool lost)' : 'leave pod'}</button>
        <button class="btn primary" data-act="mutate" ${sel && amount ? '' : 'disabled'}>mutate</button>
      </div>`;
  }

  private surgeryHtml(): string {
    const g = this.game;
    const all = [...g.combatDeck, ...g.surveyDeck].filter((c) => surgeryOps(c).length);
    const sel = all.find((c) => c.uid === this.spliceSel);
    let ops = '<p class="podhint"><em>Choose a card to operate on.</em></p>';
    if (sel) {
      ops = surgeryOps(sel).map((o) => {
        const after: CardInstance = JSON.parse(JSON.stringify(sel));
        applySurgery(after, o.id);
        return `
          <button class="gene" data-act="op" data-op="${o.id}" ${o.price > g.biomass ? 'disabled' : ''}>
            <b>${esc(o.label)}</b><span class="price">${o.price}</span>
            <small>becomes <em>${esc(cardName(after))}</em>: ${cardText(after).join(' ')}</small>
          </button>`;
      }).join('');
    }
    const grid = all.map((c) => {
      const html = this.cardHtml(c, { act: 'op-card' });
      return this.spliceSel === c.uid ? html.replace('class="card', 'class="card selected') : html;
    });
    return `
      <div class="eyebrow">surgery bay · <span class="bioline">${g.biomass} biomass</span></div>
      <h2>cut it out</h2>
      <p>A sterile arm unfolds from the ceiling. It removes defects, elite drawbacks, scars and biomass prices — one cut at a time.</p>
      <div class="genebox">${ops}</div>
      <div class="grid">${grid.length ? grid.join('') : '<p>None of your cards has anything to cut out.</p>'}</div>
      <div class="actions"><button class="btn primary" data-act="leave-surgery">done</button></div>`;
  }
}

/** Simple ink drawings of a leg, an arm and a head, for slot placeholders. */
function limbIcon(type: 'leg' | 'arm' | 'head'): string {
  const d = {
    leg: 'M22 6 L26 30 L24 52 L34 56',
    arm: 'M10 16 Q24 12 30 24 L40 40 M40 40 l6 -2 M40 40 l4 5',
    head: 'M28 10 a12 13 0 1 1 -0.1 0 Z M22 25 h3 M31 25 h3 M24 32 q4 3 8 0',
  }[type];
  return `<svg class="limbicon" viewBox="0 0 56 60" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
