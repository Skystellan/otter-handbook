/**
 * 把封面那只海獭画到一张 canvas 上（WebGL2）。
 *
 * 每一帧三件事：
 *   1. 摆姿势 —— 这里是它的「骨架」：头从脖子根上转（所以头的位置会跟着动，不是只有脸在滑），
 *      带一点惯性；前肢两节骨头长度固定，肘的位置由肩和爪倒推；石头是刚体，掂的时候真的离手、
 *      翻一圈、再落回爪子里；胡须比头慢半拍。
 *   2. 拍照 —— SCENE 着色器按这个姿势拍一张低分辨率的照片（颜色、分色用的版、深度）。
 *   3. 印刷 —— PRINT 着色器把照片印到整张画布上，再把胡须描上去。
 * 另外管：画布尺寸、镜头、指针、点水面起涟漪、明暗主题、看不见的时候暂停、
 * 机器吃力的时候自动降低照片分辨率。
 */
import { PRINT_FRAG, SCENE_FRAG, VERT } from './shaders';

export const PRINT_MODES = ['halftone', 'ascii', 'dither', 'photo'] as const;
export type PrintMode = (typeof PRINT_MODES)[number];

export interface OtterOptions {
  /** 海獭落在画面的哪里：0–1，原点在左上 */
  center(width: number, height: number): [number, number];
  /** 它在画面上有多宽（px） */
  span(width: number, height: number): number;
  /** 给文字让路：水面在横向 x0→x1、纵向 y0→y1 之间才渐渐显出来（0–1，原点在左上）。不给就是整幅都有 */
  shy?(width: number, height: number): [number, number, number, number];
}

/** 调试用：把姿势钉在某个状态上 */
export interface PoseOverride {
  /** 它在看哪：−1…1 */
  look?: [number, number];
  /** 掂石头掂到第几秒了 */
  toss?: number;
  /** 眼皮合上多少：0…1 */
  blink?: number;
  /** 头直接转到这个角度（弧度：左右、上下），不带歪头。看侧脸用 */
  turn?: [number, number];
}

export interface OtterHandle {
  mode(next: PrintMode): void;
  /** 立刻画出第 t 秒的样子（调试、截图用） */
  renderAt(t: number, pose?: PoseOverride): void;
  destroy(): void;
}

type V3 = [number, number, number];

const GLYPHS = ' .:-=+*#%@';
const WIDTH = 2.0; //                           海獭在画面上看起来有多宽（世界单位）
const CAMERA: V3 = [-0.85, 2.55, 2.65]; //      镜头相对它的位置
const TARGET: V3 = [-0.07, 0.06, 0.098]; //     镜头对着哪：它身子的中点
const YAW = -0.95; //                           它在水面上的朝向。这三样和着色器里写的是同一组数

// ── 骨架（坐标都是它自己的：身子顺着 x，头在 +x，y 朝上）──────────
const NECK: V3 = [0.5, 0.06, 0]; //             脖子根：头绕着它转
const HEAD_UP = 0.3; //                         头的中心在脖子根上方多远
const HEAD_S = 1.13; //                         头整体放大了多少（和着色器里的是同一个数）
const FACE: V3 = [-0.9703, 0.2419, 0]; //       不转头的时候脸朝哪：它抬着头，脸朝自己的脚、略微往上 —— 镜头在它斜上方约 20°，
//                                              看到的是额头在上、鼻子和嘴在下的那张脸
const SHOULDER: V3 = [0.22, 0.11, 0.205];
const BONE = 0.185; //                          上臂、前臂各多长
const PAW_REST: V3 = [-0.03, 0.323, 0.128]; //  抱着石头的时候爪子在哪：一边一只，捧在石头两侧
const STONE_REST: V3 = [0, 0.325, 0]; //        石头搁在肚子上（它拿肚子当桌子）：离脸远一点，抛起来也挡不住脸
const GRAVITY = 6.4;

// 胡须：每边四根，又长又密，越靠下的越往下垂。在头自己的坐标里（脸朝前、头顶朝上、侧面）定好根和梢
const WHISKERS = [-1, 1].flatMap((side) =>
  (
    [
      [[0.212, -0.062, 0.105], [0.25, 0.02, 0.36]],
      [[0.214, -0.078, 0.108], [0.26, -0.07, 0.4]],
      [[0.21, -0.094, 0.106], [0.24, -0.16, 0.38]],
      [[0.202, -0.108, 0.1], [0.2, -0.24, 0.32]],
    ] as [V3, V3][]
  ).map(([root, tip]) => ({ root: [root[0], root[1], root[2] * side] as V3, tip: [tip[0], tip[1], tip[2] * side] as V3 })),
);

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (x: number) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};
/** 把一对互相垂直的方向在它们所在的平面里转一个角度 */
const turn = (a: V3, b: V3, angle: number): [V3, V3] => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [add(mul(a, c), mul(b, s)), sub(mul(b, c), mul(a, s))];
};

/** 一根弹簧：有惯性，会稍微冲过头再回来 */
interface Spring {
  x: number;
  v: number;
}
const pull = (s: Spring, target: number, dt: number, freq: number, damping: number) => {
  s.v += (-2 * damping * freq * s.v - freq * freq * (s.x - target)) * dt;
  s.x += s.v * dt;
};

/**
 * 掂一下石头：先往下一沉，往上一送，石头离手、翻一圈、落回来，爪子接住的时候再往下一沉。
 * 返回爪子和石头各自比平时高多少、石头翻到哪了、有没有离手、做完没有。
 */
function toss(age: number, power: number) {
  const v0 = Math.sqrt(2 * GRAVITY * 0.13 * power);
  const flight = (v0 + Math.sqrt(v0 * v0 + 2 * GRAVITY * 0.03)) / GRAVITY;
  const A = 0.16; //         下沉
  const B = A + 0.11; //     上送，到这一刻离手
  const C = B + flight; //   落回爪子里
  const end = C + 0.42;
  if (age < A) {
    const y = -0.022 * ease(age / A);
    return { paw: y, stone: y, spin: 0, air: 0, landed: false, done: false };
  }
  if (age < B) {
    const k = (age - A) / (B - A);
    const y = -0.022 + 0.052 * k * k;
    return { paw: y, stone: y, spin: 0, air: 0, landed: false, done: false };
  }
  if (age < C) {
    const u = age - B;
    return {
      paw: 0.03 * (1 - ease(u / 0.2)),
      stone: 0.03 + v0 * u - 0.5 * GRAVITY * u * u,
      spin: u / flight,
      air: Math.sin((u / flight) * Math.PI),
      landed: false,
      done: false,
    };
  }
  const w = age - C;
  const y = -0.034 * Math.sin(w * 16) * Math.exp(-w * 8);
  return { paw: y, stone: y, spin: 1, air: 0, landed: true, done: age >= end };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[otter] 着色器编译失败\n' + gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, frag: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[otter] 着色器链接失败\n' + gl.getProgramInfoLog(program));
    return null;
  }
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    at(name: string) {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
      return cache.get(name)!;
    },
  };
}

const rgb = (css: string, fallback: V3): V3 => {
  const m = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function mountOtter(host: HTMLElement, canvas: HTMLCanvasElement, opts: OtterOptions): OtterHandle | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  const scene = link(gl, SCENE_FRAG);
  const print = link(gl, PRINT_FRAG);
  if (!scene || !print) return null;

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const makeTexture = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const colorTex = makeTexture();
  const plateTex = makeTexture();
  const glyphTex = makeTexture();
  const fbo = gl.createFramebuffer();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let sw = 0;
  let sh = 0;
  let quality = 0.5; //    照片的分辨率是画布（CSS 像素）的几分之几
  let mode: PrintMode = 'halftone';
  let center: [number, number] = [0.5, 0.5];
  let shy: [number, number, number, number] = [-1, -0.5, -1, -0.5];
  let zoom = 1.3;
  let ink: V3 = [0.1, 0.1, 0.1];
  let blue: V3 = [0, 0.18, 0.65];
  let dark = false;
  let lift = 0;

  let raf = 0;
  let visible = true;
  let destroyed = false;
  let lastFrame = 0;
  let slow = 0;
  let clock = -1; //       上一帧是第几秒（算每一帧隔了多久用）

  // ── 姿势的状态 ──
  const want = { x: 0, y: 0, held: false }; //  指针想让它看哪
  const lookX: Spring = { x: 0, v: 0 };
  const lookY: Spring = { x: 0, v: 0 };
  const lagX: Spring = { x: 0, v: 0 }; //       胡须：比头慢半拍
  const lagY: Spring = { x: 0, v: 0 };
  const sink: Spring = { x: 0, v: 0 }; //       接住石头的那一下，身子往水里一沉
  let tossAt = -100; //                          这一次掂石头是从第几秒开始的
  let tossPower = 1;
  let tossAgain = 0; //                          后面还要再掂几下
  let nextToss = 5;
  let caught = true;
  let blinkAt = -100;
  let nextBlink = 2.5;
  const rips = new Float32Array(24);
  let ripIndex = 0;
  const whisk = new Float32Array(72);

  const cell = () => (mode === 'photo' ? 1 : W < 700 ? 3 : 4) * dpr;

  const readTheme = () => {
    const css = getComputedStyle(host);
    dark = document.documentElement.dataset.theme === 'dark';
    ink = rgb(css.getPropertyValue('--print-ink'), dark ? [0.93, 0.92, 0.89] : [0.09, 0.09, 0.1]);
    blue = rgb(css.getPropertyValue('--print-blue'), dark ? [0.48, 0.6, 1] : [0, 0.184, 0.655]);
  };

  /** 字符模式用的字形：一排，由疏到密，白字黑底 */
  const buildGlyphs = () => {
    const w = Math.round((W < 700 ? 3 : 4) * dpr);
    const h = w * 2;
    const atlas = document.createElement('canvas');
    atlas.width = w * GLYPHS.length;
    atlas.height = h;
    const g = atlas.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, atlas.width, h);
    g.fillStyle = '#fff';
    g.font = `500 ${w / 0.6}px "JetBrains Mono NL", ui-monospace, Menlo, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    [...GLYPHS].forEach((ch, i) => g.fillText(ch, i * w + w / 2, h / 2 + dpr * 0.5));
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  };

  const allocate = () => {
    // 看原片的时候要拍得清楚一些；印成网点的话，一个点采一次样就够了
    const q = mode === 'photo' ? Math.min(dpr, 1.25) * Math.min(1, quality * 2) : quality;
    sw = Math.max(2, Math.round(W * q));
    sh = Math.max(2, Math.round(H * q));
    for (const tex of [colorTex, plateTex]) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, plateTex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const resize = () => {
    W = host.clientWidth;
    H = host.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    center = opts.center(W, H);
    shy = opts.shy?.(W, H) ?? [-1, -0.5, -1, -0.5];
    zoom = (opts.span(W, H) * Math.hypot(...CAMERA)) / (WIDTH * H);
    allocate();
    buildGlyphs();
  };

  /** 镜头：位置和三个方向。和着色器里的算法一模一样 */
  const camera = () => {
    const eye: V3 = [TARGET[0] + CAMERA[0], TARGET[1] + CAMERA[1] + lift, TARGET[2] + CAMERA[2]];
    const ww = norm(sub(TARGET, eye));
    const uu = norm(cross(ww, [0, 1, 0]));
    const vv = cross(uu, ww);
    return { eye, uu, vv, ww };
  };

  /** 世界里的一点落在画布的哪里（设备像素，原点在左下），以及它离镜头多远 */
  const project = (p: V3, cam: ReturnType<typeof camera>): [number, number, number] => {
    const d = sub(p, cam.eye);
    const z = dot(d, cam.ww);
    return [(center[0] * W + ((dot(d, cam.uu) / z) * zoom) * H) * dpr, ((1 - center[1]) * H + ((dot(d, cam.vv) / z) * zoom) * H) * dpr, z];
  };

  /** 屏幕上的一点（CSS 像素，原点在画布左上）落在水面的哪里 */
  const toWater = (x: number, y: number): [number, number] | null => {
    const { eye, uu, vv, ww } = camera();
    const u = (x - center[0] * W) / H;
    const v = (center[1] * H - y) / H;
    const rd = norm(add(add(mul(uu, u), mul(vv, v)), mul(ww, zoom)));
    if (rd[1] >= -1e-4) return null;
    const t = -eye[1] / rd[1];
    return [eye[0] + rd[0] * t, eye[2] + rd[2] * t];
  };

  const addRipple = (x: number, z: number, t: number, strength: number) => {
    rips.set([x, z, t, strength], ripIndex * 4);
    ripIndex = (ripIndex + 1) % 6;
  };

  const startToss = (t: number, power = 1, again = 1) => {
    if (t - tossAt < 1.2) return;
    tossAt = t;
    tossPower = power;
    tossAgain = again;
    caught = false;
    nextToss = t + 7 + Math.random() * 6;
  };

  const draw = (t: number, fixed?: PoseOverride) => {
    if (!W || !H) return;
    const dt = clock < 0 || fixed ? 1 / 60 : clamp(t - clock, 0, 1 / 20);
    clock = t;

    // ── 1. 摆姿势 ────────────────────────────────────────────
    // 没人理它的时候，自己慢慢地东张西望
    const tx = want.held ? want.x : 0.35 * Math.sin(t * 0.31) + 0.15 * Math.sin(t * 0.83 + 1.7);
    const ty = want.held ? want.y : 0.2 * Math.sin(t * 0.23 + 0.6);
    if (fixed?.look) {
      lookX.x = lagX.x = fixed.look[0];
      lookY.x = lagY.x = fixed.look[1];
      lookX.v = lookY.v = lagX.v = lagY.v = 0;
    } else {
      pull(lookX, tx, dt, 9, 0.62);
      pull(lookY, ty, dt, 9, 0.62);
      pull(lagX, lookX.x, dt, 5.5, 0.36);
      pull(lagY, lookY.x, dt, 5.5, 0.36);
    }

    // 掂石头：隔一阵自己来两下
    if (!still && !fixed && t > nextToss) startToss(t);
    const tossing = toss(fixed?.toss ?? t - tossAt, tossPower);
    if (!fixed) {
      if (tossing.landed && !caught) {
        // 接住的那一下：身子一沉，胸口的水荡一圈
        caught = true;
        sink.v -= 0.16 * tossPower;
        const chest = toWorld([STONE_REST[0], 0, 0], 0, 0);
        addRipple(chest[0], chest[2], t, 0.55 * tossPower);
      }
      if (tossing.done && tossAgain > 0) {
        tossAt = t;
        tossPower *= 0.55;
        tossAgain -= 1;
        caught = false;
      }
      pull(sink, 0, dt, 11, 0.45);
    }
    if (!still && !fixed && t > nextBlink) {
      blinkAt = t;
      nextBlink = t + 2.2 + Math.random() * 4;
    }
    const blinkAge = t - blinkAt;
    const blink = fixed?.blink ?? (blinkAge < 0.07 ? blinkAge / 0.07 : blinkAge < 0.2 ? 1 - (blinkAge - 0.07) / 0.13 : 0);

    // 身子：跟着水起伏、侧倾；头往哪边转，肩膀也跟过去一点
    const bob = 0.012 * Math.sin(t * 1.3) + sink.x;
    const roll = 0.035 * Math.sin(t * 0.9 + 1.0) - lookX.x * 0.035;
    const sway = 0.16 * Math.sin(t * 1.1);
    const toe = 0.1 * Math.sin(t * 1.7) * ease((Math.sin(t * 0.37) - 0.2) / 0.8);

    // 头：先左右转，再点头，再歪一点 —— 都是绕着脖子根，所以头的位置跟着走
    const up0 = norm(sub([1, 0, 0], mul(FACE, FACE[0])));
    let f = FACE;
    let u = up0;
    let r = cross(FACE, up0);
    const yaw = fixed?.turn ? fixed.turn[0] : -lookX.x * 0.42;
    // 抬头可以抬得多，低头没多少余地：下巴已经挨着胸口了
    const pitch = fixed?.turn ? fixed.turn[1] : lookY.x * (lookY.x > 0 ? 0.26 : 0.1);
    [f, r] = turn(f, r, yaw);
    [f, u] = turn(f, u, pitch);
    [u, r] = turn(u, r, fixed?.turn ? 0 : -lookX.x * 0.14);
    const head = add(NECK, mul(u, HEAD_UP));

    // 前肢：爪子去哪是定好的，肘由两节骨头的长度倒推（往外、往下弯）
    const want_: V3 = [PAW_REST[0], PAW_REST[1] + tossing.paw, PAW_REST[2] + 0.014 * tossing.air];
    const reach = sub(want_, SHOULDER);
    const far = Math.hypot(...reach);
    const span = Math.min(far, BONE * 1.995);
    const along = mul(reach, 1 / far);
    const paw = add(SHOULDER, mul(along, span));
    let pole: V3 = [-0.2, -0.55, 1];
    pole = norm(sub(pole, mul(along, dot(pole, along))));
    const elbow = add(add(SHOULDER, mul(along, span / 2)), mul(pole, Math.sqrt(Math.max(0, BONE * BONE - (span / 2) ** 2))));

    // 石头：刚体。抱着的时候轻轻晃，离手之后往前翻一整圈
    const stone: V3 = [STONE_REST[0], STONE_REST[1] + tossing.stone, STONE_REST[2]];
    const spin = tossing.spin * Math.PI * 2 + 0.06 * Math.sin(t * 0.8);
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);
    const cy = Math.cos(0.5);
    const sy = Math.sin(0.5);
    // 先绕竖轴转一个固定的角度（石头斜着放），再绕横轴翻
    const stoneRot = [cy * cs, cy * sn, -sy, -sn, cs, 0, sy * cs, sy * sn, cy];

    // 胡须：跟着头走，但梢比头慢半拍
    const cam = camera();
    WHISKERS.forEach((w, i) => {
      const tip: V3 = [w.tip[0], w.tip[1] - (lookY.x - lagY.x) * 0.16, w.tip[2] + (lookX.x - lagX.x) * 0.22];
      const mid: V3 = [(w.root[0] + tip[0]) / 2 + 0.02, (w.root[1] + tip[1]) / 2 - 0.035, (w.root[2] + tip[2]) / 2];
      [w.root, mid, tip].forEach((q, j) => {
        const b = add(add(add(head, mul(f, q[0] * HEAD_S)), mul(u, q[1] * HEAD_S)), mul(r, q[2] * HEAD_S));
        whisk.set(toWorld(b, bob, roll), i * 9 + j * 3);
      });
    });
    const face = project(toWorld(head, bob, roll), cam);

    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);

    // ── 2. 拍照 ──────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(scene.program);
    gl.uniform2f(scene.at('uRes'), sw, sh);
    gl.uniform1f(scene.at('uTime'), t);
    gl.uniform2f(scene.at('uCenter'), center[0], 1 - center[1]);
    gl.uniform1f(scene.at('uZoom'), zoom);
    gl.uniform1f(scene.at('uDark'), dark ? 1 : 0);
    gl.uniform1f(scene.at('uLift'), lift);
    gl.uniform4fv(scene.at('uRip'), rips);
    gl.uniform4f(scene.at('uShy'), ...shy);
    gl.uniform4f(scene.at('uBody'), bob, roll, sway, toe);
    gl.uniform3f(scene.at('uHead'), ...head);
    gl.uniformMatrix3fv(scene.at('uHeadRot'), false, [...f, ...u, ...r]);
    gl.uniform3f(scene.at('uElbow'), ...elbow);
    gl.uniform3f(scene.at('uPaw'), ...paw);
    gl.uniform3f(scene.at('uStone'), ...stone);
    gl.uniformMatrix3fv(scene.at('uStoneRot'), false, stoneRot);
    gl.uniform1f(scene.at('uBlink'), blink);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ── 3. 印刷 ──────────────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(print.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, colorTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, plateTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.uniform1i(print.at('uColor'), 0);
    gl.uniform1i(print.at('uPlate'), 1);
    gl.uniform1i(print.at('uGlyph'), 2);
    gl.uniform2f(print.at('uRes'), canvas.width, canvas.height);
    gl.uniform1f(print.at('uPx'), dpr);
    gl.uniform1f(print.at('uCell'), cell());
    gl.uniform1f(print.at('uGlyphs'), GLYPHS.length);
    gl.uniform1i(print.at('uMode'), PRINT_MODES.indexOf(mode));
    gl.uniform1f(print.at('uDark'), dark ? 1 : 0);
    gl.uniform3f(print.at('uInk'), ...ink);
    gl.uniform3f(print.at('uBlue'), ...blue);
    gl.uniform2f(print.at('uCenter'), center[0], 1 - center[1]);
    gl.uniform1f(print.at('uZoom'), zoom);
    gl.uniform3f(print.at('uEye'), ...cam.eye);
    gl.uniformMatrix3fv(print.at('uCam'), false, [...cam.uu, ...cam.vv, ...cam.ww]);
    gl.uniform3fv(print.at('uWhisk'), whisk);
    gl.uniform3f(print.at('uFace'), face[0], face[1], ((0.85 * zoom * H) / face[2]) * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /** 它自己坐标里的一点，在世界里是哪（把起伏、侧倾、朝向一层层还原回去） */
  function toWorld(b: V3, bob: number, roll: number): V3 {
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const y = cr * b[1] - sr * b[2] + bob;
    const z = sr * b[1] + cr * b[2];
    const c = Math.cos(YAW);
    const s = Math.sin(YAW);
    return [c * b[0] - s * z, y, s * b[0] + c * z];
  }

  const now = () => (still ? 3.4 : performance.now() / 1000);

  const loop = (ms: number) => {
    raf = 0;
    if (destroyed || !visible || document.hidden) return;
    // 连着几十帧都慢，就把照片的分辨率降一档
    if (lastFrame) {
      slow = ms - lastFrame > 30 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 40 && quality > 0.3) {
        quality *= 0.8;
        slow = 0;
        allocate();
      }
    }
    lastFrame = ms;
    draw(ms / 1000);
    raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    lastFrame = 0;
    clock = -1;
    if (!still && !raf && visible) raf = requestAnimationFrame(loop);
  };

  const local = (e: PointerEvent): [number, number] => {
    const box = canvas.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const [x, y] = local(e);
    want.x = clamp((x - center[0] * W) / (W * 0.4), -1, 1);
    want.y = clamp((center[1] * H - y) / (H * 0.5), -1, 1);
    want.held = true;
  };
  const onLeave = () => {
    want.held = false;
  };
  const onDown = (e: PointerEvent) => {
    if (still || (e.target as HTMLElement).closest('a, button, input, [data-no-ripple]')) return;
    const [x, y] = local(e);
    const hit = toWater(x, y);
    if (!hit) return;
    const t = performance.now() / 1000;
    // 点在它身上：掂一下石头；点在水上：起一圈涟漪
    const bx = Math.cos(YAW) * hit[0] + Math.sin(YAW) * hit[1];
    const bz = -Math.sin(YAW) * hit[0] + Math.cos(YAW) * hit[1];
    if (Math.hypot((bx + 0.1) / 1.15, bz / 0.5) < 1) startToss(t);
    else addRipple(hit[0], hit[1], t, 1);
  };
  const onScroll = () => {
    lift = clamp(window.scrollY / Math.max(1, H), 0, 1) * 0.9;
    if (still) draw(now());
  };

  readTheme();
  resize();
  draw(now());

  const ro = new ResizeObserver(() => {
    resize();
    draw(now());
  });
  ro.observe(host);
  const io = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    kick();
  });
  io.observe(host);
  const mo = new MutationObserver(() => {
    readTheme();
    draw(now());
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onVisibility = () => kick();
  document.addEventListener('visibilitychange', onVisibility);
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onLeave, { passive: true });
  host.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  void document.fonts?.ready.then(() => {
    buildGlyphs();
    draw(now());
  });
  kick();

  return {
    mode(next) {
      mode = next;
      allocate();
      draw(now());
    },
    renderAt: draw,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
    },
  };
}
