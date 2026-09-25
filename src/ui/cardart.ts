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
  cutter: {
    color: MUSTARD, sun: [72, 24],
    emblem: P('M16 44 L50 30 L54 38 L20 52 Z') + P('M52 32 L58 30 L60 36 L54 38 Z') +
      P('M60 33 Q78 24 90 30 Q78 38 60 35 Z', `fill="${MUSTARD}" stroke="${INK}" stroke-width="1.5"`) +
      `<path d="M66 33 L84 30" stroke="${PAPER}" stroke-width="1.5"/>`,
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
  needle: {
    color: RED, sun: [66, 20],
    emblem: line('M18 54 L52 22') + P('M50 18 L66 8 L70 12 L56 26 Z') + P('M60 12 L64 8 L72 16 L68 20 Z') +
      P('M30 46 Q34 52 30 56 Q26 52 30 46 Z', `fill="${RED}" stroke="${INK}" stroke-width="1.2"`),
  },
  unscarred: {
    color: MUSTARD, sun: [50, 24],
    emblem: P('M47 56 L50 8 L53 56 Z') + P('M40 50 L60 50 L60 54 L40 54 Z') + hi('M50 12 L50 48') +
      `<path d="M68 14 L68 24 M63 19 L73 19 M30 26 L30 32 M27 29 L33 29" stroke="${INK}" stroke-width="2"/>`,
  },
  scartissue: {
    color: RED, sun: [50, 26],
    emblem: `<path d="M18 40 Q34 22 50 34 T82 26" fill="none" stroke="${RED}" stroke-width="5"/>` +
      [24, 34, 44, 54, 64, 74].map((x, i) => line(`M${x} ${i % 2 ? 22 : 26} L${x + 4} ${i % 2 ? 40 : 44}`)).join(''),
  },
  feeding: {
    color: RED, sun: [36, 22],
    emblem: P('M20 52 L66 14 L72 18 L64 26 L60 24 L58 30 L54 28 L52 34 L48 32 L46 38 L42 36 L28 56 Z') +
      P('M72 38 Q78 46 72 52 Q66 46 72 38 Z', `fill="${RED}" stroke="${INK}" stroke-width="1.5"`),
  },
  callus: {
    color: TEAL, sun: [64, 20],
    emblem: [0, 1, 2].map((i) => `<rect x="${26 + i * 6}" y="${18 + i * 8}" width="40" height="12" rx="3" fill="${i === 2 ? INK : PAPER}" stroke="${INK}" stroke-width="2.5"/>`).join(''),
  },
  donor: {
    color: GREEN, sun: [60, 22],
    emblem: P('M34 10 L62 10 Q66 10 66 16 L66 40 Q66 46 60 46 L36 46 Q30 46 30 40 L30 16 Q30 10 34 10 Z') +
      `<rect x="34" y="24" width="28" height="18" fill="${RED}"/>` + line('M48 46 L48 52 Q48 58 60 58 L78 58') +
      `<path d="M38 18 L58 18" stroke="${PAPER}" stroke-width="1.5"/>`,
  },
  sibling: {
    color: VIOLET, sun: [50, 20],
    emblem: [34, 62].map((x) => `<circle cx="${x}" cy="22" r="7" fill="${INK}"/>` + P(`M${x - 10} 56 Q${x - 10} 32 ${x} 32 Q${x + 10} 32 ${x + 10} 56 Z`)).join('') +
      `<path d="M44 40 L52 40" stroke="${INK}" stroke-width="2" stroke-dasharray="2 2"/>`,
  },
  cannibal: {
    color: RED, sun: [30, 22],
    emblem: `<rect x="52" y="14" width="26" height="36" fill="${PAPER}" stroke="${INK}" stroke-width="2.5"/>` +
      P('M52 20 Q60 26 52 32 Q60 38 52 44 L40 44 L40 20 Z') +
      P('M14 22 Q30 14 44 24 L38 30 L32 26 L26 32 L20 26 Z M14 48 Q30 56 44 42 L38 38 L32 44 L26 38 L20 44 Z'),
  },
  flask: {
    color: GREEN, sun: [64, 18],
    emblem: P('M42 8 L56 8 L56 24 L70 52 Q72 58 64 58 L34 58 Q26 58 28 52 L42 24 Z') +
      P('M35 44 L63 44 L68 54 L30 54 Z', `fill="${GREEN}"`) +
      [[44, 36, 2.5], [54, 30, 2], [50, 20, 1.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PAPER}"/>`).join(''),
  },
  hunger: {
    color: MUSTARD, sun: [50, 30],
    emblem: `<circle cx="50" cy="32" r="18" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>` +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return P(`M${(50 + Math.cos(a) * 18).toFixed(1)} ${(32 + Math.sin(a) * 18).toFixed(1)} L${(50 + Math.cos(a + 0.26) * 12).toFixed(1)} ${(32 + Math.sin(a + 0.26) * 12).toFixed(1)} L${(50 + Math.cos(a + 0.52) * 18).toFixed(1)} ${(32 + Math.sin(a + 0.52) * 18).toFixed(1)} Z`);
      }).join('') + line('M50 32 L50 20 M50 32 L58 36'),
  },
  grief: {
    color: VIOLET, sun: [50, 26],
    emblem: `<circle cx="50" cy="32" r="14" fill="${INK}"/>` +
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = 50 + Math.cos(a) * 17;
        const y = 32 + Math.sin(a) * 17;
        return `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" fill="${INK}" transform="rotate(${(a * 180) / Math.PI} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }).join('') + P('M50 24 Q56 32 50 38 Q44 32 50 24 Z', `fill="${PAPER}"`),
  },
  echoscar: {
    color: COBALT, sun: [50, 30],
    emblem: [10, 17, 24].map((r) => `<path d="M${50 - r} 32 A${r} ${r} 0 0 1 ${50 + r} 32" fill="none" stroke="${INK}" stroke-width="2.5"/>`).join('') +
      `<path d="M30 50 L70 14" stroke="${RED}" stroke-width="4"/>` + hi('M34 46 L66 18'),
  },
  notes: {
    color: MUSTARD, sun: [70, 18],
    emblem: P('M20 18 L48 22 L48 56 L20 52 Z', `fill="${PAPER}" stroke="${INK}" stroke-width="2.5"`) +
      P('M48 22 L76 18 L76 52 L48 56 Z', `fill="${PAPER}" stroke="${INK}" stroke-width="2.5"`) +
      [30, 36, 42].map((y) => line(`M25 ${y - 4} L43 ${y - 2}`).replace('stroke-width="3"', 'stroke-width="1.5"')).join('') +
      P('M58 44 L80 10 L84 12 L62 46 L57 49 Z'),
  },
  apex: {
    color: VIOLET, sun: [50, 24],
    emblem: P('M50 6 L72 50 L28 50 Z') + P('M50 20 L60 42 L40 42 Z', `fill="${VIOLET}"`) + line('M20 56 L80 56'),
  },
  lazarus: {
    color: GREEN, sun: [50, 26],
    emblem: `<rect x="34" y="8" width="32" height="48" rx="14" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>` +
      `<rect x="38" y="30" width="24" height="22" rx="8" fill="${GREEN}"/>` +
      P('M47 20 L53 20 L53 25 L58 25 L58 31 L53 31 L53 36 L47 36 L47 31 L42 31 L42 25 L47 25 Z'),
  },
  overwrite: {
    color: VIOLET, sun: [60, 22],
    emblem: `<path d="M50 14 A18 18 0 1 0 68 32" fill="none" stroke="${INK}" stroke-width="4"/>` + P('M62 24 L74 30 L64 38 Z') +
      P('M46 24 L56 24 L52 32 L58 32 L44 48 L48 36 L42 36 Z', `fill="${MUSTARD}" stroke="${INK}" stroke-width="1.2"`),
  },
  clot: {
    color: GREEN, sun: [50, 28],
    emblem: `<rect x="30" y="18" width="40" height="26" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>` +
      `<rect x="42" y="18" width="16" height="26" fill="${GREEN}" stroke="${INK}" stroke-width="2"/>` +
      [22, 28, 34, 40].map((y) => `<circle cx="50" cy="${y}" r="1.2" fill="${INK}"/>`).join(''),
  },
  poultice: {
    color: GREEN, sun: [50, 26],
    emblem: P('M28 40 Q28 18 50 16 Q72 18 72 40 Q72 54 50 54 Q28 54 28 40 Z', `fill="${RED}" stroke="${INK}" stroke-width="3"`) +
      P('M46 26 L54 26 L54 32 L60 32 L60 40 L54 40 L54 46 L46 46 L46 40 L40 40 L40 32 L46 32 Z', `fill="${PAPER}" stroke="${INK}" stroke-width="1.5"`),
  },
  knit: {
    color: GREEN, sun: [60, 22],
    emblem: P('M22 26 Q16 20 22 16 Q28 14 30 20 L66 36 Q72 32 76 36 Q80 42 74 46 Q78 52 72 54 Q66 54 66 48 L30 32 Q26 38 20 34 Q16 30 22 26 Z') +
      `<path d="M40 22 L36 34 M50 26 L46 38 M60 30 L56 42" stroke="${GREEN}" stroke-width="2.5"/>`,
  },
  dressing: {
    color: GREEN, sun: [64, 20],
    emblem: `<circle cx="44" cy="34" r="16" fill="${PAPER}" stroke="${INK}" stroke-width="3"/><circle cx="44" cy="34" r="6" fill="${INK}"/>` +
      P('M58 40 L84 52 L80 58 L54 46 Z', `fill="${PAPER}" stroke="${INK}" stroke-width="2.5"`),
  },
  knitter: {
    color: GREEN, sun: [70, 20],
    emblem: P('M22 20 L56 20 L62 30 L56 40 L22 40 Z') + `<rect x="26" y="24" width="18" height="8" fill="${GREEN}"/>` +
      line('M30 40 L26 56') + P('M62 28 L78 30 L78 32 L62 32 Z', `fill="${RED}" stroke="${INK}" stroke-width="1"`) +
      `<path d="M80 26 q4 5 0 10" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
  },
  triage: {
    color: RED, sun: [62, 22],
    emblem: `<circle cx="42" cy="32" r="15" fill="none" stroke="${INK}" stroke-width="3"/>` + line('M42 12 L42 52 M22 32 L62 32') +
      P('M66 38 L72 38 L72 44 L78 44 L78 50 L72 50 L72 56 L66 56 L66 50 L60 50 L60 44 L66 44 Z', `fill="${GREEN}" stroke="${INK}" stroke-width="1.5"`),
  },
  stomp: {
    color: MUSTARD, sun: [64, 18],
    emblem: P('M30 8 L44 8 L46 36 L66 42 Q72 44 72 50 L72 54 L28 54 L28 44 Z') + hi('M34 12 L36 38') +
      `<path d="M20 58 L80 58" stroke="${INK}" stroke-width="3"/><path d="M24 58 l-6 -6 M76 58 l6 -6 M50 58 l0 -3" stroke="${RED}" stroke-width="2"/>`,
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

const GERM_COLOR: Record<string, string> = {
  'crystal-bones': TEAL, 'resonant-core': COBALT, surplus: MUSTARD, gatesight: VIOLET, lungs: COBALT,
  marrow: PAPER, carrion: RED, heart: RED, sparecell: GREEN, heirloom: VIOLET,
};

/** A germline plate: a double helix unwinding behind the gene's glyph. */
export function germArt(id: string, glyph: string): string {
  const col = GERM_COLOR[id] ?? MUSTARD;
  const rungs = Array.from({ length: 11 }, (_, i) => {
    const x = 8 + i * 8.4;
    const a = Math.sin(i * 0.75) * 16;
    return `<path d="M${x.toFixed(1)} ${(30 - a).toFixed(1)} L${x.toFixed(1)} ${(30 + a).toFixed(1)}" stroke="${INK}" stroke-width="1.4" stroke-dasharray="2 1.5"/>`;
  }).join('');
  const strand = (sign: number) => {
    const pts = Array.from({ length: 41 }, (_, i) => {
      const x = 8 + i * 2.1;
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${(30 - sign * Math.sin((x - 8) * 0.089) * 16).toFixed(1)}`;
    }).join(' ');
    return `<path d="${pts}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  };
  return `<svg class="art" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="100" height="60" fill="${PAPER}"/>
    <circle cx="50" cy="30" r="20" fill="${col}"/>
    <circle cx="50" cy="30" r="20" fill="url(#ht-paper)"/>
    ${rungs}${strand(1)}${strand(-1)}
    <circle cx="50" cy="30" r="11" fill="${INK}"/>
    <text x="50" y="35" text-anchor="middle" font-size="14" font-family="system-ui, sans-serif" fill="${PAPER}">${glyph}</text>
  </svg>`;
}
