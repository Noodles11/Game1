import { INK } from './palette';
import { fillPoly, noise, sketchEllipse, sketchStroke, smoothPath, type Pt } from './sketch';

export interface CreatureFx {
  t: number; // seconds, for idle motion
  boil: number; // line-boil seed offset
  flash: number; // 0..1 hit flash
  lunge: number; // 0..1 attack lunge
  dead: number; // 0 alive .. 1 fully collapsed
  seed: number;
  dim: number; // 0 fully lit .. 1 lost in fog
}

/** Relative height of each creature, in corridor units. */
export const CREATURE_SIZE: Record<string, number> = {
  tick: 0.55,
  copy: 1.0,
  husk: 1.05,
  choir: 1.55,
};

/**
 * Draw a creature standing on (x, footY). u is one corridor unit in pixels.
 */
export function drawCreature(
  ctx: CanvasRenderingContext2D, id: string, x: number, footY: number, u: number, fx: CreatureFx,
) {
  ctx.save();
  const lungeScale = 1 + fx.lunge * 0.16;
  ctx.translate(x + (fx.flash > 0 ? noise(fx.t * 90) * fx.flash * u * 0.05 : 0), footY + fx.lunge * u * 0.1);
  ctx.scale(lungeScale, lungeScale * (1 - fx.dead * 0.62));
  if (fx.dead > 0) ctx.globalAlpha *= 1 - fx.dead * 0.35;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, u * 0.012);
  const s = fx.seed * 1000 + fx.boil;
  const line = fx.flash > 0.5 ? '#ffffff' : INK.bone;
  ctx.strokeStyle = line;

  switch (id) {
    case 'tick': drawTick(ctx, u, fx, s); break;
    case 'copy': drawCopy(ctx, u, fx, s); break;
    case 'husk': drawHusk(ctx, u, fx, s); break;
    case 'choir': drawChoir(ctx, u, fx, s); break;
    default: break;
  }

  if (fx.flash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,240,230,${fx.flash * 0.7})`;
    ctx.fillRect(-u * 2, -u * 2.2, u * 4, u * 2.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (fx.dim > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(11,13,16,${fx.dim})`;
    ctx.fillRect(-u * 2, -u * 2.2, u * 4, u * 2.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, t: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.globalAlpha *= 0.55;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.globalAlpha /= 0.55;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (0.3 + 0.7 * Math.abs(Math.sin(t * 0.7))), 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- Hull Tick

function drawTick(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 0.55;
  const bob = Math.sin(fx.t * 9) * U * 0.02;
  const by = -U * 0.42 + bob;
  // legs
  ctx.lineWidth = Math.max(1, u * 0.01);
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const twitch = Math.sin(fx.t * 14 + i * 1.7) * U * 0.04;
    const hip: Pt = [side * U * (0.18 + k * 0.08), by + U * 0.05];
    const knee: Pt = [side * U * (0.45 + k * 0.12), by - U * (0.25 - k * 0.05) + twitch];
    const foot: Pt = [side * U * (0.55 + k * 0.16), 0];
    sketchStroke(ctx, [hip, knee, foot], s + i * 7, U * 0.015);
  }
  // body
  ctx.fillStyle = INK.fleshDark;
  const body = sketchEllipse(0, by, U * 0.42, U * 0.3, s);
  smoothPath(ctx, body);
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, u * 0.012);
  sketchStroke(ctx, body, s + 3, U * 0.012, true);
  // carapace plates
  for (let i = -1; i <= 1; i++) {
    sketchStroke(ctx, [[i * U * 0.14 - U * 0.1, by - U * 0.26], [i * U * 0.14 + U * 0.02, by + U * 0.05]], s + 40 + i, U * 0.01);
  }
  eye(ctx, U * 0.2, by - U * 0.02, U * 0.07, INK.sodium, fx.t + fx.seed);
}

// ------------------------------------------------------------- Mewling Copy

function drawCopy(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const sway = Math.sin(fx.t * 1.3 + fx.seed) * u * 0.03;
  const w = u * 0.012;
  // long arms to the floor
  ctx.fillStyle = INK.fleshDark;
  const shoulderY = -u * 0.62;
  for (const side of [-1, 1]) {
    const elbow: Pt = [side * u * 0.36 + sway, -u * 0.35];
    const hand: Pt = [side * u * 0.3 + sway * 0.4, -u * 0.02];
    sketchStroke(ctx, [[side * u * 0.14 + sway, shoulderY], elbow, hand], s + side * 20, w);
    // fingers
    for (let f = -1; f <= 1; f++) {
      sketchStroke(ctx, [hand, [hand[0] + side * u * 0.03 + f * u * 0.03, 0]], s + 60 + f + side * 5, w * 0.5);
    }
  }
  // hunched torso
  const torso: Pt[] = [
    [-u * 0.16 + sway, shoulderY], [u * 0.17 + sway, shoulderY - u * 0.02], [u * 0.14, -u * 0.22],
    [u * 0.2, -u * 0.02], [-u * 0.2, -u * 0.02], [-u * 0.12, -u * 0.24],
  ];
  ctx.fillStyle = '#6b5c55';
  fillPoly(ctx, torso);
  sketchStroke(ctx, torso, s + 5, w, true);
  // ribs
  for (let r = 0; r < 3; r++) {
    const y = shoulderY + u * (0.1 + r * 0.08);
    sketchStroke(ctx, [[-u * 0.1 + sway, y], [u * 0.1 + sway, y + u * 0.02]], s + 80 + r, w * 0.6);
  }
  // oversized head, tilted
  const tilt = Math.sin(fx.t * 0.9 + fx.seed) * 0.25;
  ctx.save();
  ctx.translate(sway * 1.3, shoulderY - u * 0.2);
  ctx.rotate(tilt);
  ctx.fillStyle = INK.bone;
  const head = sketchEllipse(0, 0, u * 0.2, u * 0.24, s + 9);
  smoothPath(ctx, head);
  ctx.fill();
  ctx.strokeStyle = '#3a2d2a';
  sketchStroke(ctx, head, s + 11, w, true);
  // hollow sockets and a stretched mouth
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(-u * 0.07, -u * 0.03, u * 0.04, u * 0.055, 0, 0, Math.PI * 2);
  ctx.ellipse(u * 0.07, -u * 0.03, u * 0.04, u * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  const open = 0.3 + 0.7 * Math.abs(Math.sin(fx.t * 2.1));
  ctx.beginPath();
  ctx.ellipse(0, u * 0.11, u * 0.05, u * 0.035 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------------- Custodian Husk

function drawHusk(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const hover = Math.sin(fx.t * 2) * u * 0.03;
  const top = -u * 1.0 + hover;
  const w = u * 0.012;
  // thruster glow
  const g = ctx.createRadialGradient(0, -u * 0.12 + hover, 0, 0, -u * 0.12 + hover, u * 0.35);
  g.addColorStop(0, 'rgba(111,163,160,0.55)');
  g.addColorStop(1, 'rgba(111,163,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-u * 0.4, -u * 0.5 + hover, u * 0.8, u * 0.6);
  // body box
  const body: Pt[] = [
    [-u * 0.3, top + u * 0.1], [u * 0.28, top + u * 0.06], [u * 0.32, top + u * 0.72],
    [u * 0.12, top + u * 0.82], [-u * 0.14, top + u * 0.82], [-u * 0.32, top + u * 0.7],
  ];
  ctx.fillStyle = INK.hullLit;
  fillPoly(ctx, body);
  sketchStroke(ctx, body, s, w, true);
  // hazard band
  ctx.fillStyle = INK.rust;
  fillPoly(ctx, [[-u * 0.31, top + u * 0.56], [u * 0.31, top + u * 0.54], [u * 0.315, top + u * 0.62], [-u * 0.315, top + u * 0.64]]);
  // antenna with blinking light
  sketchStroke(ctx, [[u * 0.16, top + u * 0.08], [u * 0.22, top - u * 0.14]], s + 3, w);
  if (Math.sin(fx.t * 5) > 0.2) eye(ctx, u * 0.22, top - u * 0.15, u * 0.025, INK.flesh, 1.6);
  // pale human face mask, slightly crooked
  ctx.save();
  ctx.translate(-u * 0.02, top + u * 0.32);
  ctx.rotate(-0.12 + Math.sin(fx.t * 0.6) * 0.03);
  ctx.fillStyle = INK.bone;
  const face = sketchEllipse(0, 0, u * 0.13, u * 0.17, s + 5);
  smoothPath(ctx, face);
  ctx.fill();
  ctx.strokeStyle = '#3a2d2a';
  sketchStroke(ctx, face, s + 6, w * 0.8, true);
  ctx.fillStyle = INK.void;
  ctx.beginPath();
  ctx.ellipse(-u * 0.05, -u * 0.03, u * 0.025, u * 0.012, 0.1, 0, Math.PI * 2);
  ctx.ellipse(u * 0.05, -u * 0.03, u * 0.025, u * 0.012, -0.1, 0, Math.PI * 2);
  ctx.fill();
  sketchStroke(ctx, [[-u * 0.04, u * 0.08], [u * 0.04, u * 0.075]], s + 7, w * 0.6);
  // stitches holding it on
  ctx.strokeStyle = INK.flesh;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * u * 0.13;
    const py = Math.sin(a) * u * 0.17;
    sketchStroke(ctx, [[px * 0.9, py * 0.9], [px * 1.15, py * 1.12]], s + 20 + i, w * 0.4);
  }
  ctx.restore();
  ctx.strokeStyle = INK.bone;
  // claw arm
  const reach = fx.lunge * u * 0.1;
  const shoulder: Pt = [u * 0.3, top + u * 0.3];
  const elbow: Pt = [u * 0.5 + reach, top + u * 0.45];
  const wrist: Pt = [u * 0.42 + reach, top + u * 0.72];
  sketchStroke(ctx, [shoulder, elbow, wrist], s + 30, w * 1.4);
  sketchStroke(ctx, [wrist, [wrist[0] + u * 0.08, wrist[1] + u * 0.08]], s + 31, w);
  sketchStroke(ctx, [wrist, [wrist[0] - u * 0.04, wrist[1] + u * 0.1]], s + 32, w);
}

// ----------------------------------------------------------------- The Choir

function drawChoir(ctx: CanvasRenderingContext2D, u: number, fx: CreatureFx, s: number) {
  const U = u * 1.1;
  const w = u * 0.011;
  const breathe = 1 + Math.sin(fx.t * 1.1) * 0.02;
  // fleshy mound
  const mound: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    const r = U * (0.62 + noise(i + 3) * 0.06) * breathe;
    mound.push([Math.cos(a) * r, Math.sin(a) * r * 0.95]);
  }
  ctx.fillStyle = INK.fleshDark;
  fillPoly(ctx, mound);
  sketchStroke(ctx, mound, s, w, false);
  // tendrils onto the floor
  for (let i = 0; i < 7; i++) {
    const x0 = (i / 6 - 0.5) * U * 1.1;
    const sway = Math.sin(fx.t * 1.6 + i) * U * 0.05;
    sketchStroke(ctx, [[x0, -U * 0.1], [x0 + sway, -U * 0.02], [x0 + sway * 2 + U * 0.04, 0]], s + 50 + i, w);
  }
  // heads, singing out of phase
  const heads: [number, number, number][] = [
    [0, -0.78, 0.15], [-0.26, -0.62, 0.13], [0.27, -0.63, 0.13], [-0.46, -0.36, 0.12], [0.46, -0.38, 0.12],
    [-0.14, -0.4, 0.12], [0.15, -0.38, 0.12], [0, -0.16, 0.11], [-0.33, -0.12, 0.1], [0.34, -0.14, 0.1],
  ];
  heads.forEach(([hx, hy, hr], i) => {
    const x = hx * U;
    const y = hy * U * breathe;
    const r = hr * U;
    ctx.fillStyle = i % 3 === 0 ? INK.bone : '#bfb49c';
    const hd = sketchEllipse(x, y, r * 0.85, r, s + i * 17);
    smoothPath(ctx, hd);
    ctx.fill();
    ctx.strokeStyle = '#3a2d2a';
    sketchStroke(ctx, hd, s + i * 17 + 5, w * 0.7, true);
    ctx.fillStyle = INK.void;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32, y - r * 0.18, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.32, y - r * 0.18, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    const open = 0.2 + 0.8 * Math.abs(Math.sin(fx.t * 2.4 + i * 0.9));
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.38, r * 0.2, r * 0.3 * open, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = INK.bone;
}
