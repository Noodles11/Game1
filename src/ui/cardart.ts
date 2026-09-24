/**
 * Card illustrations: small vintage-print plates in inline SVG.
 * Every plate shares one template — a spot-ink sun, dashed rays, a halftone ground —
 * and carries its own ink emblem. 100×60 units.
 */

const INK = '#131113';
const PAPER = '#f1e7cf';
const RED = '#da412b';
const MUSTARD = '#eea423';
const TEAL = '#1b9e94';
const COBALT = '#2e6bb8';
const VIOLET = '#7a4cb8';
const GREEN = '#5ea653';

interface Plate {
  color: string;
  /** Where the sun sits. */
  sun: [number, number];
  emblem: string;
}

const P = (d: string, extra = '') => `<path d="${d}" ${extra}/>`;
const line = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
const hi = (d: string) => `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="1.2" stroke-linecap="round"/>`;

const PLATES: Record<string, Plate> = {
  scalpel: {
    color: RED, sun: [66, 22],
    emblem: P('M24 50 L60 16 L66 18 L32 52 Z') + P('M20 54 L28 46 L33 51 L25 57 Z') + hi('M30 45 L58 19'),
  },
  brace: {
    color: TEAL, sun: [50, 26],
    emblem: P('M50 10 L70 18 L68 38 Q64 50 50 56 Q36 50 32 38 L30 18 Z') + hi('M50 16 L64 22 L62 37 Q59 46 50 50') +
      `<circle cx="50" cy="32" r="4" fill="${PAPER}"/>`,
  },
  harpoon: {
    color: RED, sun: [70, 20],
    emblem: line('M14 50 L72 22') + P('M72 22 L62 20 L66 28 Z M80 18 L66 16 L70 30 Z') +
      `<path d="M14 50 Q10 56 16 58 Q24 60 20 52" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="2 2"/>`,
  },
  flense: {
    color: RED, sun: [34, 20],
    emblem: P('M22 46 Q46 12 78 18 Q56 24 36 50 Z') + hi('M34 40 Q50 22 70 20') +
      `<path d="M40 52 q4 -4 8 0 q4 4 8 0 q4 -4 8 0" fill="none" stroke="${RED}" stroke-width="2.5"/>`,
  },
  scatter: {
    color: MUSTARD, sun: [30, 30],
    emblem: [[46, 22], [60, 34], [52, 46], [72, 20], [74, 44]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="4.5" fill="${INK}"/>${hi(`M${x - 14} ${y + 2} L${x - 6} ${y + 1}`)}`).join(''),
  },
  spike: {
    color: VIOLET, sun: [50, 24],
    emblem: P('M50 8 Q66 10 66 26 Q66 38 54 40 L54 30 Q60 28 60 24 Q58 16 50 16 Q42 16 40 24 Q40 28 46 30 L46 40 Q34 38 34 26 Q34 10 50 8 Z') +
      P('M52 34 L44 46 L50 46 L46 58 L58 42 L52 42 L56 34 Z', `fill="${MUSTARD}" stroke="${INK}" stroke-width="1.2"`),
  },
  bonesaw: {
    color: RED, sun: [50, 30],
    emblem: `<circle cx="50" cy="32" r="16" fill="${INK}"/>` +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 50 + Math.cos(a) * 16;
        const y = 32 + Math.sin(a) * 16;
        const x2 = 50 + Math.cos(a + 0.2) * 21;
        const y2 = 32 + Math.sin(a + 0.2) * 21;
        const x3 = 50 + Math.cos(a + 0.45) * 16;
        const y3 = 32 + Math.sin(a + 0.45) * 16;
        return P(`M${x.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} Z`);
      }).join('') + `<circle cx="50" cy="32" r="4" fill="${PAPER}"/>`,
  },
  adrenal: {
    color: GREEN, sun: [64, 24],
    emblem: P('M26 46 L56 16 L64 24 L34 54 Z') + P('M58 14 L66 22 L70 18 L62 10 Z') + line('M34 54 L22 62') +
      P('M36 40 L50 26 L54 30 L40 44 Z', `fill="${GREEN}"`),
  },
  echo: {
    color: COBALT, sun: [50, 30],
    emblem: [8, 14, 20].map((r) => `<circle cx="50" cy="32" r="${r}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="${r === 20 ? '4 3' : 'none'}"/>`).join('') +
      line('M50 26 L50 38 M44 29 L56 35 M44 35 L56 29'),
  },
  hook: {
    color: MUSTARD, sun: [36, 22],
    emblem: line('M58 6 L58 34 Q58 50 44 50 Q32 50 32 40') + P('M28 44 L32 34 L38 42 Z') +
      `<rect x="52" y="4" width="12" height="6" fill="${INK}"/>`,
  },
  graft: {
    color: RED, sun: [50, 28],
    emblem: P('M30 16 L70 18 L68 48 L32 46 Z', `fill="${PAPER}" stroke="${INK}" stroke-width="2.5"`) +
      line('M30 16 L32 46') + [22, 30, 38].map((y) => line(`M26 ${y} L36 ${y + 3}`)).join('') +
      `<path d="M44 26 Q52 34 60 26" fill="none" stroke="${RED}" stroke-width="3"/>`,
  },
  jack: {
    color: VIOLET, sun: [62, 20],
    emblem: P('M30 26 L50 26 L50 40 L30 40 Z') + P('M50 29 L62 29 L62 31 L50 31 Z M50 35 L62 35 L62 37 L50 37 Z') +
      line('M30 33 Q18 33 16 50') + P('M66 20 L60 32 L66 32 L62 44 L74 28 L68 28 L72 20 Z', `fill="${MUSTARD}" stroke="${INK}" stroke-width="1.2"`),
  },
  siphon: {
    color: RED, sun: [40, 24],
    emblem: P('M22 50 L62 14 L68 18 L30 54 Z') + P('M66 34 Q72 44 66 50 Q60 44 66 34 Z', `fill="${RED}" stroke="${INK}" stroke-width="1.5"`) +
      P('M58 44 Q62 50 58 54 Q54 50 58 44 Z', `fill="${RED}" stroke="${INK}" stroke-width="1.5"`),
  },
  resonant: {
    color: COBALT, sun: [50, 22],
    emblem: line('M42 10 L42 32 Q42 40 50 40 Q58 40 58 32 L58 10 M50 40 L50 56') +
      `<path d="M30 14 q-6 8 0 16 M24 10 q-9 12 0 24 M70 14 q6 8 0 16 M76 10 q9 12 0 24" fill="none" stroke="${INK}" stroke-width="1.8"/>`,
  },
  shatter: {
    color: COBALT, sun: [50, 28],
    emblem: P('M50 8 L64 26 L56 54 L44 54 L36 26 Z') + hi('M50 8 L50 30 L44 54 M50 30 L64 26 M50 30 L36 26') +
      P('M68 14 L74 10 L72 18 Z M28 16 L22 12 L26 20 Z M72 40 L80 42 L74 46 Z'),
  },
  crystalskin: {
    color: TEAL, sun: [50, 26],
    emblem: P('M50 10 L66 24 L50 54 L34 24 Z') + hi('M34 24 L66 24 M50 10 L44 24 L50 54 M50 10 L56 24 L50 54'),
  },
  splitlens: {
    color: VIOLET, sun: [22, 30],
    emblem: line('M8 32 L40 32') + P('M40 14 L58 46 L22 46 Z', `fill="${PAPER}" stroke="${INK}" stroke-width="2.5"`) +
      `<path d="M50 32 L92 18" stroke="${RED}" stroke-width="3"/><path d="M50 34 L92 32" stroke="${MUSTARD}" stroke-width="3"/><path d="M50 36 L92 46" stroke="${TEAL}" stroke-width="3"/>`,
  },
  override: {
    color: TEAL, sun: [66, 20],
    emblem: P('M28 14 L62 14 L62 52 L28 52 Z') + `<rect x="33" y="19" width="24" height="12" fill="${TEAL}"/>` +
      [0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${34 + c * 8}" y="${35 + r * 5}" width="5" height="3" fill="${PAPER}"/>`).join('')).join(''),
  },
  cutter: {
    color: MUSTARD, sun: [72, 24],
    emblem: P('M16 44 L50 30 L54 38 L20 52 Z') + P('M52 32 L58 30 L60 36 L54 38 Z') +
      P('M60 33 Q78 24 90 30 Q78 38 60 35 Z', `fill="${MUSTARD}" stroke="${INK}" stroke-width="1.5"`) +
      `<path d="M66 33 L84 30" stroke="${PAPER}" stroke-width="1.5"/>`,
  },
  scan: {
    color: TEAL, sun: [58, 20],
    emblem: P('M26 20 Q46 22 50 44 Z') + line('M38 32 L30 50 M22 54 L42 54') +
      `<path d="M56 16 q6 4 4 12 M62 10 q10 8 6 22" fill="none" stroke="${INK}" stroke-width="2"/>`,
  },
  pry: {
    color: MUSTARD, sun: [34, 20],
    emblem: line('M24 54 L66 14 Q72 10 76 16') + P('M20 50 L28 58 L22 60 L16 54 Z') + hi('M30 46 L62 16'),
  },
  stim: {
    color: GREEN, sun: [50, 28],
    emblem: P('M32 22 L68 22 L64 50 L36 50 Z') + P('M44 14 L56 14 L56 22 L44 22 Z') +
      P('M47 28 L53 28 L53 33 L58 33 L58 39 L53 39 L53 44 L47 44 L47 39 L42 39 L42 33 L47 33 Z', `fill="${GREEN}"`),
  },
  flare: {
    color: RED, sun: [56, 16],
    emblem: P('M30 54 L50 22 L56 26 L36 58 Z') +
      `<circle cx="54" cy="20" r="6" fill="${MUSTARD}" stroke="${INK}" stroke-width="2"/>` +
      `<path d="M54 8 L54 4 M64 12 L68 9 M66 22 L71 23 M44 12 L40 9" stroke="${INK}" stroke-width="2"/>`,
  },
  beacon: {
    color: COBALT, sun: [50, 18],
    emblem: line('M50 20 L40 54 M50 20 L60 54 M44 40 L56 40') + `<circle cx="50" cy="18" r="4" fill="${RED}" stroke="${INK}" stroke-width="2"/>` +
      `<path d="M38 12 q-5 6 0 12 M62 12 q5 6 0 12 M32 8 q-8 10 0 20 M68 8 q8 10 0 20" fill="none" stroke="${INK}" stroke-width="1.8"/>`,
  },
};

const FALLBACK: Plate = { color: MUSTARD, sun: [50, 26], emblem: `<circle cx="50" cy="30" r="10" fill="${INK}"/>` };

/** Shared halftone patterns, injected once into the page. */
export function cardArtDefs(): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <pattern id="ht-ink" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx="1.5" cy="1.5" r="0.75" fill="${INK}"/></pattern>
    <pattern id="ht-paper" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx="1.5" cy="1.5" r="0.7" fill="${PAPER}" fill-opacity="0.7"/></pattern>
  </defs></svg>`;
}

/** The illustration plate for a card. */
export function cardArt(defId: string): string {
  const p = PLATES[defId] ?? FALLBACK;
  const [sx, sy] = p.sun;
  const rays = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const x = sx + Math.cos(a) * 90;
    const y = sy + Math.sin(a) * 90;
    return `M${sx} ${sy} L${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="art" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="100" height="60" fill="${PAPER}"/>
    <path d="${rays}" stroke="${p.color}" stroke-width="0.9" stroke-dasharray="2.2 1.6" opacity="0.8"/>
    <circle cx="${sx}" cy="${sy}" r="15" fill="${p.color}"/>
    <circle cx="${sx}" cy="${sy}" r="15" fill="url(#ht-paper)"/>
    <path d="M0 50 Q30 45 50 49 T100 47 L100 60 L0 60 Z" fill="url(#ht-ink)"/>
    <g fill="${INK}">${p.emblem}</g>
  </svg>`;
}
