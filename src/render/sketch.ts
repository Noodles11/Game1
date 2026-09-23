/**
 * Hand-drawn line helpers. Jitter is seeded, so a shape keeps its wobble
 * between frames. Changing the seed a few times a second gives a "line boil".
 */
export function noise(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export type Pt = [number, number];

export function sketchLine(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number, wob: number,
) {
  const j = wob;
  ctx.moveTo(x1 + noise(seed) * j, y1 + noise(seed + 1) * j);
  const mx = (x1 + x2) / 2 + noise(seed + 2) * j * 1.6;
  const my = (y1 + y2) / 2 + noise(seed + 3) * j * 1.6;
  ctx.quadraticCurveTo(mx, my, x2 + noise(seed + 4) * j, y2 + noise(seed + 5) * j);
}

/** Stroke a polyline twice with different jitter, like an ink sketch. */
export function sketchStroke(
  ctx: CanvasRenderingContext2D, pts: Pt[], seed: number, wob: number, closed = false,
) {
  const n = closed ? pts.length : pts.length - 1;
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sketchLine(ctx, a[0], a[1], b[0], b[1], seed + i * 13 + pass * 101, wob * (pass ? 1.4 : 1));
    }
    ctx.globalAlpha *= pass ? 0.45 : 1;
    ctx.stroke();
    if (pass) ctx.globalAlpha /= 0.45;
  }
}

export function fillPoly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** Wobbly ellipse outline. */
export function sketchEllipse(x: number, y: number, rx: number, ry: number, seed: number, steps = 14): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = 1 + noise(seed + i) * 0.04;
    pts.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
  }
  return pts;
}

export function smoothPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}
