/**
 * 十九张会动的小图：每一章一张，用几笔把「这个组件在干什么」画出来。
 * 它们出现在架构图旁边的检视面板里，也出现在目录里指针划过时跟着走的那张小卡片上。
 * 画在一块很小的 canvas 上（逻辑尺寸大约 280 × 120），只用三种颜色：墨、淡墨、蓝。
 */

export interface FigColors {
  ink: string;
  dim: string;
  accent: string;
}

type Draw = (c: CanvasRenderingContext2D, w: number, h: number, t: number, k: FigColors) => void;

const TAU = Math.PI * 2;
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const P = 16; //  四周留白

/** 在留白以内画一条函数曲线：x、y 都是 0…1 */
function plot(c: CanvasRenderingContext2D, w: number, h: number, f: (x: number) => number, from = 0, to = 1) {
  c.beginPath();
  for (let i = 0; i <= 64; i++) {
    const x = from + ((to - from) * i) / 64;
    const px = P + x * (w - 2 * P);
    const py = h - P - f(x) * (h - 2 * P);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.stroke();
}

const at = (w: number, h: number, x: number, y: number): [number, number] => [P + x * (w - 2 * P), h - P - y * (h - 2 * P)];

function dot(c: CanvasRenderingContext2D, x: number, y: number, r = 3.5) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

const warmupCosine = (x: number) => (x < 0.12 ? x / 0.12 : 0.5 + 0.5 * Math.cos(((x - 0.12) / 0.88) * Math.PI)) * 0.92 + 0.04;
const swish = (x: number) => {
  const v = (x - 0.5) * 7;
  return (v / (1 + Math.exp(-v * 1.3))) / 4.2 + 0.14;
};

const FIGS: Record<string, Draw> = {
  // 一个词被切成几块；隔一会儿换一种切法
  tokenizer(c, w, h, t, k) {
    const cuts = [['token', 'iz', 'ation'], ['to', 'ken', 'ization'], ['t', 'o', 'k', 'e', 'n', 'iz', 'ation']][Math.floor(t / 1.8) % 3]!;
    c.font = '500 15px "JetBrains Mono NL", monospace';
    c.textBaseline = 'middle';
    const widths = cuts.map((s) => c.measureText(s).width + 14);
    let x = (w - widths.reduce((a, b) => a + b, 0) - (cuts.length - 1) * 5) / 2;
    cuts.forEach((s, i) => {
      c.fillStyle = i % 2 ? k.accent : k.ink;
      c.globalAlpha = i % 2 ? 0.14 : 0.07;
      c.fillRect(x, h / 2 - 15, widths[i]!, 30);
      c.globalAlpha = 1;
      c.strokeStyle = i % 2 ? k.accent : k.dim;
      c.strokeRect(x + 0.5, h / 2 - 14.5, widths[i]! - 1, 29);
      c.fillStyle = i % 2 ? k.accent : k.ink;
      c.fillText(s, x + 7, h / 2 + 1);
      x += widths[i]! + 5;
    });
  },

  // 查表：每个 token 取出自己的那一行向量
  embedding(c, w, h, t, k) {
    const rows = 6;
    const cols = 18;
    const s = Math.min((w - 2 * P) / cols, (h - 2 * P) / rows);
    const pick = Math.floor(t * 1.3) % rows;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        c.fillStyle = r === pick ? k.accent : k.ink;
        c.globalAlpha = (r === pick ? 0.25 : 0.06) + rnd(r * 31 + i) * (r === pick ? 0.75 : 0.3);
        c.fillRect((w - cols * s) / 2 + i * s, (h - rows * s) / 2 + r * s, s - 2, s - 2);
      }
    }
    c.globalAlpha = 1;
  },

  // 旋转位置编码：每一对维度转得不一样快
  position(c, w, h, t, k) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const [x, y] = at(w, h, (i + 0.5) / n, 0.5);
      const a = t * 2.2 * 0.62 ** i;
      c.strokeStyle = k.dim;
      c.beginPath();
      c.arc(x, y, 14, 0, TAU);
      c.stroke();
      c.strokeStyle = i ? k.ink : k.accent;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 14, y - Math.sin(a) * 14);
      c.stroke();
      c.lineWidth = 1;
    }
  },

  // 一组高高低低的激活，被拉回到同一个尺度
  normalization(c, w, h, t, k) {
    const n = 14;
    const raw = Array.from({ length: n }, (_, i) => 0.12 + rnd(i * 7.3) ** 2 * 1.9);
    const mean = raw.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(raw.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const s = 0.5 - 0.5 * Math.cos(t * 1.5);
    const bw = (w - 2 * P) / n;
    raw.forEach((v, i) => {
      const y = (v * (1 - s) + (((v - mean) / std) * 0.2 + 0.5) * s) * 0.5;
      c.fillStyle = k.ink;
      c.globalAlpha = 0.75;
      c.fillRect(P + i * bw + 2, h - P - y * (h - 2 * P), bw - 4, y * (h - 2 * P));
    });
    c.globalAlpha = s;
    c.strokeStyle = k.accent;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(P, h - P - 0.25 * (h - 2 * P));
    c.lineTo(w - P, h - P - 0.25 * (h - 2 * P));
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
  },

  // 因果注意力：每个位置只看自己和前面的；一行一行扫过去
  attention(c, w, h, t, k) {
    const n = 8;
    const s = Math.min((h - 2 * P) / n, 13);
    const x0 = (w - n * s) / 2;
    const y0 = (h - n * s) / 2;
    const row = Math.floor(t * 1.6) % n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (j > i) {
          c.fillStyle = k.dim;
          c.globalAlpha = 0.5;
          c.fillRect(x0 + j * s + s / 2 - 1, y0 + i * s + s / 2 - 1, 1.5, 1.5);
          continue;
        }
        c.fillStyle = i === row ? k.accent : k.ink;
        c.globalAlpha = i === row ? 0.2 + 0.8 * rnd(i * 13 + j * 5) ** 1.5 : 0.07 + 0.2 * rnd(i * 13 + j * 5);
        c.fillRect(x0 + j * s, y0 + i * s, s - 2, s - 2);
      }
    }
    c.globalAlpha = 1;
  },

  // 一条激活函数，和在它上面来回走的一个点
  ffn(c, w, h, t, k) {
    c.strokeStyle = k.dim;
    c.beginPath();
    c.moveTo(P, h - P - 0.14 * (h - 2 * P));
    c.lineTo(w - P, h - P - 0.14 * (h - 2 * P));
    c.stroke();
    c.strokeStyle = k.ink;
    c.lineWidth = 1.6;
    plot(c, w, h, swish);
    c.lineWidth = 1;
    const x = 0.5 + 0.46 * Math.sin(t * 1.1);
    c.fillStyle = k.accent;
    dot(c, ...at(w, h, x, swish(x)), 4);
  },

  // 一条直通的路，和一条绕过去再加回来的路
  residual(c, w, h, t, k) {
    const y = h * 0.62;
    const [a, b] = [w * 0.26, w * 0.74];
    c.strokeStyle = k.ink;
    c.beginPath();
    c.moveTo(P, y);
    c.lineTo(w - P, y);
    c.stroke();
    c.fillStyle = k.ink;
    c.globalAlpha = 0.08;
    c.fillRect(w * 0.4, y - 13, w * 0.2, 26);
    c.globalAlpha = 1;
    c.strokeRect(w * 0.4 + 0.5, y - 12.5, w * 0.2 - 1, 25);
    c.strokeStyle = k.accent;
    c.beginPath();
    c.moveTo(a, y);
    c.bezierCurveTo(a, y - 52, b, y - 52, b, y);
    c.stroke();
    c.beginPath();
    c.arc(b, y, 7, 0, TAU);
    c.moveTo(b - 4, y);
    c.lineTo(b + 4, y);
    c.moveTo(b, y - 4);
    c.lineTo(b, y + 4);
    c.stroke();
    const p = (t * 0.45) % 1;
    c.fillStyle = k.ink;
    dot(c, P + p * (w - 2 * P), y, 3);
    const q = Math.min(1, Math.max(0, (p * (w - 2 * P) + P - a) / (b - a)));
    if (q > 0 && q < 1) {
      c.fillStyle = k.accent;
      const u = 1 - q;
      dot(c, u * u * u * a + 3 * u * u * q * a + 3 * u * q * q * b + q * q * q * b, y - 3 * u * q * 52, 3);
    }
  },

  // 同一摞层走了一遍，又走一遍
  loop(c, w, h, t, k) {
    const n = 5;
    const lap = Math.floor(t / 2.5) % 3;
    const cur = Math.floor(((t % 2.5) / 2.5) * n);
    for (let i = 0; i < n; i++) {
      const y = h - P - (i + 1) * ((h - 2 * P) / n) + 3;
      c.fillStyle = i === cur ? k.accent : k.ink;
      c.globalAlpha = i === cur ? 1 : 0.14;
      c.fillRect(w * 0.26, y, w * 0.36, (h - 2 * P) / n - 6);
    }
    c.globalAlpha = 1;
    c.strokeStyle = k.dim;
    c.beginPath();
    c.moveTo(w * 0.62, P + 8);
    c.bezierCurveTo(w * 0.8, P + 8, w * 0.8, h - P - 8, w * 0.62, h - P - 8);
    c.stroke();
    c.fillStyle = k.ink;
    c.font = '500 12px "JetBrains Mono NL", monospace';
    c.fillText(`× ${lap + 1}`, w * 0.8, h / 2 + 4);
  },

  // 一排 logits，最高的那个被选出来
  head(c, w, h, t, k) {
    const n = 14;
    const logits = Array.from({ length: n }, (_, i) => 2.4 * Math.sin(i * 1.7 + Math.floor(t / 1.4) * 2.1) + 1.5 * rnd(i * 3.1));
    const mx = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - mx));
    const bw = (w - 2 * P) / n;
    exps.forEach((v, i) => {
      c.fillStyle = v === 1 ? k.accent : k.ink;
      c.globalAlpha = v === 1 ? 1 : 0.55;
      c.fillRect(P + i * bw + 2, h - P - v * (h - 2 * P), bw - 4, v * (h - 2 * P));
    });
    c.globalAlpha = 1;
  },

  // 文档排着队流过来，四个一组打成批
  data(c, w, h, t, k) {
    const gap = 17;
    const shift = (t * 22) % (gap * 4);
    for (let lane = 0; lane < 3; lane++) {
      for (let i = -1; i < 18; i++) {
        const x = P + i * gap + shift * (0.6 + lane * 0.2);
        if (x < P - 2 || x > w - P - 10) continue;
        c.fillStyle = (i + lane) % 4 === 0 ? k.accent : k.ink;
        c.globalAlpha = 0.25 + 0.6 * rnd(i * 3 + lane * 17);
        c.fillRect(x, h * (0.24 + lane * 0.26) - 7, 11, 14);
      }
    }
    c.globalAlpha = 1;
  },

  // 预测的分布一点点往正确答案上靠
  objective(c, w, h, t, k) {
    const n = 9;
    const s = (t * 0.35) % 1;
    const bw = (w - 2 * P) / n;
    for (let i = 0; i < n; i++) {
      const start = 0.12 + 0.5 * rnd(i * 5.7);
      const v = start * (1 - s) + (i === 5 ? 0.95 : 0.04) * s;
      c.fillStyle = i === 5 ? k.accent : k.ink;
      c.globalAlpha = i === 5 ? 1 : 0.5;
      c.fillRect(P + i * bw + 3, h - P - v * (h - 2 * P), bw - 6, v * (h - 2 * P));
    }
    c.globalAlpha = 1;
    c.fillStyle = k.dim;
    c.font = '11px "JetBrains Mono NL", monospace';
    c.fillText(`loss ${(2.6 * (1 - s) ** 1.6 + 0.08).toFixed(2)}`, P, P + 4);
  },

  // 等高线，和一条螺旋着落进谷底的路
  optimizer(c, w, h, t, k) {
    const [cx, cy] = [w * 0.56, h * 0.54];
    c.strokeStyle = k.dim;
    for (let i = 1; i <= 4; i++) {
      c.globalAlpha = 0.25 + 0.15 * i;
      c.beginPath();
      c.ellipse(cx, cy, i * 26, i * 11, -0.3, 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
    const steps = 46;
    const upto = ((t * 0.3) % 1.15) * steps;
    c.strokeStyle = k.accent;
    c.lineWidth = 1.5;
    c.beginPath();
    let last: [number, number] = [0, 0];
    for (let i = 0; i <= Math.min(steps, upto); i++) {
      const r = 0.93 ** i;
      last = [cx + Math.cos(i * 0.55 + 2.4) * 100 * r, cy + Math.sin(i * 0.55 + 2.4) * 40 * r];
      if (i) c.lineTo(...last);
      else c.moveTo(...last);
    }
    c.stroke();
    c.lineWidth = 1;
    c.fillStyle = k.accent;
    dot(c, ...last, 3.5);
  },

  // 先热身，再沿着余弦降下去
  schedule(c, w, h, t, k) {
    c.strokeStyle = k.dim;
    c.beginPath();
    c.moveTo(P, h - P);
    c.lineTo(w - P, h - P);
    c.stroke();
    c.strokeStyle = k.ink;
    c.lineWidth = 1.6;
    plot(c, w, h, warmupCosine);
    c.lineWidth = 1;
    const x = (t * 0.22) % 1;
    c.fillStyle = k.accent;
    dot(c, ...at(w, h, x, warmupCosine(x)), 4);
  },

  // 每一步随机关掉一些单元
  regularization(c, w, h, t, k) {
    const [rows, cols] = [5, 14];
    const beat = Math.floor(t * 1.6);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        const [x, y] = at(w, h, (i + 0.5) / cols, (r + 0.5) / rows);
        const off = rnd(r * 19 + i * 7 + beat * 101) < 0.26;
        c.fillStyle = k.ink;
        c.strokeStyle = k.dim;
        c.beginPath();
        c.arc(x, y, 4, 0, TAU);
        if (off) c.stroke();
        else c.fill();
      }
    }
  },

  // 信号穿过很多层：炸掉、消失，或者刚刚好
  initialization(c, w, h, t, k) {
    const s = 0.5 + 0.5 * Math.sin(t * 0.9);
    c.strokeStyle = k.dim;
    plot(c, w, h, (x) => 0.5 + 0.48 * x ** 1.6 * (0.4 + 0.6 * s));
    plot(c, w, h, (x) => 0.5 - 0.46 * x ** 0.7 * (0.4 + 0.6 * s));
    c.strokeStyle = k.accent;
    c.lineWidth = 1.6;
    plot(c, w, h, (x) => 0.5 + 0.03 * Math.sin(x * 14 + t * 2));
    c.lineWidth = 1;
  },

  // 训练损失一直在降，验证损失掉头往上的那一刻
  evaluation(c, w, h, t, k) {
    const train = (x: number) => 0.86 * Math.exp(-x * 3.4) + 0.06;
    const val = (x: number) => 0.8 * Math.exp(-x * 3.8) + 0.2 + 0.42 * Math.max(0, x - 0.45) ** 1.5;
    c.strokeStyle = k.dim;
    plot(c, w, h, train);
    c.strokeStyle = k.ink;
    c.lineWidth = 1.6;
    plot(c, w, h, val);
    c.lineWidth = 1;
    const x = (t * 0.2) % 1;
    const [px, py] = at(w, h, x, val(x));
    c.strokeStyle = k.accent;
    c.setLineDash([3, 4]);
    c.beginPath();
    c.moveTo(px, P);
    c.lineTo(px, h - P);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = k.accent;
    dot(c, px, py, 3.5);
  },

  // 大模型把「软」的答案一点点传给小模型
  distillation(c, w, h, t, k) {
    const [ax, bx, y] = [w * 0.24, w * 0.8, h / 2];
    c.strokeStyle = k.ink;
    c.beginPath();
    c.arc(ax, y, 30, 0, TAU);
    c.stroke();
    c.strokeStyle = k.accent;
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(bx, y, 13, 0, TAU);
    c.stroke();
    c.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.5 + i / 5) % 1;
      const yy = y + (i - 2) * 9 * (1 - p * 0.75);
      c.fillStyle = k.accent;
      c.globalAlpha = Math.sin(p * Math.PI);
      dot(c, ax + 34 + p * (bx - ax - 50), yy, 2.6);
    }
    c.globalAlpha = 1;
  },

  // 一条光滑的线，被压成越来越少的几级台阶
  quantization(c, w, h, t, k) {
    const f = (x: number) => 0.5 + 0.4 * Math.sin(x * TAU * 1.15 + 0.4);
    const levels = [16, 8, 4, 2][Math.floor(t / 1.5) % 4]!;
    c.strokeStyle = k.dim;
    plot(c, w, h, f);
    c.strokeStyle = k.accent;
    c.lineWidth = 1.6;
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const x = i / 48;
      const [px, py] = at(w, h, x, Math.round(f(Math.floor(x * 24) / 24) * (levels - 1)) / (levels - 1));
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.stroke();
    c.lineWidth = 1;
    c.fillStyle = k.dim;
    c.font = '11px "JetBrains Mono NL", monospace';
    c.fillText(`${Math.log2(levels)} bit`, P, P + 4);
  },

  // 一个一个往外吐 token；前面算过的都留在缓存里
  inference(c, w, h, t, k) {
    const n = 12;
    const upto = Math.floor(t * 2.4) % (n + 3);
    const s = (w - 2 * P) / n;
    for (let i = 0; i < n; i++) {
      const done = i < upto;
      c.fillStyle = i === upto - 1 ? k.accent : k.ink;
      c.globalAlpha = done ? (i === upto - 1 ? 1 : 0.5) : 0.08;
      c.fillRect(P + i * s + 2, h * 0.3, s - 4, 20);
    }
    c.globalAlpha = 0.9;
    c.fillStyle = k.ink;
    c.fillRect(P + 2, h * 0.68, Math.min(upto, n) * s - 4, 3);
    c.globalAlpha = 1;
    c.fillStyle = k.dim;
    c.font = '11px "JetBrains Mono NL", monospace';
    c.fillText('kv cache', P + 2, h * 0.68 + 18);
  },
};

/** 把 canvas 的像素尺寸对到屏幕上，并画出 id 这一章在第 t 秒的小图 */
export function drawFig(canvas: HTMLCanvasElement, id: string, t: number) {
  const draw = FIGS[id];
  const c = canvas.getContext('2d');
  if (!draw || !c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 280;
  const h = canvas.clientHeight || 120;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const css = getComputedStyle(canvas);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.lineWidth = 1;
  c.globalAlpha = 1;
  c.setLineDash([]);
  draw(c, w, h, t, {
    ink: css.getPropertyValue('--ink').trim() || '#16161a',
    dim: css.getPropertyValue('--ink-4').trim() || '#aaa79d',
    accent: css.getPropertyValue('--accent-ink').trim() || '#002fa7',
  });
}

export const hasFig = (id: string) => id in FIGS;
