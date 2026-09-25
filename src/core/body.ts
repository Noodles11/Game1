/**
 * The clone's body: five limbs, each a card slot with its own integrity.
 * The head keeps most of it; the clone dies when the head reaches 0.
 * A limb at 0 is torn off: its slot cannot be used until it is healed above 0.
 */

export type Limb = 'lleg' | 'larm' | 'head' | 'rarm' | 'rleg';
export type SlotType = 'leg' | 'arm' | 'head';
/** A card's slot type. 'any' fits every slot (medic cards). */
export type CardSlot = SlotType | 'any';

/** Slot order on screen, left to right. */
export const LIMBS: Limb[] = ['lleg', 'larm', 'head', 'rarm', 'rleg'];

export const LIMB_TYPE: Record<Limb, SlotType> = {
  lleg: 'leg', larm: 'arm', head: 'head', rarm: 'arm', rleg: 'leg',
};

export const LIMB_NAME: Record<Limb, string> = {
  lleg: 'left leg', larm: 'left arm', head: 'head', rarm: 'right arm', rleg: 'right leg',
};

export const LIMB_SHORT: Record<Limb, string> = {
  lleg: 'L.LEG', larm: 'L.ARM', head: 'HEAD', rarm: 'R.ARM', rleg: 'R.LEG',
};

/** Starting integrity: 50 in all. Arms 8%, legs 14%, head 56%. */
export const BASE_LIMB_HP: Record<Limb, number> = {
  lleg: 7, larm: 4, head: 28, rarm: 4, rleg: 7,
};

export interface LimbState {
  hp: number;
  max: number;
}

export type Body = Record<Limb, LimbState>;

export function freshBody(): Body {
  const b = {} as Body;
  for (const l of LIMBS) b[l] = { hp: BASE_LIMB_HP[l], max: BASE_LIMB_HP[l] };
  return b;
}

/** Where an enemy prefers to strike. */
export type Aim = 'legs' | 'arms' | 'head' | 'any';

export const AIM_LIMBS: Record<Aim, Limb[]> = {
  legs: ['lleg', 'rleg'],
  arms: ['larm', 'rarm'],
  head: ['head'],
  any: LIMBS,
};
