/** Scene palette. The print pass (print.ts) maps these onto ink, paper and spot inks. */
export const INK = {
  void: '#0b0d10',
  hull: '#1a1d22',
  hullLit: '#2b2a2a',
  rust: '#4a3024',
  bone: '#d8cfb8',
  boneDim: '#8c8574',
  sodium: '#e3a33b',
  flesh: '#b9505a',
  fleshDark: '#5a2530',
  cryo: '#6fa3a0',
  signal: '#b06fe0',
  toxin: '#7fd48a',
};

/** Parse '#rrggbb' or 'rgb(r,g,b)' into channels. */
function rgb(c: string): [number, number, number] {
  if (c[0] === '#') {
    const p = parseInt(c.slice(1), 16);
    return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
  }
  const m = c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0'];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

/** Mix two colors ('#rrggbb' or the 'rgb()' this returns). t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const pa = rgb(a);
  const pb = rgb(b);
  const m = (k: number) => Math.round(pa[k] + (pb[k] - pa[k]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
