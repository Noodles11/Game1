/** Shared palette. Mirrors the CSS tokens in style.css. */
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

/** Mix two hex colors. t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
