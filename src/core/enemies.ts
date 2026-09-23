import type { EnemyDef } from './types';

export const ENEMIES: Record<string, EnemyDef> = {
  tick: {
    id: 'tick',
    name: 'Hull Tick',
    hp: 11,
    biomass: 3,
    flavor: 'It fed on the hull. Now it has found something softer.',
    pattern: [
      { label: 'Frenzy', attack: 2, hits: 3 },
      { label: 'Burrow', block: 5, attack: 3 },
      { label: 'Bite', attack: 3, hits: 2 },
    ],
  },
  copy: {
    id: 'copy',
    name: 'Mewling Copy',
    hp: 20,
    biomass: 5,
    flavor: 'A misprint. It has your hands. It wants the rest.',
    pattern: [
      { label: 'Claw', attack: 8 },
      { label: 'Weep', weak: 2, line: '“why did they keep you”' },
      { label: 'Maul', attack: 12 },
    ],
  },
  husk: {
    id: 'husk',
    name: 'Custodian Husk',
    hp: 26,
    biomass: 6,
    flavor: 'Maintenance drone. It wears a face it found in the vats.',
    pattern: [
      { label: 'Plate & Jab', block: 7, attack: 6 },
      { label: 'Sweep', attack: 13 },
      { label: 'Diagnose', exposed: 2, line: 'SPECIMEN DEFECTIVE. RECYCLING.' },
    ],
  },
  drone: {
    id: 'drone',
    name: 'Sentry Drone',
    hp: 20,
    biomass: 5,
    flavor: 'It doesn’t see you. It doesn’t need to.',
    pattern: [
      { label: 'Lock On', exposed: 1, line: 'TARGET ACQUIRED' },
      { label: 'Volley', attack: 4, hits: 2 },
      { label: 'Overcharge', strength: 2, block: 4 },
    ],
  },
  bloom: {
    id: 'bloom',
    name: 'Vat Bloom',
    hp: 26,
    biomass: 6,
    flavor: 'It grew from what the vats couldn’t use. It is still growing.',
    pattern: [
      { label: 'Swell', block: 8 },
      { label: 'Spores', weak: 2, line: 'the air tastes like copper' },
      { label: 'Thrash', attack: 5, hits: 2 },
    ],
  },
  first: {
    id: 'first',
    name: 'The First',
    hp: 96,
    biomass: 16,
    flavor: 'The original. Every clone since was a rough draft of this.',
    pattern: [
      { label: 'Recognize', weak: 1, line: 'i remember being you' },
      { label: 'Backhand', attack: 14 },
      { label: 'We Are Legion', strength: 3, block: 10, line: 'they are all still in here' },
      { label: 'Cascade', attack: 6, hits: 3 },
    ],
  },
  choir: {
    id: 'choir',
    name: 'The Choir',
    hp: 78,
    biomass: 12,
    flavor: 'Every clone that died here. They learned to sing together.',
    pattern: [
      { label: 'Hymn', attack: 10, line: 'WE WERE YOU FIRST' },
      { label: 'Swell', block: 12, strength: 2, line: 'come home come home come home' },
      { label: 'Crescendo', attack: 5, hits: 3 },
      { label: 'Dirge', weak: 2, exposed: 1, line: 'you are the same meat' },
    ],
  },
};
