import { GENES, cardDef, cardLevel, cardName, cardStats, cardText, needsTarget, splice, spliceCost } from '../core/cards';
import { ENEMIES } from '../core/enemies';
import { FORCE_COST, Game, MAX_OXYGEN, type GameEvent } from '../core/game';
import type { CardInstance, DeckKind, EnemyState } from '../core/types';
import { Stage, enemySlot } from '../render/stage';

const CLONE_KEY = 'reprint.clone';
const INTRO_KEY = 'reprint.introSeen';

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
  plate: 'Plating — absorbs damage before it reaches integrity. Clears at the start of your next turn.',
  weak: 'Weaken — deals 25% less damage while it lasts. Fades by 1 each turn.',
  exposed: 'Exposed — takes 50% more damage from everything. Fades by 1 each turn.',
  tag: 'Tagged — kill it while tagged and its biomass yields double when harvested.',
  strength: 'Strength — adds flat damage to every attack this enemy makes. Never fades on its own.',
  cost: 'Cost — what this card needs to play: energy in a fight, oxygen while exploring.',
  genes: 'Genes — each dot is one splice. They stack without limit, but each one costs more biomass than the last.',
};

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 10;

export class App {
  private game: Game;
  private stage: Stage;
  private selected: number | null = null;
  private sheet: Sheet = 'none';
  private spliceSel: number | null = null;
  private spliceTab: DeckKind = 'combat';
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

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <header class="hud"></header>
      <div class="sectorline"></div>
      <div class="track" aria-hidden="true"></div>
      <main class="stage">
        <canvas aria-label="Corridor view"></canvas>
        <div class="overlay"></div>
        <div class="overlay fx"></div>
        <p class="whisper" aria-live="polite"></p>
      </main>
      <section class="dock"></section>
      <div class="sheet" hidden></div>
      <div class="hintbubble" role="tooltip" aria-live="polite" hidden></div>`;
    this.hud = root.querySelector('.hud')!;
    this.sectorline = root.querySelector('.sectorline')!;
    this.track = root.querySelector('.track')!;
    this.overlay = root.querySelector('.overlay')!;
    this.fx = root.querySelector('.fx')!;
    this.whisper = root.querySelector('.whisper')!;
    this.dock = root.querySelector('.dock')!;
    this.sheetEl = root.querySelector('.sheet')!;
    this.hintEl = root.querySelector('.hintbubble')!;

    const cloneNo = Number(store(CLONE_KEY) ?? '1') || 1;
    this.game = new Game(Date.now() >>> 0, cloneNo);
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
    const text = HINTS[el.dataset.hint!];
    const { x, y } = this.pressStart;
    this.pressStart = null;
    if (!text) return;
    this.suppressClick = true;
    if ('vibrate' in navigator) navigator.vibrate(12);
    this.showHint(text, x, y);
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
      case 'gene': if (this.spliceSel !== null) g.spliceCard(this.spliceSel, el.dataset.gene!); break;
      case 'tab': this.spliceTab = el.dataset.deck as DeckKind; this.spliceSel = null; break;
      case 'leave-pod': g.leavePod(); break;
      case 'mod': g.chooseModifier(el.dataset.mod as 'biomass' | 'integrity' | 'energy'); break;
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
    if (g.phase === 'explore') {
      const card = g.sHand.find((c) => c.uid === uid);
      if (!card) return;
      if (this.selected === uid) {
        if (g.playSurvey(uid)) this.selected = null;
      } else {
        this.selected = uid;
        g.message = this.describe(card, g.surveyPlayable(card));
      }
      return;
    }
    if (g.phase === 'combat' && g.combat) {
      const card = g.combat.hand.find((c) => c.uid === uid);
      if (!card) return;
      const multi = needsTarget(card) && g.livingEnemies().length > 1;
      if (this.selected === uid && !multi) {
        if (g.playCombat(uid)) this.selected = null;
      } else {
        this.selected = uid;
        const reason = g.combatPlayable(card);
        g.message = this.describe(card, reason) + (multi && !reason ? ' <strong>Tap an enemy.</strong>' : '');
      }
    }
  }

  private tapFoe(uid: number) {
    const g = this.game;
    if (g.phase !== 'combat') return;
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
    const txt = cardText(card).join(' ');
    const tail = reason ? ` <strong>${reason}</strong>` : ' <em>Tap again to play.</em>';
    return `<strong>${esc(cardName(card))}</strong> — ${txt}${tail}`;
  }

  private reprint() {
    const next = this.game.cloneNo + 1;
    store(CLONE_KEY, String(next));
    this.game = new Game(Date.now() >>> 0, next);
    this.stage.setGame(this.game);
    this.selected = null;
    this.sheet = 'none';
    this.flush();
    this.render();
  }

  // -------------------------------------------------------------- events

  private flush() {
    const events = this.game.drainEvents();
    if (events.length) void this.play(events);
  }

  private async play(events: GameEvent[]) {
    const paced = events.some((e) => e.type === 'enemyAct');
    if (paced) {
      this.busy = true;
      this.dock.classList.add('busy');
    }
    for (const e of events) {
      if (e.type === 'enemyAct') await sleep(420);
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
      case 'biomass': this.float(`+${e.amount} biomass`, 'bio', 50, 45); break;
      case 'block': this.float(`▢ +${e.amount}`, 'block', 50, 70); break;
      case 'splice': this.float('SPLICED', 'bio', 50, 30); break;
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
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>
      <div class="biomass" data-hint="biomass">biomass<b>${g.biomass}</b></div>`;
    const mods: string[] = [];
    if (g.modifiers.biomass) mods.push('<span class="mod">biomass +50%</span>');
    if (g.modifiers.integrity) mods.push('<span class="mod">+16 integrity</span>');
    if (g.modifiers.energy) mods.push('<span class="mod">+1 energy</span>');
    this.sectorline.innerHTML = `<span>sector ${g.sectorNum} / 2</span><span class="mods">${mods.join('')}</span>`;
    this.track.innerHTML = g.segments
      .map((s, i) => {
        const cls = [
          i < g.pos ? 'done' : '', i === g.pos ? 'here' : '',
          s.feature === 'enemies' && s.revealed ? 'fight' : '', i === g.sector2Start ? 'edge' : '',
        ].filter(Boolean).join(' ');
        return `<i class="${cls}"></i>`;
      })
      .join('');
  }

  private renderOverlay() {
    const g = this.game;
    this.overlay.parentElement!.classList.toggle('fight', g.phase === 'combat' || g.phase === 'harvest');
    if (g.phase !== 'combat' || !g.combat) {
      this.overlay.innerHTML = '';
      return;
    }
    const n = g.combat.enemies.length;
    const sel = g.combat.hand.find((c) => c.uid === this.selected);
    const targeting = !!sel && needsTarget(sel) && !g.combatPlayable(sel);
    this.overlay.innerHTML = g.combat.enemies
      .map((e, i) => this.foeHtml(e, enemySlot(i, n) * 100, 100 / (n + 0.5), targeting))
      .join('');
  }

  private foeHtml(e: EnemyState, x: number, width: number, targeting: boolean): string {
    const g = this.game;
    const def = ENEMIES[e.defId];
    const intent = g.intentOf(e);
    const parts: string[] = [`<b>${intent.label}</b>`];
    if (intent.attack) {
      const hits = intent.hits && intent.hits > 1 ? `×${intent.hits}` : '';
      parts.push(`<span class="atk">${g.intentDamage(e)}${hits}</span>`);
    }
    if (intent.block) parts.push(`<span class="blk" data-hint="plate">▢${intent.block}</span>`);
    if (intent.strength) parts.push(`<span class="dbf" data-hint="strength">+${intent.strength} str</span>`);
    if (intent.weak) parts.push(`<span class="dbf" data-hint="weak">weaken ${intent.weak}</span>`);
    if (intent.exposed) parts.push(`<span class="dbf" data-hint="exposed">expose ${intent.exposed}</span>`);
    const chips: string[] = [`<span>${e.hp}/${e.maxHp}</span>`];
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
        <span class="name">${def.name}</span>
        <span class="hp"><span style="width:${(e.hp / e.maxHp) * 100}%"></span></span>
        <span class="nums">${chips.join('')}</span>
      </button>`;
  }

  private cardHtml(card: CardInstance, opts: { big?: boolean; dim?: boolean; act?: string; extra?: string } = {}): string {
    const def = cardDef(card);
    const s = cardStats(card);
    const lvl = cardLevel(card);
    const cls = [
      'card', def.deck, lvl > 0 ? 'evolved' : '', opts.big ? 'big' : '',
      this.selected === card.uid ? 'selected' : '', opts.dim ? 'dim' : '',
    ].filter(Boolean).join(' ');
    const genes = lvl > 0 ? `<span class="genes" data-hint="genes" title="${lvl} genes">${'<i></i>'.repeat(Math.min(lvl, 8))}</span>` : '';
    const flavor = opts.big ? `<span class="flavor">${esc(def.flavor)}</span>` : '';
    return `
      <button class="${cls}" data-act="${opts.act ?? 'card'}" data-uid="${card.uid}" ${opts.extra ?? ''}>
        <span class="cost" data-hint="cost" aria-label="cost">${s.cost}</span>
        <span class="glyph" aria-hidden="true">${def.glyph}</span>
        <span class="name">${esc(cardName(card))}</span>
        <span class="text">${cardText(card).join(' ')}</span>
        ${flavor}
        ${genes}
        <span class="kind">${def.deck === 'combat' ? 'tactic' : 'survey'}</span>
      </button>`;
  }

  private renderDock() {
    const g = this.game;
    let hand = '';
    let bar = '';
    if (g.phase === 'explore') {
      hand = g.sHand.length
        ? g.sHand.map((c) => this.cardHtml(c, { dim: !!g.surveyPlayable(c) })).join('')
        : '<p class="empty">no survey cards in hand</p>';
      const blocked = g.blocker();
      const pips = Array.from({ length: MAX_OXYGEN }, (_, i) => `<i class="${i < g.oxygen ? 'on' : ''}"></i>`).join('');
      bar = `
        <div class="pips o2" data-hint="oxygen" aria-label="${g.oxygen} oxygen">${pips}<span>o₂</span></div>
        <button class="btn small" data-act="decks">decks</button>
        <span class="spacer"></span>
        ${g.canUsePod() ? '<button class="btn cryo" data-act="pod">splice</button>' : ''}
        ${blocked
          ? `<button class="btn primary danger" data-act="force">force −${FORCE_COST}</button>`
          : '<button class="btn primary" data-act="advance">advance ▲</button>'}`;
    } else if (g.phase === 'combat' && g.combat) {
      const c = g.combat;
      hand = c.hand.length
        ? c.hand.map((card) => this.cardHtml(card, { dim: !!g.combatPlayable(card) })).join('')
        : '<p class="empty">hand empty</p>';
      const pips = Array.from({ length: c.energyCap }, (_, i) => `<i class="${i < c.energy ? 'on' : ''}"></i>`).join('');
      bar = `
        <div class="pips" data-hint="energy" aria-label="${c.energy} energy">${pips}<span>energy</span></div>
        <div class="piles">draw ${c.draw.length}<br />used ${c.discard.length}</div>
        <span class="spacer"></span>
        <button class="btn primary" data-act="end">end turn</button>`;
    } else {
      hand = '<p class="empty">—</p>';
    }
    this.dock.innerHTML = `
      <p class="hint">${g.message || '&nbsp;'}</p>
      <div class="hand">${hand}</div>
      <div class="bar">${bar}</div>`;
  }

  // -------------------------------------------------------------- sheets

  private renderSheet() {
    const g = this.game;
    let html = '';
    let full = false;
    if (g.phase === 'dead') {
      full = true;
      html = `
        <div class="eyebrow">signal lost · section ${g.pos + 1} of ${g.segments.length}</div>
        <h2>integrity lost</h2>
        <p>Clone #${pad(g.cloneNo)} stops. Somewhere behind you, the printer hums and warms.
        The next one will remember a little of this. Not enough.</p>
        <div class="actions"><button class="btn primary" data-act="reprint">print #${pad(g.cloneNo + 1)}</button></div>`;
    } else if (g.phase === 'won') {
      full = true;
      html = `
        <div class="eyebrow">the first is quiet · clone #${pad(g.cloneNo)}</div>
        <h2>the signal is closer</h2>
        <p>It falls the way a building falls. Beyond it, a window, and stars that were never on any chart.
        The signal pulses once, like a heartbeat. It knows your name. Both of them.</p>
        <p><em>End of the vertical slice. Integrity ${g.hp}/${g.maxHp}, ${g.combatDeck.length + g.surveyDeck.length} cards,
        ${[...g.combatDeck, ...g.surveyDeck].reduce((n, c) => n + c.genes.length, 0)} genes spliced.</em></p>
        <div class="actions"><button class="btn primary" data-act="reprint">print again</button></div>`;
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
          <li><b class="s">survey</b>Blue cards cost oxygen. They open hatches, cut wreckage, light the dark and pry lockers.</li>
          <li><b class="c">tactics</b>Amber cards cost energy. Read what each enemy intends, then strike first.</li>
          <li><b class="b">biomass</b>Nothing heals you but what you kill. Eat it to mend, or render it to splice genes into your cards at a pod.</li>
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
        </div>
        <div class="actions"><button class="btn small" data-act="how">how to play</button><button class="btn primary" data-act="close">close</button></div>`;
    } else if (g.phase === 'harvest') {
      html = this.harvestHtml();
    } else if (g.phase === 'reward' || g.phase === 'loot') {
      html = this.offerHtml();
    } else if (g.phase === 'splice') {
      html = this.spliceHtml();
    }
    this.sheetEl.hidden = !html;
    this.sheetEl.classList.toggle('full', full);
    this.sheetEl.innerHTML = html;
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
    const deck = this.spliceTab === 'combat' ? g.combatDeck : g.surveyDeck;
    const grid = deck.map((c) => {
      const html = this.cardHtml(c, { act: 'splice-card' });
      return this.spliceSel === c.uid ? html.replace('class="card', 'class="card selected') : html;
    });
    let genebox = '<p><em>Tap a card below to see which genes will bond with it.</em></p>';
    const card = this.spliceSel !== null ? g.findCard(this.spliceSel) : undefined;
    if (card) {
      const offers = g.offersFor(card.uid);
      const rows = offers.map((id) => {
        const gene = GENES[id];
        const cost = spliceCost(card, id);
        const after = splice(card, id);
        return `
          <button class="gene" data-act="gene" data-gene="${id}" ${cost > g.biomass ? 'disabled' : ''}>
            <b>${gene.name} · ${gene.text}</b><span class="price">${cost}</span>
            <small>becomes <em>${esc(cardName(after))}</em>: ${cardText(after).join(' ')}</small>
          </button>`;
      });
      genebox = `
        <div class="genebox">
          <h3>${esc(cardName(card))} · level ${cardLevel(card)}</h3>
          ${rows.length ? rows.join('') : '<p>No gene will bond with this card.</p>'}
        </div>`;
    }
    return `
      <div class="eyebrow">splice pod · <span class="bioline">${g.biomass} biomass</span></div>
      <h2>evolve</h2>
      <p>Each gene rewrites a card for the rest of the run. Genes stack without limit, but each costs more than the last.</p>
      <div class="tabs">
        <button class="btn small" data-act="tab" data-deck="combat" aria-pressed="${this.spliceTab === 'combat'}">tactics</button>
        <button class="btn small" data-act="tab" data-deck="survey" aria-pressed="${this.spliceTab === 'survey'}">survey</button>
      </div>
      ${genebox}
      <div class="grid">${grid.join('')}</div>
      <div class="actions"><button class="btn primary" data-act="leave-pod">leave pod</button></div>`;
  }
}
