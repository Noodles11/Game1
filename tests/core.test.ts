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
        const pending = g.combat?.pendingEmpower;
        if (pending) {
          const target = g.combat!.hand[0];
          if (target) g.empowerTarget(target.uid);
          else g.skipEmpower();
        }
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

describe('dynamic card effects', () => {
  it('Overclock Jack empowers a chosen card in hand for the rest of the fight', () => {
    const g = new Game(5);
    walkToFight(g);
    const jack: CardInstance = { uid: 9001, defId: 'jack', genes: [] };
    const scalpel: CardInstance = { uid: 9002, defId: 'scalpel', genes: [] };
    g.combat!.hand = [jack, scalpel];
    const [target] = g.livingEnemies();

    expect(g.playCombat(jack.uid, target.uid)).toBe(true);
    expect(g.combat!.pendingEmpower).toEqual({ amount: 2 });
    expect(g.combatBonus(scalpel)).toBe(0);

    expect(g.empowerTarget(scalpel.uid)).toBe(true);
    expect(g.combat!.pendingEmpower).toBeNull();
    expect(g.combatBonus(scalpel)).toBe(2);
    expect(g.displayStats(scalpel).damage).toBe(cardStats(scalpel).damage + 2);

    // The buff is keyed by uid, so it survives a discard and later redraw.
    g.combat!.discard.push(scalpel);
    g.combat!.hand = [];
    expect(g.combatBonus(scalpel)).toBe(2);
  });

  it('an unresolved Empower is dropped at end of turn, never blocking play', () => {
    const g = new Game(5);
    walkToFight(g);
    const jack: CardInstance = { uid: 9004, defId: 'jack', genes: [] };
    const spare: CardInstance = { uid: 9005, defId: 'brace', genes: [] };
    g.combat!.hand = [jack, spare];
    g.playCombat(jack.uid, g.livingEnemies()[0].uid);
    expect(g.combat!.pendingEmpower).not.toBeNull();
    g.endTurn();
    expect(g.combat!.pendingEmpower).toBeNull();
  });

  it('Siphon Blade converts a share of the damage it deals into biomass', () => {
    const g = new Game(5);
    walkToFight(g);
    const siphon: CardInstance = { uid: 9003, defId: 'siphon', genes: [] };
    g.combat!.hand = [siphon];
    const target = g.livingEnemies()[0];
    const before = g.biomass;

    expect(g.playCombat(siphon.uid, target.uid)).toBe(true);
    const dealt = Math.min(9, target.maxHp);
    expect(g.biomass).toBe(before + Math.floor(dealt * 0.5));
  });

  it('Overclock and Leech genes bond with any damaging card', () => {
    const empowered = splice(card('scalpel'), 'overclock');
    expect(cardStats(empowered).empower).toBe(2);
    expect(cardText(empowered)).toContain('On hit, choose a card in hand: +2 damage, this fight.');
    expect(() => splice(card('brace'), 'overclock')).toThrow();

    const leeching = splice(card('scalpel'), 'leech');
    expect(cardStats(leeching).drain).toBe(25);
    expect(cardText(leeching)).toContain('Gain biomass equal to 25% of damage dealt.');
  });
});

describe('sectors and modifiers', () => {
  function playToSectorBoss(seed: number): Game {
    const g = new Game(seed);
    for (let guard = 0; guard < 200 && g.phase !== 'modifier' && g.phase !== 'dead'; guard++) {
      if (g.phase === 'explore') {
        const pry = g.sHand.find((c) => c.defId === 'pry' && !g.surveyPlayable(c));
        if (pry) g.playSurvey(pry.uid);
        else if (g.canUsePod()) g.usePod();
        else if (g.front && !g.front.revealed) g.advance();
        else if (g.blocker()) g.force();
        else g.advance();
      } else if (g.phase === 'combat') fightToEnd(g);
      else if (g.phase === 'harvest') {
        for (const k of g.corpses) (g.hp < 40 ? g.consume(k.uid) : g.render(k.uid));
        g.finishHarvest();
      } else if (g.phase === 'reward' || g.phase === 'loot') g.takeOffer(0);
      else if (g.phase === 'splice') {
        for (const c of g.combatDeck) {
          const o = g.offersFor(c.uid)[0];
          if (o) g.spliceCard(c.uid, o);
        }
        g.leavePod();
      } else break;
    }
    return g;
  }

  /** Bot survival varies by seed; try a few until one reaches the boss gate. */
  function anyGameAtSectorBoss(): Game {
    for (let seed = 1; seed <= 60; seed++) {
      const g = playToSectorBoss(seed);
      if (g.phase === 'modifier') return g;
    }
    throw new Error('no seed reached the sector boss gate');
  }

  it('offers a run modifier after the sector 1 boss falls, then continues into sector 2', () => {
    const g = anyGameAtSectorBoss();
    expect(g.sectorNum).toBe(1);
    const hpBefore = g.hp;
    const maxBefore = g.maxHp;
    g.chooseModifier('integrity');
    expect(g.modifiers.integrity).toBe(true);
    expect(g.maxHp).toBe(maxBefore + 16);
    expect(g.hp).toBe(hpBefore + 16);
    expect(g.phase).toBe('explore');
    expect(g.sectorNum).toBe(1); // still standing on the boss segment
    g.advance();
    expect(g.sectorNum).toBe(2);
  });

  it('the energy modifier raises the per-turn cap', () => {
    const g = new Game(9);
    g.modifiers.energy = true;
    walkToFight(g);
    expect(g.combat!.energyCap).toBe(4);
    expect(g.combat!.energy).toBe(4);
  });

  it('the biomass modifier scales every gain by 1.5x', () => {
    const g = new Game(9);
    g.modifiers.biomass = true;
    walkToFight(g);
    fightToEnd(g);
    const k = g.corpses[0];
    const before = g.biomass;
    g.render(k.uid);
    expect(g.biomass).toBe(before + Math.round(g.corpseYield(k) * 1.5));
  });
});

describe('save and load', () => {
  it('round-trips a fresh game exactly, including future draws', () => {
    const g = new Game(42, 3);
    const restored = Game.load(g.serialize())!;
    expect(restored).not.toBeNull();
    expect(restored.cloneNo).toBe(3);
    expect(restored.sHand.map((c) => c.defId)).toEqual(g.sHand.map((c) => c.defId));
    expect(restored.segments).toEqual(g.segments);
    // The RNG continuation point round-trips too: the same next draw matches.
    expect(restored.rng.next()).toBe(g.rng.next());
  });

  it('round-trips mid-fight state: hand, energy, empower buffs, corpses', () => {
    const g = new Game(7);
    walkToFight(g);
    const jack: CardInstance = { uid: 8001, defId: 'jack', genes: [] };
    const scalpel: CardInstance = { uid: 8002, defId: 'scalpel', genes: [] };
    g.combat!.hand = [jack, scalpel];
    g.playCombat(jack.uid, g.livingEnemies()[0].uid);
    g.empowerTarget(scalpel.uid);

    const restored = Game.load(g.serialize())!;
    expect(restored.phase).toBe('combat');
    expect(restored.combat!.energy).toBe(g.combat!.energy);
    expect(restored.combat!.hand.map((c) => c.uid)).toEqual(g.combat!.hand.map((c) => c.uid));
    expect(restored.combatBonus(scalpel)).toBe(2);
    expect(restored.livingEnemies().length).toBe(g.livingEnemies().length);

    // And play continues correctly from the restored state.
    fightToEnd(restored);
    expect(['harvest', 'combat']).toContain(restored.phase);
  });

  it('rejects a save from a future/foreign version instead of throwing', () => {
    const bad = JSON.stringify({ v: 999, garbage: true });
    expect(Game.load(bad)).toBeNull();
    expect(Game.load('not json')).toBeNull();
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
        else if (g.phase === 'modifier') g.chooseModifier('integrity');
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
