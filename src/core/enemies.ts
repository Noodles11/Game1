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
