import type { Game, GameEvent } from '../core/game';
import type { Segment } from '../core/types';
import { CREATURE_SIZE, drawCreature } from './creatures';
import { INK, mix } from './palette';
import { fillPoly, noise, sketchStroke, type Pt } from './sketch';

const NEAR = 0.22;
const DRAW_AHEAD = 8;

interface EnemyFx {
  flash: number;
  lunge: number;
  dead: number;
  dying: boolean;
}

/** Horizontal slot (0..1) for enemy i of n. Shared with the DOM overlay. */
export function enemySlot(i: number, n: number): number {
  return (i + 1) / (n + 1);
}

/**
 * Draws the first-person corridor as stacked, hand-drawn bulkhead layers,
 * like a paper diorama. Each corridor section is one layer.
 */
export class Stage {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private cam = 0;
  private camFrom = 0;
  private camTo = 0;
  private walkT = 1;
  private shake = 0;
  private hurt = 0;
  private heal = 0;
  private bump = 0;
  private pulse = 0;
  private enemyFx = new Map<number, EnemyFx>();
  private last = 0;
  private time = 0;
  private readonly reduced: boolean;

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    this.ctx = canvas.getContext('2d')!;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.setGame(game);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  setGame(game: Game) {
    this.game = game;
    this.cam = this.camFrom = this.camTo = game.pos;
    this.walkT = 1;
    this.enemyFx.clear();
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  private fx(uid: number): EnemyFx {
    let f = this.enemyFx.get(uid);
    if (!f) {
      f = { flash: 0, lunge: 0, dead: 0, dying: false };
      this.enemyFx.set(uid, f);
    }
    return f;
  }

  onEvent(e: GameEvent) {
    switch (e.type) {
      case 'step':
        this.camFrom = this.cam;
        this.camTo = this.game.pos;
        this.walkT = 0;
        break;
      case 'bump': this.bump = 1; break;
      case 'enemyHit': this.fx(e.uid).flash = 1; this.shake = Math.max(this.shake, 0.35); break;
      case 'enemyDie': this.fx(e.uid).dying = true; break;
      case 'enemyAct': this.fx(e.uid).lunge = 1; break;
      case 'playerHit':
        if (e.amount > 0) {
          this.hurt = 1;
          this.shake = 1;
        }
        break;
      case 'heal': this.heal = 1; break;
      case 'reveal':
      case 'splice': this.pulse = 1; break;
      default: break;
    }
  }

  private loop(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    if (this.walkT < 1) {
      this.walkT = Math.min(1, this.walkT + dt / (this.reduced ? 0.2 : 0.62));
      const e = 1 - Math.pow(1 - this.walkT, 3);
      this.cam = this.camFrom + (this.camTo - this.camFrom) * e;
    } else {
      this.cam = this.game.pos;
    }
    const decay = (v: number, rate: number) => Math.max(0, v - dt * rate);
    this.shake = decay(this.shake, 3);
    this.hurt = decay(this.hurt, 2.2);
    this.heal = decay(this.heal, 1.5);
    this.bump = decay(this.bump, 3);
    this.pulse = decay(this.pulse, 1.2);
    for (const f of this.enemyFx.values()) {
      f.flash = decay(f.flash, 5);
      f.lunge = decay(f.lunge, 3);
      if (f.dying) f.dead = Math.min(1, f.dead + dt * 2);
    }
  }

  // ------------------------------------------------------------ geometry

  private get cx() {
    return this.W / 2;
  }

  private get cy() {
    const walking = this.walkT < 1 ? Math.sin(this.walkT * Math.PI * 2) * this.H * 0.012 : 0;
    return this.H * 0.47 + walking;
  }

  /** Octagon of a bulkhead at depth z. Index 0 is top-left, clockwise. */
  private octagon(z: number, grow = 1): Pt[] {
    const a = (this.W * 0.56 * grow) / z;
    const b = (this.H * 0.52 * grow) / z;
    const c = Math.min(a, b) * 0.38;
    const x = this.cx;
    const y = this.cy;
    return [
      [x - a + c, y - b], [x + a - c, y - b], [x + a, y - b + c], [x + a, y + b - c],
      [x + a - c, y + b], [x - a + c, y + b], [x - a, y + b - c], [x - a, y - b + c],
    ];
  }

  private unit(z: number) {
    return (this.H * 0.52) / z;
  }

  private floorY(z: number) {
    return this.cy + this.unit(z);
  }

  private fog(z: number) {
    return Math.min(1, Math.max(0, (z - 1.1) / 5.5));
  }

  private get boil() {
    return this.reduced ? 0 : Math.floor(this.time * 6) % 3 * 997;
  }

  // ------------------------------------------------------------ drawing

  private draw() {
    const { ctx } = this;
    const g = this.game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = INK.void;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    if (this.shake > 0 && !this.reduced) {
      ctx.translate(noise(this.time * 70) * this.shake * 7, noise(this.time * 90 + 3) * this.shake * 5);
    }
    if (this.bump > 0) {
      const k = 1 + Math.sin(this.bump * Math.PI) * 0.03;
      ctx.translate(this.cx, this.cy);
      ctx.scale(k, k);
      ctx.translate(-this.cx, -this.cy);
    }

    const first = Math.max(0, Math.floor(this.cam) - 1);
    const lastSeg = Math.min(g.segments.length - 1, Math.floor(this.cam) + DRAW_AHEAD);
    for (let i = lastSeg; i >= first; i--) this.drawSection(i);

    const inFight = g.phase === 'combat' || g.phase === 'harvest';
    if (inFight) this.drawFight();
    ctx.restore();
    this.drawOverlays(inFight);
  }

  private drawSection(i: number) {
    const { ctx } = this;
    const g = this.game;
    const seg = g.segments[i];
    const zn = i - this.cam + 1;
    const zf = zn + 1;
    if (zf < NEAR) return;
    const nearZ = Math.max(zn, NEAR);
    const near = this.octagon(nearZ);
    const far = this.octagon(zf);
    const fogMid = this.fog((nearZ + zf) / 2);
    const hidden = seg.dark && !seg.lit && i > g.pos;

    // Exit light at the end of the corridor.
    if (seg.feature === 'exit') {
      const grd = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.unit(zf) * 1.6);
      grd.addColorStop(0, '#fff6e0');
      grd.addColorStop(0.5, '#e8d3a8');
      grd.addColorStop(1, '#6b5d45');
      ctx.fillStyle = grd;
      fillPoly(ctx, far);
    }

    // Walls, floor and ceiling of this section.
    const faceBase = ['#1b1d22', '#23262c', '#2d3036', '#2a2522', '#352e29', '#2a2522', '#2d3036', '#23262c'];
    const lampOn = this.lampOn(i);
    for (let k = 0; k < 8; k++) {
      let col = faceBase[k];
      if (lampOn && !hidden) col = mix(col, INK.sodium, 0.07 * (1 - fogMid));
      if (seg.feature === 'exit') col = mix(col, '#e8d3a8', 0.25);
      ctx.fillStyle = mix(col, INK.void, hidden ? 0.85 : fogMid);
      fillPoly(ctx, [near[k], near[(k + 1) % 8], far[(k + 1) % 8], far[k]]);
    }

    // Ink details: seams, grating, pipes.
    const inkAlpha = (hidden ? 0.12 : 0.85) * (1 - fogMid * 0.85);
    ctx.lineWidth = Math.max(0.8, this.unit(nearZ) * 0.006);
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = inkAlpha * 0.55;
    const s = i * 100 + this.boil;
    for (let k = 0; k < 8; k++) sketchStroke(ctx, [near[k], far[k]], s + k, 1.2);
    // floor grating
    for (let q = 1; q < 4; q++) {
      const z = nearZ + (zf - nearZ) * (q / 4);
      const o = this.octagon(z);
      sketchStroke(ctx, [o[5], o[4]], s + 20 + q, 1);
    }
    // wall panel seams
    const mid = this.octagon((nearZ + zf) / 2);
    sketchStroke(ctx, [mid[2], mid[3]], s + 30, 1);
    sketchStroke(ctx, [mid[6], mid[7]], s + 31, 1);
    // a pipe on the right wall, cables sagging from the ceiling
    ctx.globalAlpha = inkAlpha * 0.7;
    const pipeAt = (o: Pt[]): Pt => [o[2][0] + (o[3][0] - o[2][0]) * 0.2, o[2][1] + (o[3][1] - o[2][1]) * 0.2];
    sketchStroke(ctx, [pipeAt(near), pipeAt(far)], s + 40, 1.4);
    if (i % 2 === 0) {
      const a = mid[0];
      const b = mid[1];
      const sag = this.unit((nearZ + zf) / 2) * (0.18 + 0.05 * Math.sin(this.time * 0.8 + i));
      sketchStroke(ctx, [a, [(a[0] + b[0]) / 2, a[1] + sag], b], s + 50, 1.2);
    }
    ctx.globalAlpha = 1;

    // Contents of the section.
    const zMid = (nearZ + zf) / 2;
    if (!hidden) this.drawFeature(seg, i, zMid, zn);
    else this.drawDarkness(seg, near, zMid);

    // Bulkhead ring on the near edge.
    if (zn > NEAR) this.drawRing(i, zn, lampOn, hidden);

    // Hatch and wreckage sit in the near bulkhead's opening.
    if (!hidden && zn > NEAR) {
      if (seg.feature === 'door' && !seg.cleared) this.drawDoor(i, zn);
      if (seg.feature === 'debris') this.drawDebris(i, zn + 0.08, seg.cleared);
    }
  }

  private lampOn(i: number) {
    const broken = i % 4 === 3;
    const n = noise(i * 7.3 + Math.floor(this.time * (broken ? 9 : 3)));
    return broken ? n > 0.1 : n > -0.92;
  }

  private drawRing(i: number, z: number, lampOn: boolean, hidden: boolean) {
    const { ctx } = this;
    const inner = this.octagon(z);
    const outer = this.octagon(z, 1.16);
    const fog = this.fog(z);
    ctx.beginPath();
    outer.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    inner.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = mix(i % 3 === 1 ? INK.rust : '#2e2a28', INK.void, hidden ? 0.8 : fog);
    ctx.fill('evenodd');

    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = (1 - fog * 0.9) * (hidden ? 0.25 : 1);
    ctx.lineWidth = Math.max(1, this.unit(z) * 0.009);
    const s = i * 50 + 7 + this.boil;
    sketchStroke(ctx, inner, s, 1.5, true);
    ctx.globalAlpha *= 0.6;
    sketchStroke(ctx, outer, s + 300, 1.5, true);
    // bolts
    ctx.fillStyle = INK.boneDim;
    for (let k = 0; k < 8; k++) {
      const p = inner[k];
      const q = outer[k];
      ctx.beginPath();
      ctx.arc((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.max(1, this.unit(z) * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Lamp above the opening.
    const lx = this.cx;
    const ly = (inner[0][1] + outer[0][1]) / 2;
    const lw = this.unit(z) * 0.18;
    const lh = this.unit(z) * 0.035;
    ctx.fillStyle = lampOn && !hidden ? INK.sodium : '#3a3226';
    ctx.globalAlpha = 1 - fog * 0.7;
    ctx.fillRect(lx - lw / 2, ly - lh / 2, lw, lh);
    if (lampOn && !hidden) {
      const r = this.unit(z) * 0.9;
      const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      grd.addColorStop(0, 'rgba(227,163,59,0.28)');
      grd.addColorStop(1, 'rgba(227,163,59,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(lx - r, ly - r * 0.2, r * 2, r * 1.2);
    }
    ctx.globalAlpha = 1;
  }

  private drawDarkness(seg: Segment, near: Pt[], zMid: number) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(5,6,8,0.96)';
    fillPoly(ctx, near);
    // Something glints in there.
    if (seg.feature === 'enemies' && !seg.cleared) {
      const u = this.unit(zMid);
      const y = this.floorY(zMid) - u * 0.5;
      const blink = Math.sin(this.time * 0.9) > -0.7;
      if (blink) {
        ctx.fillStyle = INK.sodium;
        for (const dx of [-0.35, -0.22, 0.2, 0.33]) {
          ctx.beginPath();
          ctx.arc(this.cx + dx * u, y + noise(dx * 10) * u * 0.1, Math.max(1, u * 0.018), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawFeature(seg: Segment, i: number, zMid: number, zn: number) {
    const g = this.game;
    const u = this.unit(zMid);
    const fy = this.floorY(zMid);
    const dim = this.fog(zMid);
    switch (seg.feature) {
      case 'crate': this.drawCrate(this.cx + u * 0.42, fy, u, seg.cleared, dim, i); break;
      case 'pod': this.drawPod(this.cx - u * 0.35, fy, u, seg.cleared, dim, i); break;
      case 'enemies': {
        const inFightHere = i === g.pos && (g.phase === 'combat' || g.phase === 'harvest');
        if (seg.cleared || inFightHere) {
          if (seg.cleared) this.drawStains(fy, u, i, dim);
          break;
        }
        const list = seg.encounter ?? [];
        list.forEach((id, k) => {
          const x = this.cx + (enemySlot(k, list.length) - 0.5) * u * 1.4;
          drawCreature(this.ctx, id, x, fy, u * 0.8, {
            t: this.time, boil: this.boil, flash: 0, lunge: 0, dead: 0, seed: k + i, dim: Math.min(0.9, dim + 0.25),
          });
        });
        break;
      }
      default: break;
    }
    void zn;
  }

  private drawCrate(x: number, fy: number, u: number, open: boolean, dim: number, i: number) {
    const { ctx } = this;
    const w = u * 0.34;
    const h = u * 0.24;
    const box: Pt[] = [[x - w / 2, fy - h], [x + w / 2, fy - h], [x + w / 2, fy], [x - w / 2, fy]];
    ctx.fillStyle = mix('#3b3f36', INK.void, dim);
    fillPoly(ctx, box);
    ctx.strokeStyle = INK.bone;
    ctx.lineWidth = Math.max(1, u * 0.008);
    ctx.globalAlpha = 1 - dim * 0.8;
    const s = i * 31 + this.boil;
    sketchStroke(ctx, box, s, 1, true);
    sketchStroke(ctx, [[x - w / 2, fy - h * 0.55], [x + w / 2, fy - h * 0.55]], s + 9, 1);
    if (open) {
      sketchStroke(ctx, [[x - w / 2, fy - h], [x - w * 0.3, fy - h * 1.7], [x + w * 0.6, fy - h * 1.5], [x + w / 2, fy - h]], s + 12, 1);
    } else {
      ctx.fillStyle = INK.sodium;
      ctx.fillRect(x - w * 0.06, fy - h * 0.7, w * 0.12, h * 0.14);
      // stencil marks
      ctx.fillStyle = mix(INK.boneDim, INK.void, dim);
      for (let k = 0; k < 3; k++) ctx.fillRect(x - w * 0.4 + k * w * 0.1, fy - h * 0.35, w * 0.06, h * 0.18);
    }
    ctx.globalAlpha = 1;
  }

  private drawPod(x: number, fy: number, u: number, drained: boolean, dim: number, i: number) {
    const { ctx } = this;
    const w = u * 0.34;
    const h = u * 1.2;
    const top = fy - h;
    // glow
    if (!drained) {
      const grd = ctx.createRadialGradient(x, top + h * 0.5, 0, x, top + h * 0.5, u * 0.9);
      grd.addColorStop(0, `rgba(111,163,160,${0.35 * (1 - dim)})`);
      grd.addColorStop(1, 'rgba(111,163,160,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - u, top - u * 0.3, u * 2, h + u * 0.6);
    }
    // liquid
    ctx.fillStyle = mix(drained ? '#1c2324' : '#2f5553', INK.void, dim);
    ctx.beginPath();
    ctx.roundRect(x - w / 2, top, w, h, w / 2);
    ctx.fill();
    // a curled figure floating inside
    if (!drained) {
      const bob = Math.sin(this.time * 0.8 + i) * u * 0.02;
      ctx.fillStyle = mix('#8fb5ae', INK.void, dim + 0.2);
      ctx.beginPath();
      ctx.ellipse(x, top + h * 0.38 + bob, w * 0.18, w * 0.2, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.02, top + h * 0.58 + bob, w * 0.2, h * 0.16, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // bubbles
      ctx.fillStyle = `rgba(216,207,184,${0.5 * (1 - dim)})`;
      for (let b = 0; b < 4; b++) {
        const t = (this.time * 0.25 + b * 0.27 + i) % 1;
        ctx.beginPath();
        ctx.arc(x + noise(b + i) * w * 0.3, top + h * (0.95 - t * 0.9), u * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = 1 - dim * 0.8;
    ctx.lineWidth = Math.max(1, u * 0.009);
    const s = i * 17 + this.boil;
    sketchStroke(ctx, [[x - w / 2, top + w / 2], [x - w / 2, fy - w / 2]], s, 1);
    sketchStroke(ctx, [[x + w / 2, top + w / 2], [x + w / 2, fy - w / 2]], s + 3, 1);
    // caps and hoses
    ctx.fillStyle = mix('#3a3632', INK.void, dim);
    ctx.fillRect(x - w * 0.6, top - u * 0.05, w * 1.2, u * 0.08);
    ctx.fillRect(x - w * 0.6, fy - u * 0.06, w * 1.2, u * 0.06);
    sketchStroke(ctx, [[x, top - u * 0.05], [x + w * 0.3, top - u * 0.3], [x + w * 0.9, top - u * 0.4]], s + 8, 1.4);
    ctx.globalAlpha = 1;
  }

  private drawStains(fy: number, u: number, i: number, dim: number) {
    const { ctx } = this;
    ctx.fillStyle = mix('#3a1a20', INK.void, dim);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(this.cx + noise(i * 9 + k) * u * 0.5, fy - u * 0.04 + noise(k + 3) * u * 0.03, u * (0.12 + 0.05 * k), u * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawDoor(i: number, z: number) {
    const { ctx } = this;
    const o = this.octagon(z, 0.995);
    ctx.fillStyle = mix('#3a3a3a', INK.void, this.fog(z));
    fillPoly(ctx, o);
    // hazard chevrons along the split
    ctx.save();
    ctx.beginPath();
    o.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    const u = this.unit(z);
    ctx.fillStyle = mix(INK.sodium, INK.void, 0.35 + this.fog(z));
    for (let k = -8; k < 8; k++) {
      const x = this.cx + k * u * 0.14;
      fillPoly(ctx, [[x, this.cy - u * 0.08], [x + u * 0.07, this.cy - u * 0.08], [x + u * 0.14, this.cy + u * 0.08], [x + u * 0.07, this.cy + u * 0.08]]);
    }
    ctx.restore();
    ctx.strokeStyle = INK.bone;
    ctx.lineWidth = Math.max(1, u * 0.01);
    ctx.globalAlpha = 1 - this.fog(z) * 0.8;
    const s = i * 13 + this.boil;
    sketchStroke(ctx, [[this.cx - u, this.cy - u * 0.08], [this.cx + u, this.cy - u * 0.08]], s, 1.2);
    sketchStroke(ctx, [[this.cx - u, this.cy + u * 0.08], [this.cx + u, this.cy + u * 0.08]], s + 2, 1.2);
    // locking wheel
    const r = u * 0.16;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy - u * 0.4, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI + this.time * 0.05;
      sketchStroke(ctx, [[this.cx + Math.cos(a) * r, this.cy - u * 0.4 + Math.sin(a) * r], [this.cx - Math.cos(a) * r, this.cy - u * 0.4 - Math.sin(a) * r]], s + 5 + k, 1);
    }
    // red status light
    ctx.fillStyle = INK.flesh;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 3);
    ctx.fillRect(this.cx + u * 0.5, this.cy + u * 0.3, u * 0.06, u * 0.06);
    ctx.globalAlpha = 1;
  }

  private drawDebris(i: number, z: number, cleared: boolean) {
    const { ctx } = this;
    const u = this.unit(z);
    const fy = this.floorY(z);
    const s = i * 71 + this.boil;
    const beams: [number, number, number, number][] = cleared
      ? [[-0.95, -0.15, -0.55, 0.0], [0.6, 0.0, 0.95, -0.3]]
      : [[-0.95, -0.55, 0.9, -0.05], [-0.8, 0.0, 0.95, -0.7], [-0.5, -0.9, 0.3, 0.0], [0.1, -0.2, 0.95, -0.35]];
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of beams) {
      const a: Pt = [this.cx + x1 * u, fy + y1 * u];
      const b: Pt = [this.cx + x2 * u, fy + y2 * u];
      ctx.strokeStyle = mix('#4d4038', INK.void, this.fog(z));
      ctx.lineWidth = u * 0.09;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.strokeStyle = INK.bone;
      ctx.lineWidth = Math.max(1, u * 0.008);
      sketchStroke(ctx, [a, b], s + x1 * 10, 1.2);
    }
    // rubble
    ctx.fillStyle = mix('#3a322d', INK.void, this.fog(z));
    for (let k = 0; k < (cleared ? 3 : 7); k++) {
      const x = this.cx + noise(s * 0 + i * 5 + k) * u * 0.8;
      const r = u * (0.05 + Math.abs(noise(k + i)) * 0.07);
      fillPoly(ctx, [[x - r, fy], [x - r * 0.4, fy - r], [x + r * 0.6, fy - r * 0.8], [x + r, fy]]);
    }
  }

  private drawFight() {
    const g = this.game;
    const enemies = g.combat?.enemies ?? [];
    const corpses = g.corpses;
    const n = enemies.length || corpses.length;
    const { ctx } = this;
    // darken the corridor so the fight reads first
    ctx.fillStyle = 'rgba(8,9,11,0.35)';
    ctx.fillRect(0, 0, this.W, this.H);

    const list = enemies.length
      ? enemies.map((e) => ({ uid: e.uid, defId: e.defId, alive: e.alive, taken: false }))
      : corpses.map((k) => ({ uid: k.uid, defId: k.defId, alive: false, taken: k.taken }));
    list.forEach((e, i) => {
      if (e.taken) return;
      const size = CREATURE_SIZE[e.defId] ?? 1;
      const x = enemySlot(i, n) * this.W;
      const base = Math.min(this.H * 0.5, (this.W / (n + 0.6)) * 0.95);
      const u = base * (n === 1 ? 1 : 0.95) * Math.min(1.2, 0.75 + size * 0.25);
      const fx = this.fx(e.uid);
      if (!e.alive) fx.dying = true;
      drawCreature(ctx, e.defId, x, this.H * 0.94, u, {
        t: this.time + i * 1.3, boil: this.boil, flash: fx.flash, lunge: fx.lunge, dead: fx.dead, seed: i + 1, dim: 0,
      });
    });
  }

  private drawOverlays(inFight: boolean) {
    const { ctx } = this;
    const vg = ctx.createRadialGradient(this.cx, this.H * 0.5, this.H * 0.2, this.cx, this.H * 0.5, this.H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${inFight ? 0.75 : 0.6})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);
    if (this.hurt > 0) {
      ctx.fillStyle = `rgba(185,80,90,${this.hurt * 0.35})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.heal > 0) {
      ctx.fillStyle = `rgba(111,163,160,${this.heal * 0.15})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (this.pulse > 0) {
      ctx.strokeStyle = `rgba(111,163,160,${this.pulse * 0.6})`;
      ctx.lineWidth = 2;
      const r = (1 - this.pulse) * this.W;
      ctx.beginPath();
      ctx.ellipse(this.cx, this.cy, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // faint scanlines, like an old helmet feed
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < this.H; y += 3) ctx.fillRect(0, y, this.W, 1);
  }
}
