/**
 * The "print" pass: turns the painted scene into a vintage sci-fi print.
 * Deep blacks become solid ink, lights become bare paper, mid-tones become a halftone screen,
 * and saturated colours are pulled onto a small set of spot inks printed slightly off-register.
 */

const VERT = `
attribute vec2 a;
varying vec2 uv;
void main() {
  uv = a * 0.5 + 0.5;
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 res;
uniform float dpr;
uniform float time;

const vec3 PAPER = vec3(0.945, 0.906, 0.812);
const vec3 INK = vec3(0.075, 0.067, 0.071);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

/** Distance to the nearest dot centre of a screen rotated by angle a, cell size c. 0 centre .. ~1 corner. */
float screen(vec2 p, float a, float c) {
  float s = sin(a);
  float k = cos(a);
  vec2 q = mat2(k, -s, s, k) * p / c;
  return length(fract(q) - 0.5) * 1.4142;
}

/** Map a colour onto the closest spot ink by hue. */
vec3 spot(vec3 c) {
  vec3 inks[6];
  inks[0] = vec3(0.855, 0.255, 0.169); // vermilion
  inks[1] = vec3(0.933, 0.643, 0.137); // mustard
  inks[2] = vec3(0.106, 0.620, 0.580); // teal
  inks[3] = vec3(0.180, 0.420, 0.720); // cobalt
  inks[4] = vec3(0.470, 0.290, 0.700); // violet
  inks[5] = vec3(0.380, 0.650, 0.330); // radium green
  vec3 d = normalize(c - vec3(dot(c, vec3(0.3333))) + 1e-4);
  vec3 best = inks[0];
  float bestDot = -2.0;
  for (int i = 0; i < 6; i++) {
    vec3 e = normalize(inks[i] - vec3(dot(inks[i], vec3(0.3333))));
    float t = dot(d, e);
    if (t > bestDot) { bestDot = t; best = inks[i]; }
  }
  return best;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec3 c = texture2D(tex, uv).rgb;
  // the colour plate is printed a hair off-register
  vec3 cc = texture2D(tex, uv + vec2(1.6, -1.1) * dpr / res).rgb;

  // Tone: the scene keeps its continuous shading, remapped onto ink → paper,
  // so near and far layers stay apart by value. Dots are only a light texture on top.
  float L = dot(c, vec3(0.299, 0.587, 0.114));
  float v = clamp((L - 0.02) / 0.5, 0.0, 1.0);
  v = v * v * (3.0 - 2.0 * v); // a gentle S-curve: firmer blacks and whites
  vec2 gp = mod(px / dpr, 512.0);
  float grain = vnoise(gp / 1.5) * 0.6 + vnoise(gp / 7.0) * 0.4;
  vec3 paper = PAPER * (0.94 + 0.06 * grain);
  vec3 tone = mix(INK, paper, v);

  // Colour: real colour is pulled toward its nearest spot ink, keeping its value.
  float mx = max(cc.r, max(cc.g, cc.b));
  float mn = min(cc.r, min(cc.g, cc.b));
  float cv = smoothstep(0.05, 0.25, mx - mn);
  vec3 ink2 = spot(cc);
  float lift = clamp(mx * 1.6, 0.0, 1.0);
  vec3 col = mix(tone, mix(INK, ink2, lift), cv * 0.85);

  // Halftone texture, fine and faint, strongest in the mid-tones.
  float cover = 1.0 - v;
  float d = screen(px, 0.785, 3.0 * dpr);
  float aa = 1.2 / (3.0 * dpr);
  float dots = 1.0 - smoothstep(sqrt(cover) - aa, sqrt(cover) + aa, d);
  float mid = 4.0 * v * (1.0 - v);
  col = mix(col, mix(paper, INK, dots), 0.16 * mid);

  // a few specks of paper showing through the darkest ink
  float speck = step(0.996, hash(floor(gp / 1.5))) * (1.0 - v);
  col = mix(col, paper, speck * 0.6);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Print {
  private texW = 0;
  private texH = 0;
  private constructor(
    private gl: WebGLRenderingContext,
    private tex: WebGLTexture,
    private loc: { res: WebGLUniformLocation | null; dpr: WebGLUniformLocation | null; time: WebGLUniformLocation | null },
  ) {}

  /** Returns null when WebGL is not available; the caller then shows the plain scene. */
  static create(canvas: HTMLCanvasElement): Print | null {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      return new Print(gl, tex, {
        res: gl.getUniformLocation(prog, 'res'),
        dpr: gl.getUniformLocation(prog, 'dpr'),
        time: gl.getUniformLocation(prog, 'time'),
      });
    } catch {
      return null;
    }
  }

  render(src: HTMLCanvasElement, dpr: number, time: number) {
    const { gl } = this;
    const w = gl.canvas.width;
    const h = gl.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    // Allocate the texture once per size, then only overwrite its pixels. Re-allocating every frame
    // makes some mobile GPUs pile up memory until the page stalls.
    if (this.texW !== src.width || this.texH !== src.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      this.texW = src.width;
      this.texH = src.height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGB, gl.UNSIGNED_BYTE, src);
    }
    gl.uniform2f(this.loc.res, w, h);
    gl.uniform1f(this.loc.dpr, dpr);
    gl.uniform1f(this.loc.time, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
