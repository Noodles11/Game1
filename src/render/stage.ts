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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
  fade: number;
}

/** Colours and props for each place the corridor can be. */
interface Biome {
  faces: string[];
  lamp: string;
  /** "r,g,b" for the lamp glow gradient. */
  glow: string;
  lampOff: string;
  ring: [string, string];
  exit: [string, string, string];
  crystals: boolean;
  pipes: boolean;
  /** Open caves behind everything, seen through caverns. */
  backdrop: boolean;
  /** Rough rock arches instead of bulkhead rings. */
  rough: boolean;
  texture: 'hull' | 'crystal';
  flora: boolean;
}

const BIOMES: Record<string, Biome> = {
  lab: {
    faces: ['#1b1d22', '#23262c', '#2d3036', '#2a2522', '#352e29', '#2a2522', '#2d3036', '#23262c'],
    lamp: INK.sodium, glow: '227,163,59', lampOff: '#3a3226',
    ring: [INK.rust, '#2e2a28'], exit: ['#fff6e0', '#e8d3a8', '#6b5d45'],
    crystals: false, pipes: true, backdrop: false, rough: false, texture: 'hull', flora: false,
  },
  kessra: {
    faces: ['#131c25', '#192731', '#1f313d', '#17232c', '#213746', '#17232c', '#1f313d', '#192731'],
    lamp: '#9fe6f0', glow: '127,216,232', lampOff: '#24343e',
    ring: ['#23404d', '#1b2a34'], exit: ['#f2fbff', '#b8e6f0', '#3f6a7a'],
    crystals: true, pipes: false, backdrop: true, rough: true, texture: 'crystal', flora: true,
  },
};

/** How wide the junction wall's openings spread, as a fraction of the stage width. */
export const PASSAGE_SPREAD = 0.56;

/** Horizontal centre (0..1) of passage i of n at a junction. Shared with the DOM overlay. */
export function passageSlot(i: number, n: number): number {
  return 0.5 + ((i + 0.5) / n - 0.5) * PASSAGE_SPREAD;
}

/** Glow colour for what lies down a passage. */
const KIND_COLOR: Record<string, string> = {
  fight: INK.flesh, elite: '#e0606c', locker: INK.sodium, pod: INK.cryo,
  event: INK.signal, boss: '#bfeef5', hidden: '#5b6a72',
};
const KIND_GLYPH: Record<string, string> = {
  fight: '✕', elite: '✖', locker: '▣', pod: '◍', event: '✦', boss: '◉', hidden: '?',
};

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
  private enemyPos = new Map<number, { x: number; y: number }>();
  private particles: Particle[] = [];
  private lowHp = 0;
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
      case 'enemyHit': {
        this.fx(e.uid).flash = 1;
        this.shake = Math.max(this.shake, 0.35);
        const p = this.enemyPos.get(e.uid);
        if (p && e.amount > 0) this.splatter(p.x, p.y, INK.flesh, e.amount > 12 ? 14 : 8);
        if (p && e.blocked > 0) this.sparks(p.x, p.y, INK.cryo, 6);
        break;
      }
      case 'enemyDie': {
        this.fx(e.uid).dying = true;
        const p = this.enemyPos.get(e.uid);
        if (p) this.splatter(p.x, p.y, INK.flesh, 22);
        break;
      }
      case 'enemyAct': this.fx(e.uid).lunge = 1; break;
      case 'playerHit':
        if (e.amount > 0) {
          this.hurt = 1;
          this.shake = 1;
          this.splatter(this.cx, this.H * 0.72, INK.flesh, 16);
        }
        if (e.blocked > 0) this.sparks(this.cx, this.H * 0.72, INK.cryo, 8);
        break;
      case 'heal': this.heal = 1; this.sparks(this.cx, this.H * 0.8, INK.cryo, 10, true); break;
      case 'biomass': this.sparks(this.cx, this.H * 0.8, INK.flesh, 8, true); break;
      case 'block': this.sparks(this.cx, this.H * 0.78, INK.cryo, 6); break;
      case 'splice': this.sparks(this.cx, this.H * 0.5, INK.signal, 16, true); this.pulse = 1; break;
      case 'reveal': this.pulse = 1; break;
      case 'warp':
        this.cam = this.camFrom = this.camTo = this.game.pos;
        this.walkT = 1;
        this.enemyFx.clear();
        this.enemyPos.clear();
        break;
      case 'resonate': this.pulse = 1; this.sparks(this.cx, this.H * 0.6, this.biome.lamp, 12, true); break;
      case 'reflect': this.sparks(this.cx, this.H * 0.7, this.biome.lamp, 10); break;
      case 'summon': this.pulse = 0.6; break;
      default: break;
    }
  }

  private splatter(x: number, y: number, color: string, n: number) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      this.particles.push({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40,
        life: 0, maxLife: 0.5 + Math.random() * 0.5, size: 1.5 + Math.random() * 3,
        color, grav: 420, fade: 1,
      });
    }
  }

  private sparks(x: number, y: number, color: string, n: number, rise = false) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (rise ? 1.2 : Math.PI * 2);
      const speed = 30 + Math.random() * 90;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0, maxLife: 0.6 + Math.random() * 0.5, size: 1 + Math.random() * 2,
        color, grav: rise ? -60 : 160, fade: 1,
      });
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
    const critical = this.game.hp > 0 && this.game.hp / this.game.maxHp < 0.25;
    this.lowHp += ((critical ? 1 : 0) - this.lowHp) * Math.min(1, dt * 3);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
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

    if (this.biome.backdrop) this.drawBackdrop();
    if (g.phase === 'map') {
      this.drawJunction();
    } else {
      const first = Math.max(0, Math.floor(this.cam) - 1);
      const lastSeg = Math.min(g.segments.length - 1, Math.floor(this.cam) + DRAW_AHEAD);
      for (let i = lastSeg; i >= first; i--) this.drawSection(i);
    }

    const inFight = g.phase === 'combat' || g.phase === 'harvest';
    if (inFight) this.drawFight();
    this.drawParticles();
    ctx.restore();
    this.drawOverlays(inFight);
  }

  /** A fork in the tunnel: a wall with one opening per path ahead. */
  private drawJunction() {
    const { ctx } = this;
    const g = this.game;
    const bio = this.biome;
    const nearZ = 0.9;
    const farZ = 1.6;
    const near = this.octagon(nearZ);
    const far = this.octagon(farZ);
    const fog = this.fog(1.25);
    const sd = this.segSeed(0) + 500;
    if (bio.backdrop) {
      // Open cave: a floor, then a cliff face with the tunnel mouths cut into it.
      const yn = this.floorY(nearZ);
      const yf = this.floorY(farZ);
      const floor: Pt[] = [[this.cx - this.W * 1.6, yn], [this.cx + this.W * 1.6, yn], [this.cx + this.W, yf], [this.cx - this.W, yf]];
      ctx.fillStyle = mix(bio.faces[4], INK.void, fog);
      fillPoly(ctx, floor);
      this.textureQuad(floor, sd, fog, true);
      const u = this.unit(farZ);
      const topY = this.cy - u * 1.5;
      const cliff: Pt[] = [[-10, yf]];
      for (let k = 0; k <= 16; k++) cliff.push([(k / 16) * (this.W + 20) - 10, topY + Math.abs(noise(sd + k * 3)) * u * 0.55]);
      cliff.push([this.W + 10, yf]);
      ctx.fillStyle = mix(bio.ring[1], INK.void, 0.15);
      fillPoly(ctx, cliff);
      this.textureQuad([[0, topY], [this.W, topY], [this.W, yf], [0, yf]], sd + 5, 0.2, false);
      ctx.strokeStyle = INK.bone;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2;
      sketchStroke(ctx, cliff.slice(1, -1), sd + this.boil, 1.5, false);
      ctx.globalAlpha = 1;
    } else {
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = mix(mix(bio.faces[k], bio.lamp, 0.05), INK.void, fog);
        fillPoly(ctx, [near[k], near[(k + 1) % 8], far[(k + 1) % 8], far[k]]);
      }
      ctx.strokeStyle = INK.bone;
      ctx.lineWidth = Math.max(0.8, this.unit(nearZ) * 0.006);
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 8; k++) sketchStroke(ctx, [near[k], far[k]], 900 + k + this.boil, 1.2);
      ctx.globalAlpha = 1;
      if (bio.crystals) this.drawCrystals(97, nearZ, farZ, fog);

      // The back wall.
      ctx.fillStyle = mix(bio.ring[1], INK.void, 0.2);
      fillPoly(ctx, far);
      ctx.globalAlpha = 0.8;
      sketchStroke(ctx, far, 950 + this.boil, 1.5, true);
      ctx.globalAlpha = 1;
    }

    const paths = g.passages();
    const n = paths.length;
    const u = this.unit(farZ);
    const fy = this.floorY(farZ);
    const aw = (this.W * PASSAGE_SPREAD / n) * 0.62;
    const ah = u * 1.25;
    paths.forEach((node, i) => {
      const x = passageSlot(i, n) * this.W;
      const kind = node.hidden && !node.visited ? 'hidden' : node.kind;
      const col = KIND_COLOR[kind];
      const mouth = (scale: number, drop: number): Pt[] => {
        const w = aw * scale;
        const h = ah * scale;
        const base = fy - drop;
        const pts: Pt[] = [[x - w / 2, base]];
        for (let a = 0; a <= 10; a++) {
          const t = Math.PI + (a / 10) * Math.PI;
          pts.push([x + Math.cos(t) * w / 2, base - h * 0.55 + Math.sin(t) * h * 0.45]);
        }
        pts.push([x + w / 2, base]);
        return pts;
      };
      // receding tunnel: nested mouths, darker as they go
      const layers = 5;
      for (let l = 0; l < layers; l++) {
        const sc = 1 - l * 0.17;
        const drop = ah * 0.22 * (l / layers);
        ctx.fillStyle = mix('#0e1318', '#020304', l / layers);
        fillPoly(ctx, mouth(sc, drop));
      }
      // what waits at the end glows faintly
      const gy = fy - ah * 0.45;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 2 + i * 1.7);
      const grd = ctx.createRadialGradient(x, gy, 0, x, gy, aw * 0.5);
      grd.addColorStop(0, col);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35 * pulse;
      ctx.fillStyle = grd;
      ctx.fillRect(x - aw / 2, gy - aw / 2, aw, aw);
      ctx.globalAlpha = 1;
      // rim
      ctx.strokeStyle = INK.bone;
      ctx.lineWidth = Math.max(1, u * 0.012);
      sketchStroke(ctx, mouth(1, 0), 970 + i * 13 + this.boil, 1.6, false);
      // sign above the mouth
      const sy = fy - ah - u * 0.16;
      const r = Math.max(9, u * 0.1);
      ctx.fillStyle = '#0b0f13';
      ctx.beginPath();
      ctx.arc(x, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `600 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(KIND_GLYPH[kind], x, sy + 1);
    });
    if (bio.backdrop) {
      // crystal spires between and beside the mouths, flora at their feet
      const u = this.unit(farZ);
      const fyb = this.floorY(farZ);
      for (let k = 1; k < n; k++) {
        const x = (passageSlot(k - 1, n) + passageSlot(k, n)) * 0.5 * this.W;
        this.drawSpire(x, fyb, u * 0.45, 0, sd + k * 29, 0.1);
      }
      // bigger clusters framing the fork, a little nearer
      const zc = 1.15;
      for (const side of [-1, 1]) this.drawSpire(this.cx + side * this.W * 0.44, this.floorY(zc), this.unit(zc), side, sd + side * 61, 0.05);
      this.drawFlora(sd, nearZ, farZ, 0.1, 0.9);
    } else {
      this.drawRing(96, nearZ, this.lampOn(96), false);
    }
  }

  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = (1 - t) * p.fade;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const stretch = Math.min(2.2, 1 + Math.hypot(p.vx, p.vy) * 0.006);
      ctx.save();
      ctx.translate(p.x, p.y);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * stretch, p.size * (1 - t * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private get biome(): Biome {
    return BIOMES[this.game.biome] ?? BIOMES.lab;
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
    const shape = seg.shape ?? 'tunnel';
    const sd = this.segSeed(i);

    if (shape === 'cavern') {
      this.drawCavern(i, seg, nearZ, zf, zn, hidden);
      return;
    }

    // Exit light at the end of the corridor.
    if (seg.feature === 'exit') {
      const grd = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.unit(zf) * 1.6);
      const [a, b, c] = this.biome.exit;
      grd.addColorStop(0, a);
      grd.addColorStop(0.5, b);
      grd.addColorStop(1, c);
      ctx.fillStyle = grd;
      fillPoly(ctx, far);
    }

    // Walls, floor and ceiling of this section.
    const bio = this.biome;
    const faceBase = bio.faces;
    const lampOn = this.lampOn(i);
    for (let k = 0; k < 8; k++) {
      let col = faceBase[k];
      if (lampOn && !hidden) col = mix(col, bio.lamp, 0.07 * (1 - fogMid));
      if (seg.feature === 'exit') col = mix(col, bio.exit[1], 0.25);
      ctx.fillStyle = mix(col, INK.void, hidden ? 0.85 : fogMid);
      fillPoly(ctx, [near[k], near[(k + 1) % 8], far[(k + 1) % 8], far[k]]);
    }
    if (!hidden) {
      for (const k of [2, 3, 4, 5, 6]) {
        this.textureQuad([near[k], near[(k + 1) % 8], far[(k + 1) % 8], far[k]], sd + k * 7, fogMid, k === 4);
      }
      if (shape === 'window') this.drawWindow(sd % 2 ? near : far, sd % 2 ? far : near, sd, fogMid);
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
    if (bio.pipes) {
      const pipeAt = (o: Pt[]): Pt => [o[2][0] + (o[3][0] - o[2][0]) * 0.2, o[2][1] + (o[3][1] - o[2][1]) * 0.2];
      sketchStroke(ctx, [pipeAt(near), pipeAt(far)], s + 40, 1.4);
      if (i % 2 === 0) {
        const a = mid[0];
        const b = mid[1];
        const sag = this.unit((nearZ + zf) / 2) * (0.18 + 0.05 * Math.sin(this.time * 0.8 + i));
        sketchStroke(ctx, [a, [(a[0] + b[0]) / 2, a[1] + sag], b], s + 50, 1.2);
      }
    }
    ctx.globalAlpha = 1;
    if (bio.crystals && !hidden) this.drawCrystals(sd, nearZ, zf, fogMid);
    if (bio.flora && !hidden) this.drawFlora(sd, nearZ, zf, fogMid, 0.62);

    // Contents of the section.
    const zMid = (nearZ + zf) / 2;
    if (shape === 'vats' && !hidden) {
      const u = this.unit(zMid);
      this.drawVat(this.cx - u * 0.68, this.floorY(zMid), u, fogMid, sd);
      if (seg.feature !== 'crate') this.drawVat(this.cx + u * 0.68, this.floorY(zMid), u, fogMid, sd + 5);
    }
    if (!hidden) this.drawFeature(seg, i, zMid, zn);
    else this.drawDarkness(seg, near, zMid);

    // Bulkhead ring on the near edge. Out of a cavern, it becomes a tunnel mouth in a cliff.
    if (zn > NEAR) {
      if (bio.rough) {
        if (g.segments[i - 1]?.shape === 'cavern') this.drawCliff(zn, sd, hidden);
        this.drawRockArch(zn, sd, lampOn, hidden);
      } else {
        this.drawRing(i, zn, lampOn, hidden);
      }
    }

    // Hatch and wreckage sit in the near bulkhead's opening.
    if (!hidden && zn > NEAR) {
      if (seg.feature === 'door' && !seg.cleared) this.drawDoor(i, zn);
      if (seg.feature === 'debris') this.drawDebris(i, zn + 0.08, seg.cleared);
    }
  }

  /** A decoration seed unique to this section of this corridor. */
  private segSeed(i: number): number {
    const g = this.game;
    return i * 101 + (g.mapNode ?? 0) * 977 + (g.world ? 13 : 0) + 7;
  }

  /** Far caves: a dark gradient, two ridges of crystal spires, drifting motes. */
  private drawBackdrop() {
    const { ctx } = this;
    const bio = this.biome;
    const W = this.W;
    const H = this.H;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#04080c');
    grd.addColorStop(0.42, '#0a1720');
    grd.addColorStop(0.58, '#10232f');
    grd.addColorStop(1, '#03060a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    // hanging stalactites from the far ceiling
    ctx.fillStyle = '#070d12';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let k = 0; k <= 22; k++) {
      const x = (k / 22) * W;
      const h = H * (0.04 + 0.12 * Math.abs(noise(k * 5.3 + 90)));
      ctx.lineTo(x - W / 44, H * 0.02);
      ctx.lineTo(x, h);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
    // two ridges of spires on the horizon
    for (let layer = 0; layer < 2; layer++) {
      const base = this.cy + H * (0.03 + layer * 0.07);
      const n = 16 + layer * 6;
      ctx.fillStyle = layer ? '#0c1b24' : '#08121a';
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (let k = 0; k <= n; k++) {
        const x = (k / n) * W;
        const h = H * (0.07 + 0.2 * Math.abs(noise(k * 3.1 + layer * 50))) * (layer ? 0.65 : 1);
        ctx.lineTo(x - W / n * 0.35, base - h * 0.35);
        ctx.lineTo(x, base - h);
        ctx.lineTo(x + W / n * 0.3, base - h * 0.3);
      }
      ctx.lineTo(W, base);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(${bio.glow},${layer ? 0.12 : 0.07})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // drifting motes of light
    for (let m = 0; m < 26; m++) {
      const speed = 4 + (m % 3) * 3;
      const x = (((noise(m * 7.7) + 1) / 2) * W + this.time * speed) % W;
      const y = this.cy - H * 0.32 + ((noise(m * 13.1) + 1) / 2) * H * 0.6 + Math.sin(this.time * 0.6 + m) * 6;
      const a = 0.25 + 0.35 * Math.max(0, Math.sin(this.time * 1.3 + m * 2.1));
      ctx.fillStyle = `rgba(${bio.glow},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (m % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** An open section: a floor slab, and crystal structures where the walls would be. */
  private drawCavern(i: number, seg: Segment, nearZ: number, zf: number, zn: number, hidden: boolean) {
    const { ctx } = this;
    const bio = this.biome;
    const sd = this.segSeed(i);
    const fog = this.fog((nearZ + zf) / 2);
    const yn = this.floorY(nearZ);
    const yf = this.floorY(zf);
    const en = (this.W * 1.5) / nearZ;
    const ef = (this.W * 1.5) / zf;
    const floor: Pt[] = [[this.cx - en, yn], [this.cx + en, yn], [this.cx + ef, yf], [this.cx - ef, yf]];
    ctx.fillStyle = mix(bio.faces[4], INK.void, hidden ? 0.85 : fog);
    fillPoly(ctx, floor);
    if (!hidden) {
      this.textureQuad(floor, sd, fog, true);
      ctx.strokeStyle = INK.bone;
      ctx.globalAlpha = 0.35 * (1 - fog);
      ctx.lineWidth = 1;
      sketchStroke(ctx, [floor[3], floor[2]], sd + this.boil, 2);
      ctx.globalAlpha = 1;
    }
    // Structures on both sides, at two depths. Gaps let you see into the caves beyond.
    for (const t of [0.72, 0.22]) {
      const z = nearZ + (zf - nearZ) * t;
      const u = this.unit(z);
      const fy = this.floorY(z);
      const f = this.fog(z);
      for (const side of [-1, 1]) {
        if (noise(sd * 0.37 + side * 3 + t * 10) < -0.55) continue;
        const x = this.cx + side * u * (0.95 + noise(sd + side + t * 7) * 0.2);
        this.drawSpire(x, fy, u, side, sd + side * 17 + Math.round(t * 31), hidden ? 0.85 : f);
      }
    }
    // crystal hangers from the unseen ceiling
    if (!hidden) {
      const z = (nearZ + zf) / 2;
      const u = this.unit(z);
      for (let k = 0; k < 3; k++) {
        if (noise(sd + k * 9) < 0) continue;
        const x = this.cx + noise(sd * 3 + k) * u * 1.4;
        this.drawShard(x, this.cy - u * 1.35, u * (0.25 + Math.abs(noise(sd + k)) * 0.35), Math.PI / 2 + noise(k + sd) * 0.3, u * 0.08, fog, sd + k * 5);
      }
      this.drawFlora(sd, nearZ, zf, fog, 0.9);
    }
    const zMid = (nearZ + zf) / 2;
    if (!hidden) this.drawFeature(seg, i, zMid, zn);
    else this.drawDarkness(seg, this.octagon(nearZ, 1.8), zMid);
  }

  /** A rock mound with big crystals growing out of it. */
  private drawSpire(x: number, fy: number, u: number, side: number, seed: number, fog: number) {
    const { ctx } = this;
    const bio = this.biome;
    const w = u * (0.3 + Math.abs(noise(seed)) * 0.2);
    const h = u * (0.18 + Math.abs(noise(seed + 1)) * 0.18);
    const mound: Pt[] = [
      [x - w, fy], [x - w * 0.7, fy - h * 0.6], [x - w * 0.2, fy - h], [x + w * 0.35, fy - h * 0.8], [x + w * 0.8, fy - h * 0.3], [x + w, fy],
    ];
    ctx.fillStyle = mix(bio.ring[1], INK.void, fog);
    fillPoly(ctx, mound);
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = 0.5 * (1 - fog);
    ctx.lineWidth = Math.max(0.8, u * 0.008);
    sketchStroke(ctx, mound, seed + this.boil, 1.2, false);
    ctx.globalAlpha = 1;
    const count = 3 + Math.floor(Math.abs(noise(seed + 2)) * 3);
    for (let c = 0; c < count; c++) {
      const bx = x + (c / (count - 1) - 0.5) * w * 1.1;
      const len = u * (0.35 + Math.abs(noise(seed + c * 3)) * 0.5) * (c === Math.floor(count / 2) ? 1.4 : 1);
      const ang = -Math.PI / 2 + side * 0.15 + noise(seed + c) * 0.35;
      this.drawShard(bx, fy - h * 0.4, len, ang, len * 0.3, fog, seed + c * 11, true);
    }
  }

  /** Glass ferns and glowing lichen on the floor. `spread` is how far out from centre they grow. */
  private drawFlora(sd: number, nearZ: number, zf: number, _fog: number, spread: number) {
    const { ctx } = this;
    const bio = this.biome;
    for (let k = 0; k < 4; k++) {
      const pick = noise(sd * 1.3 + k * 17);
      if (pick < -0.2) continue;
      const t = 0.15 + Math.abs(noise(sd + k * 5)) * 0.7;
      const z = nearZ + (zf - nearZ) * t;
      const u = this.unit(z);
      const f = this.fog(z);
      if (f > 0.8) continue;
      const side = k % 2 ? 1 : -1;
      const x = this.cx + side * u * (spread + noise(sd + k) * 0.15);
      const fy = this.floorY(z);
      if (pick > 0.35) {
        // glass fern: a curled stem with leaflets and a lit tip
        const h = u * (0.22 + Math.abs(noise(sd + k * 2)) * 0.2);
        const sway = Math.sin(this.time * 0.9 + k + sd) * u * 0.02;
        const tip: Pt = [x - side * h * 0.35 + sway, fy - h];
        ctx.strokeStyle = mix('#9fe6f0', INK.void, f);
        ctx.globalAlpha = 0.8 * (1 - f);
        ctx.lineWidth = Math.max(0.8, u * 0.006);
        ctx.beginPath();
        ctx.moveTo(x, fy);
        ctx.quadraticCurveTo(x + side * h * 0.1, fy - h * 0.6, tip[0], tip[1]);
        ctx.stroke();
        for (let l = 1; l < 6; l++) {
          const tt = l / 6;
          const px = x + (tip[0] - x) * tt;
          const py = fy + (tip[1] - fy) * tt;
          const len = h * 0.18 * (1 - tt * 0.5);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - len, py - len * 0.5);
          ctx.moveTo(px, py);
          ctx.lineTo(px + len, py - len * 0.5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const glow = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], u * 0.07);
        glow.addColorStop(0, `rgba(${bio.glow},${0.8 * (1 - f)})`);
        glow.addColorStop(1, `rgba(${bio.glow},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(tip[0] - u * 0.07, tip[1] - u * 0.07, u * 0.14, u * 0.14);
      } else {
        // lichen: a cluster of pulsing points
        const r = u * 0.12;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.5 + k * 2 + sd);
        const g = ctx.createRadialGradient(x, fy, 0, x, fy, r * 1.6);
        g.addColorStop(0, `rgba(176,111,224,${0.25 * pulse * (1 - f)})`);
        g.addColorStop(1, 'rgba(176,111,224,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 1.6, fy - r * 1.6, r * 3.2, r * 3.2);
        ctx.fillStyle = `rgba(214,190,240,${0.8 * (1 - f)})`;
        for (let d = 0; d < 8; d++) {
          ctx.beginPath();
          ctx.arc(x + noise(sd + k + d * 3) * r, fy - Math.abs(noise(sd + d * 7 + k)) * r * 0.35, Math.max(0.8, u * 0.008), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /** Point inside a quad [n0, n1, f1, f0] at (u along, v deep). */
  private quadAt(q: Pt[], u: number, v: number): Pt {
    const ax = q[0][0] + (q[1][0] - q[0][0]) * u;
    const ay = q[0][1] + (q[1][1] - q[0][1]) * u;
    const bx = q[3][0] + (q[2][0] - q[3][0]) * u;
    const by = q[3][1] + (q[2][1] - q[3][1]) * u;
    return [ax + (bx - ax) * v, ay + (by - ay) * v];
  }

  /** Procedural surface detail: crystal striations and glints, or hull rust and rivets. */
  private textureQuad(q: Pt[], seed: number, fog: number, isFloor: boolean) {
    if (fog > 0.85) return;
    const { ctx } = this;
    const bio = this.biome;
    const a = 1 - fog;
    ctx.save();
    ctx.beginPath();
    q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    if (bio.texture === 'crystal') {
      ctx.strokeStyle = `rgba(${bio.glow},${0.1 * a})`;
      ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const u1 = (noise(seed + k * 3) + 1) / 2;
        const u2 = u1 + noise(seed + k * 5) * 0.15;
        const p = this.quadAt(q, u1, 0);
        const r = this.quadAt(q, u2, 1);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(r[0], r[1]);
        ctx.stroke();
      }
      // facets: a few pale triangles catching light
      ctx.fillStyle = `rgba(${bio.glow},${0.05 * a})`;
      for (let k = 0; k < 2; k++) {
        const u0 = (noise(seed + k * 11) + 1) / 2;
        const v0 = (noise(seed + k * 13) + 1) / 2;
        fillPoly(ctx, [this.quadAt(q, u0, v0), this.quadAt(q, u0 + 0.15, v0 + 0.1), this.quadAt(q, u0 + 0.05, v0 + 0.3)]);
      }
      for (let k = 0; k < 5; k++) {
        const tw = Math.max(0, Math.sin(this.time * 2.2 + seed + k * 2.7));
        if (tw < 0.4) continue;
        const [x, y] = this.quadAt(q, (noise(seed + k * 17) + 1) / 2, (noise(seed + k * 19) + 1) / 2);
        ctx.fillStyle = `rgba(230,250,255,${tw * a * 0.9})`;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    } else {
      for (let k = 0; k < 2; k++) {
        const [x, y] = this.quadAt(q, (noise(seed + k * 7) + 1) / 2, (noise(seed + k * 9) + 1) / 2);
        const r = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) * (0.12 + Math.abs(noise(seed + k)) * 0.15);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(96,52,32,${0.35 * a})`);
        g.addColorStop(1, 'rgba(96,52,32,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (!isFloor) {
        ctx.fillStyle = `rgba(140,133,116,${0.5 * a})`;
        for (let k = 0; k < 7; k++) {
          const [x, y] = this.quadAt(q, 0.12 + k * 0.125, 0.5);
          ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
        }
      } else if (noise(seed) > 0.4) {
        // a strip of worn hazard paint
        ctx.fillStyle = `rgba(227,163,59,${0.12 * a})`;
        for (let k = 0; k < 6; k++) {
          fillPoly(ctx, [this.quadAt(q, k / 6, 0.45), this.quadAt(q, k / 6 + 0.07, 0.45), this.quadAt(q, k / 6 + 0.1, 0.55), this.quadAt(q, k / 6 + 0.03, 0.55)]);
        }
      }
    }
    ctx.restore();
  }

  /** Jagged copy of a polygon: each edge split, points pushed in or out. */
  private jag(pts: Pt[], seed: number, amp: number): Pt[] {
    const out: Pt[] = [];
    const cx = this.cx;
    const cy = this.cy;
    pts.forEach((a, k) => {
      const b = pts[(k + 1) % pts.length];
      for (let s = 0; s < 3; s++) {
        const t = s / 3;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const d = Math.hypot(x - cx, y - cy) || 1;
        const n = noise(seed + k * 3 + s) * amp;
        out.push([x + ((x - cx) / d) * n, y + ((y - cy) / d) * n]);
      }
    });
    return out;
  }

  /** A natural rock arch with crystals growing from it, in place of a bulkhead. */
  private drawRockArch(z: number, sd: number, lampOn: boolean, hidden: boolean) {
    const { ctx } = this;
    const bio = this.biome;
    const u = this.unit(z);
    const fog = this.fog(z);
    const inner = this.jag(this.octagon(z), sd, u * 0.06);
    const outer = this.jag(this.octagon(z, 1.35), sd + 50, u * 0.14);
    ctx.beginPath();
    outer.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    inner.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = mix(bio.ring[sd % 3 === 1 ? 0 : 1], INK.void, hidden ? 0.8 : fog);
    ctx.fill('evenodd');
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = (1 - fog * 0.9) * (hidden ? 0.25 : 0.9);
    ctx.lineWidth = Math.max(1, u * 0.009);
    sketchStroke(ctx, inner, sd + this.boil, 1.4, true);
    ctx.globalAlpha = 1;
    if (hidden) return;
    // crystals growing inward from the arch's top and upper sides
    for (let k = 0; k < 5; k++) {
      if (noise(sd + k * 7) < -0.3) continue;
      const p = inner[Math.floor(((k + 0.5) / 5) * inner.length * 0.45 + inner.length * 0.8) % inner.length];
      const ang = Math.atan2(this.cy - p[1], this.cx - p[0]) + noise(sd + k) * 0.4;
      this.drawShard(p[0], p[1], u * (0.12 + Math.abs(noise(sd + k * 3)) * 0.18), ang, u * 0.06, fog, sd + k * 13);
    }
    if (lampOn) {
      const top = inner[Math.floor(inner.length * 0.03)];
      const lx = this.cx;
      const ly = top[1];
      const r = u * 0.9;
      const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      grd.addColorStop(0, `rgba(${bio.glow},0.3)`);
      grd.addColorStop(1, `rgba(${bio.glow},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(lx - r, ly - r * 0.2, r * 2, r * 1.2);
    }
  }

  /** A cliff face around a tunnel mouth, when stepping from a cavern into a tunnel. */
  private drawCliff(z: number, sd: number, hidden: boolean) {
    const { ctx } = this;
    const bio = this.biome;
    const u = this.unit(z);
    const fog = this.fog(z);
    const fy = this.floorY(z);
    const half = (this.W * 1.4) / z;
    const topY = this.cy - u * 1.9;
    const cliff: Pt[] = [[this.cx - half, fy]];
    for (let k = 0; k <= 14; k++) {
      const x = this.cx - half + (k / 14) * half * 2;
      cliff.push([x, topY + Math.abs(noise(sd + k * 3)) * u * 0.5]);
    }
    cliff.push([this.cx + half, fy]);
    const hole = this.jag(this.octagon(z, 1.3), sd + 50, u * 0.14);
    ctx.beginPath();
    cliff.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    hole.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = mix(bio.ring[1], INK.void, hidden ? 0.85 : fog * 0.8);
    ctx.fill('evenodd');
    if (hidden) return;
    const box: Pt[] = [[this.cx - half, topY], [this.cx + half, topY], [this.cx + half, fy], [this.cx - half, fy]];
    ctx.save();
    ctx.beginPath();
    cliff.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    hole.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip('evenodd');
    this.textureQuad(box, sd + 3, fog, false);
    ctx.restore();
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = 0.45 * (1 - fog);
    sketchStroke(ctx, cliff.slice(1, -1), sd + this.boil, 1.5, false);
    ctx.globalAlpha = 1;
    for (const side of [-1, 1]) this.drawSpire(this.cx + side * u * 1.05, fy, u, side, sd + side * 41, fog);
  }

  /** Lab: an observation window set into a wall, with stars and a slice of planet outside. */
  private drawWindow(a: Pt[], b: Pt[], sd: number, fog: number) {
    const { ctx } = this;
    const k = sd % 2 ? 2 : 6;
    const q: Pt[] = [a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]];
    const inset: Pt[] = [this.quadAt(q, 0.12, 0.18), this.quadAt(q, 0.88, 0.18), this.quadAt(q, 0.88, 0.82), this.quadAt(q, 0.12, 0.82)];
    const [x0, y0] = inset[0];
    const [x1, y1] = inset[2];
    ctx.save();
    ctx.beginPath();
    inset.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#02030a');
    g.addColorStop(1, '#0b1030');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x0, x1) - 50, Math.min(y0, y1) - 50, Math.abs(x1 - x0) + 100, Math.abs(y1 - y0) + 100);
    for (let s = 0; s < 22; s++) {
      const [x, y] = this.quadAt(inset, (noise(sd + s * 3) + 1) / 2, (noise(sd + s * 5) + 1) / 2);
      const tw = 0.5 + 0.5 * Math.sin(this.time * 1.7 + s);
      ctx.fillStyle = `rgba(230,235,255,${(0.4 + tw * 0.5) * (1 - fog)})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    const [px, py] = this.quadAt(inset, 0.75, 1.05);
    const pr = Math.hypot(inset[1][0] - inset[0][0], inset[1][1] - inset[0][1]) * 0.7;
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
    pg.addColorStop(0, '#6a4b7a');
    pg.addColorStop(0.7, '#2a1c3a');
    pg.addColorStop(1, '#0b0714');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = 0.9 * (1 - fog);
    ctx.lineWidth = 2;
    sketchStroke(ctx, inset, sd + this.boil, 1, true);
    ctx.globalAlpha = 0.18 * (1 - fog);
    sketchStroke(ctx, [this.quadAt(inset, 0.2, 0.1), this.quadAt(inset, 0.45, 0.9)], sd + 9, 1);
    ctx.globalAlpha = 1;
  }

  /** Lab: an old growth vat, cracked, with something curled up inside. */
  private drawVat(x: number, fy: number, u: number, fog: number, sd: number) {
    const { ctx } = this;
    const w = u * 0.26;
    const h = u * 1.1;
    const top = fy - h;
    ctx.fillStyle = mix('#1f3526', INK.void, fog);
    ctx.beginPath();
    ctx.roundRect(x - w / 2, top, w, h, w / 3);
    ctx.fill();
    ctx.fillStyle = `rgba(127,212,138,${0.18 * (1 - fog)})`;
    ctx.fillRect(x - w / 2, top + h * (0.25 + Math.abs(noise(sd)) * 0.2), w, h * 0.7);
    const bob = Math.sin(this.time * 0.6 + sd) * u * 0.015;
    ctx.fillStyle = mix('#5e7a64', INK.void, fog + 0.2);
    ctx.beginPath();
    ctx.ellipse(x, top + h * 0.45 + bob, w * 0.16, w * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.03, top + h * 0.62 + bob, w * 0.2, h * 0.14, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK.bone;
    ctx.globalAlpha = 0.7 * (1 - fog);
    ctx.lineWidth = Math.max(1, u * 0.008);
    sketchStroke(ctx, [[x - w / 2, top + w / 3], [x - w / 2, fy]], sd + this.boil, 1);
    sketchStroke(ctx, [[x + w / 2, top + w / 3], [x + w / 2, fy]], sd + 3 + this.boil, 1);
    sketchStroke(ctx, [[x - w * 0.3, top + h * 0.2], [x - w * 0.05, top + h * 0.35], [x - w * 0.2, top + h * 0.5]], sd + 7, 0.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = mix('#35322e', INK.void, fog);
    ctx.fillRect(x - w * 0.62, top - u * 0.04, w * 1.24, u * 0.07);
    ctx.fillRect(x - w * 0.62, fy - u * 0.05, w * 1.24, u * 0.05);
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
    const bio = this.biome;
    ctx.fillStyle = mix(i % 3 === 1 ? bio.ring[0] : bio.ring[1], INK.void, hidden ? 0.8 : fog);
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
    ctx.fillStyle = lampOn && !hidden ? bio.lamp : bio.lampOff;
    ctx.globalAlpha = 1 - fog * 0.7;
    ctx.fillRect(lx - lw / 2, ly - lh / 2, lw, lh);
    if (lampOn && !hidden) {
      const r = this.unit(z) * 0.9;
      const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      grd.addColorStop(0, `rgba(${bio.glow},0.4)`);
      grd.addColorStop(1, `rgba(${bio.glow},0)`);
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
      case 'event': this.drawMonolith(this.cx, fy, u, seg.cleared, dim, i); break;
      default: break;
    }
    void zn;
  }

  /** Crystal clusters growing from the corners of a Kessra section. */
  private drawCrystals(i: number, nearZ: number, zf: number, fog: number) {
    const { ctx } = this;
    const bio = this.biome;
    // corners: floor-left, floor-right, ceiling-left, ceiling-right, and which way they point
    const spots: [number, number][] = [[5, -0.9], [4, -2.2], [7, 0.7], [2, 2.4]];
    for (let k = 0; k < spots.length; k++) {
      if (noise(i * 13 + k) < -0.35) continue;
      const t = 0.25 + Math.abs(noise(i * 7 + k * 3)) * 0.5;
      const z = nearZ + (zf - nearZ) * t;
      const o = this.octagon(z);
      const [corner, angle] = spots[k];
      const u = this.unit(z);
      const count = 2 + Math.floor(Math.abs(noise(i + k * 11)) * 3);
      for (let c = 0; c < count; c++) {
        const len = u * (0.18 + Math.abs(noise(i * 3 + k + c * 5)) * 0.28);
        const a = angle + noise(i + k * 2 + c) * 0.5;
        this.drawShard(o[corner][0] + noise(c + k) * u * 0.08, o[corner][1], len, a, len * 0.28, fog, i * 31 + k * 7 + c);
      }
    }
    // faint glow from the floor
    const o = this.octagon((nearZ + zf) / 2);
    const gy = (o[4][1] + o[5][1]) / 2;
    const r = this.unit((nearZ + zf) / 2) * 0.9;
    const grd = ctx.createRadialGradient(this.cx, gy, 0, this.cx, gy, r);
    grd.addColorStop(0, `rgba(${bio.glow},${0.12 * (1 - fog)})`);
    grd.addColorStop(1, `rgba(${bio.glow},0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(this.cx - r, gy - r, r * 2, r * 1.2);
  }

  private drawShard(x: number, y: number, len: number, angle: number, w: number, fog: number, seed: number, solid = false) {
    const { ctx } = this;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = -dy;
    const py = dx;
    const pts: Pt[] = [
      [x + px * w * 0.5, y + py * w * 0.5],
      [x + dx * len * 0.8 + px * w * 0.4, y + dy * len * 0.8 + py * w * 0.4],
      [x + dx * len, y + dy * len],
      [x + dx * len * 0.8 - px * w * 0.4, y + dy * len * 0.8 - py * w * 0.4],
      [x - px * w * 0.5, y - py * w * 0.5],
    ];
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.3 + seed);
    if (solid) {
      // an opaque body, lit on one facet, so the structure blocks what is behind it
      ctx.fillStyle = mix('#1b3a48', INK.void, fog);
      fillPoly(ctx, pts);
      ctx.fillStyle = `rgba(${this.biome.glow},${(0.1 + pulse * 0.08) * (1 - fog)})`;
      fillPoly(ctx, [pts[0], pts[1], pts[2], [x, y]]);
    }
    ctx.fillStyle = `rgba(${this.biome.glow},${(0.18 + pulse * 0.12) * (1 - fog)})`;
    fillPoly(ctx, pts);
    ctx.strokeStyle = mix('#d6f6fb', INK.void, fog);
    ctx.globalAlpha = 0.8 * (1 - fog * 0.8);
    ctx.lineWidth = Math.max(0.8, len * 0.02);
    sketchStroke(ctx, pts, seed + this.boil, 0.8, true);
    sketchStroke(ctx, [[x, y], [x + dx * len, y + dy * len]], seed + 9 + this.boil, 0.6);
    ctx.globalAlpha = 1;
  }

  /** An event: a crystal pillar with something human-shaped inside. */
  private drawMonolith(x: number, fy: number, u: number, done: boolean, dim: number, i: number) {
    const { ctx } = this;
    const w = u * 0.34;
    const h = u * 1.35;
    const top = fy - h;
    const pts: Pt[] = [
      [x - w * 0.5, fy], [x - w * 0.62, top + h * 0.3], [x - w * 0.2, top],
      [x + w * 0.3, top + h * 0.06], [x + w * 0.6, top + h * 0.35], [x + w * 0.5, fy],
    ];
    if (!done) {
      const g = ctx.createRadialGradient(x, top + h * 0.5, 0, x, top + h * 0.5, u);
      g.addColorStop(0, `rgba(${this.biome.glow},${0.35 * (1 - dim)})`);
      g.addColorStop(1, `rgba(${this.biome.glow},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - u, top - u * 0.2, u * 2, h + u * 0.4);
    }
    ctx.fillStyle = `rgba(${this.biome.glow},${(done ? 0.08 : 0.22) * (1 - dim)})`;
    fillPoly(ctx, pts);
    // the figure inside
    ctx.fillStyle = mix(done ? '#2a3a44' : '#9cc8d2', INK.void, dim + 0.25);
    ctx.beginPath();
    ctx.ellipse(x, top + h * 0.3, w * 0.13, w * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(x, top + h * 0.56, w * 0.17, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mix('#d6f6fb', INK.void, dim);
    ctx.lineWidth = Math.max(1, u * 0.009);
    ctx.globalAlpha = 1 - dim * 0.8;
    sketchStroke(ctx, pts, i * 17 + this.boil, 1.2, true);
    sketchStroke(ctx, [pts[2], [x + w * 0.05, fy]], i * 17 + 40 + this.boil, 1);
    if (done) sketchStroke(ctx, [[x - w * 0.4, top + h * 0.2], [x + w * 0.1, top + h * 0.5], [x - w * 0.2, top + h * 0.75]], i + 90, 1);
    ctx.globalAlpha = 1;
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
      grd.addColorStop(0, `rgba(111,163,160,${0.5 * (1 - dim)})`);
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
      this.enemyPos.set(e.uid, { x, y: this.H * 0.94 - u * size * 0.55 });
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
    if (this.lowHp > 0.01) {
      const beat = 0.4 + 0.4 * Math.sin(this.time * 3.4);
      const vg = ctx.createRadialGradient(this.cx, this.H * 0.5, this.H * 0.15, this.cx, this.H * 0.5, this.H * 0.75);
      vg.addColorStop(0, 'rgba(185,80,90,0)');
      vg.addColorStop(1, `rgba(185,80,90,${this.lowHp * beat * 0.55})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    // faint scanlines, like an old helmet feed
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < this.H; y += 3) ctx.fillRect(0, y, this.W, 1);
  }
}
