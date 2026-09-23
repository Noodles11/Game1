import { describe, expect, it } from 'vitest';
import { cardName, cardStats, cardText, genesFor, splice, spliceCost } from '../src/core/cards';
import { FORCE_COST, Game, MAX_ENERGY } from '../src/core/game';
import type { CardInstance } from '../src/core/types';

const card = (defId: string, genes: string[] = []): CardInstance => ({ uid: 999, defId, genes });

/** Walk forward, clearing obstacles by force, until a fight starts. */
function walkToFight(g: Game) {
  for (let i = 0; i < 20 && g.phase === 'explore'; i++) {
    if (g.front && !g.front.revealed) g.advance();
    if (g.blocker()) g.force();
    else g.advance();
  }
}

/** Play every affordable card on the first enemy until the fight ends. */
function fightToEnd(g: Game) {
  for (let turn = 0; turn < 60 && g.phase === 'combat'; turn++) {
    let played = true;
    while (played && g.phase === 'combat') {
      played = false;
      for (const c of [...g.combat!.hand]) {
        if (g.phase !== 'combat') break;
        if (g.playCombat(c.uid, g.livingEnemies()[0]?.uid)) played = true;
      }
    }
    if (g.phase === 'combat') g.endTurn();
  }
}

describe('card evolution', () => {
  it('stacks genes into stats, text and name', () => {
    let c = card('scalpel');
    c = splice(c, 'serrated');
    c = splice(c, 'serrated');
    c = splice(c, 'twin');
    const s = cardStats(c);
    expect(s.damage).toBe(12);
    expect(s.hits).toBe(2);
    expect(cardText(c)).toContain('Deal 12 ×2.');
    expect(cardName(c)).toBe('Twinned Scalpel');
  });

  it('prices splicing by card level', () => {
    const base = card('scalpel');
    const lvl2 = card('scalpel', ['serrated', 'serrated']);
    expect(spliceCost(lvl2, 'serrated')).toBe(spliceCost(base, 'serrated') + 4);
  });

  it('rejects genes that do not fit', () => {
    expect(() => splice(card('brace'), 'serrated')).toThrow();
    expect(() => splice(card('override'), 'chitin')).toThrow();
    expect(genesFor(card('brace')).map((g) => g.id)).not.toContain('serrated');
  });

  it('cannot reduce cost below zero', () => {
    const c = card('adrenal');
    expect(genesFor(c).map((g) => g.id)).not.toContain('reflex');
  });
});

describe('exploration', () => {
  it('is deterministic for a seed', () => {
    const a = new Game(7);
    const b = new Game(7);
    expect(a.sHand.map((c) => c.defId)).toEqual(b.sHand.map((c) => c.defId));
  });

  it('blocks on wreckage until cut or forced', () => {
    const g = new Game(1);
    g.pos = 2;
    expect(g.blocker()).toBe('debris');
    expect(g.advance()).toBe(false);
    const hp = g.hp;
    expect(g.force()).toBe(true);
    expect(g.hp).toBe(hp - FORCE_COST);
    expect(g.advance()).toBe(true);
    expect(g.pos).toBe(3);
  });

  it('spends oxygen and validates survey cards', () => {
    const g = new Game(3);
    g.sHand = [...g.surveyDeck.filter((c) => c.defId === 'scan')];
    const scan = g.sHand[0];
    expect(g.playSurvey(scan.uid)).toBe(true);
    expect(g.oxygen).toBe(2);
    const override = g.surveyDeck.find((c) => c.defId === 'override')!;
    g.sHand = [override];
    expect(g.playSurvey(override.uid)).toBe(false);
    expect(g.message).toMatch(/No sealed hatch/);
  });
});

describe('combat and harvest', () => {
  it('starts combat when walking into enemies', () => {
    const g = new Game(11);
    walkToFight(g);
    expect(g.phase).toBe('combat');
    expect(g.combat!.hand.length).toBe(5);
    expect(g.combat!.energy).toBe(MAX_ENERGY);
    expect(g.livingEnemies().map((e) => e.defId)).toEqual(['tick', 'tick']);
  });

  it('tagged corpses yield double biomass', () => {
    const g = new Game(5);
    walkToFight(g);
    const [a] = g.livingEnemies();
    a.status.tagged = 1;
    fightToEnd(g);
    expect(g.phase).toBe('harvest');
    const tagged = g.corpses.find((k) => k.uid === a.uid)!;
    expect(tagged.tagged).toBe(true);
    const before = g.biomass;
    g.render(tagged.uid);
    expect(g.biomass).toBe(before + tagged.biomass * 2);
  });

  it('consuming heals, capped at max', () => {
    const g = new Game(5);
    walkToFight(g);
    fightToEnd(g);
    g.hp = 10;
    const k = g.corpses[0];
    g.consume(k.uid);
    expect(g.hp).toBe(10 + g.corpseYield(k));
    g.finishHarvest();
    expect(g.phase).toBe('reward');
    g.takeOffer(0);
    expect(g.combatDeck.length).toBe(9);
    expect(g.phase).toBe('explore');
  });

  it('plating absorbs enemy damage', () => {
    const g = new Game(2);
    walkToFight(g);
    g.playerBlock = 100;
    const hp = g.hp;
    g.endTurn();
    expect(g.hp).toBe(hp);
  });

  it('dies at zero integrity', () => {
    const g = new Game(2);
    walkToFight(g);
    g.hp = 1;
    g.combat!.hand = [];
    for (let i = 0; i < 5 && g.phase === 'combat'; i++) g.endTurn();
    expect(g.phase).toBe('dead');
  });
});

describe('splice pods', () => {
  it('spends biomass to evolve a card in the deck', () => {
    const g = new Game(4);
    g.pos = 3;
    g.segments[4].revealed = true;
    expect(g.usePod()).toBe(true);
    g.biomass = 50;
    const scalpel = g.combatDeck.find((c) => c.defId === 'scalpel')!;
    const offers = g.offersFor(scalpel.uid);
    expect(offers.length).toBe(3);
    expect(g.offersFor(scalpel.uid)).toEqual(offers);
    const cost = spliceCost(scalpel, offers[0]);
    expect(g.spliceCard(scalpel.uid, offers[0])).toBe(true);
    expect(g.biomass).toBe(50 - cost);
    expect(scalpel.genes).toEqual([offers[0]]);
    g.leavePod();
    expect(g.canUsePod()).toBe(false);
  });
});

describe('full run', () => {
  it('a greedy bot can finish or die without errors', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = new Game(seed);
      for (let guard = 0; guard < 400; guard++) {
        if (g.phase === 'explore') {
          const pry = g.sHand.find((c) => c.defId === 'pry' && !g.surveyPlayable(c));
          if (pry) g.playSurvey(pry.uid);
          else if (g.canUsePod()) g.usePod();
          else if (g.front && !g.front.revealed) g.advance();
          else if (g.blocker()) g.force();
          else g.advance();
        } else if (g.phase === 'combat') fightToEnd(g);
        else if (g.phase === 'harvest') {
          for (const k of g.corpses) (g.hp < 20 ? g.consume(k.uid) : g.render(k.uid));
          g.finishHarvest();
        } else if (g.phase === 'reward' || g.phase === 'loot') g.takeOffer(0);
        else if (g.phase === 'splice') {
          const c = g.combatDeck[0];
          const o = g.offersFor(c.uid)[0];
          if (o) g.spliceCard(c.uid, o);
          g.leavePod();
        } else break;
      }
      expect(['won', 'dead']).toContain(g.phase);
    }
  });
});
