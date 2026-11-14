// The image, drawn on a canvas: the preview and the PNG come from the same drawing, so what the
// reader sees is what they save. Sizes are in CSS pixels; scale multiplies them all.
import type { Highlighted } from "./highlight";
import type { Background, Rand } from "./presets";

export interface OutputLine {
  text: string;
  stderr: boolean;
}

export interface Scene {
  code: Highlighted;
  /** output is the program's output, drawn under the code; null draws no output section. */
  output: OutputLine[] | null;
  /** command is the line drawn at the top of the output section. */
  command: string;
  background: Background;
  seed: number;
  grain: boolean;
  padding: number;
  fontSize: number;
  lineNumbers: boolean;
  chrome: "mac" | "tab" | "none";
  title: string;
  /** highlight holds 0-based line numbers; when any are set, the other lines dim. */
  highlight: Set<number>;
  /** ratio is the image's width over its height; 0 fits the image to the code. */
  ratio: number;
}

export interface Layout {
  width: number;
  height: number;
  win: { x: number; y: number; w: number; h: number };
  codeTop: number;
  lineHeight: number;
  lines: number;
}

export const fontFamily = '"Commit Mono", ui-monospace, Menlo, monospace';
const font = (size: number, italic = false) => `${italic ? "italic " : ""}${size}px ${fontFamily}`;

/** fontsReady resolves once Commit Mono, upright and italic, can be drawn. */
export async function fontsReady(): Promise<void> {
  await Promise.all([document.fonts.load(font(16)), document.fonts.load(font(16, true))]);
}

const maxOutputLines = 30;

/** outputLines is the output as drawn: at most maxOutputLines, then a note of the rest. */
function outputLines(output: OutputLine[]): OutputLine[] {
  if (output.length <= maxOutputLines) return output;
  return [
    ...output.slice(0, maxOutputLines - 1),
    { text: `… ${output.length - maxOutputLines + 1} more lines`, stderr: false },
  ];
}

function metrics(s: Scene) {
  const fs = s.fontSize;
  return {
    fs,
    lh: Math.round(fs * 1.7),
    chromeH: s.chrome === "none" ? 0 : Math.round(fs * 2.8),
    px: Math.round(fs * 1.6),
    py: Math.round(fs * 1.3),
    radius: Math.round(fs * 0.8),
  };
}

export function layout(ctx: CanvasRenderingContext2D, s: Scene): Layout {
  const { fs, lh, chromeH, px, py } = metrics(s);
  ctx.font = font(fs);
  const lines = s.code.lines;
  let codeW = 0;
  for (const line of lines) {
    let w = 0;
    for (const t of line) {
      ctx.font = font(fs, t.italic);
      w += ctx.measureText(t.text).width;
    }
    codeW = Math.max(codeW, w);
  }
  ctx.font = font(fs);
  const gutter = s.lineNumbers ? ctx.measureText(String(lines.length)).width + fs * 1.4 : 0;
  let winW = px * 2 + gutter + codeW;
  let winH = chromeH + py * 2 + lines.length * lh;
  if (s.output) {
    const out = outputLines(s.output);
    ctx.font = font(fs * 0.9);
    let outW = ctx.measureText(s.command).width;
    for (const l of out) outW = Math.max(outW, ctx.measureText(l.text).width);
    winW = Math.max(winW, px * 2 + outW);
    winH += py * 2 + (out.length + 1) * Math.round(lh * 0.9);
  }
  winW = Math.ceil(Math.max(winW, fs * 22));
  winH = Math.ceil(winH);

  let width = winW + s.padding * 2;
  let height = winH + s.padding * 2;
  if (s.ratio > 0) {
    if (width / height < s.ratio) width = height * s.ratio;
    else height = width / s.ratio;
  }
  width = Math.round(width);
  height = Math.round(height);
  const x = Math.round((width - winW) / 2);
  const y = Math.round((height - winH) / 2);
  return {
    width,
    height,
    win: { x, y, w: winW, h: winH },
    codeTop: y + chromeH + py,
    lineHeight: lh,
    lines: lines.length,
  };
}

/** lineAt is the 0-based code line under (x, y), in the image's CSS pixels, or -1. */
export function lineAt(l: Layout, x: number, y: number): number {
  if (x < l.win.x || x > l.win.x + l.win.w) return -1;
  const i = Math.floor((y - l.codeTop) / l.lineHeight);
  return i >= 0 && i < l.lines ? i : -1;
}

/** draw sizes canvas to the scene at scale and draws it. */
export function draw(canvas: HTMLCanvasElement, s: Scene, scale: number): Layout {
  const ctx = canvas.getContext("2d")!;
  const l = layout(ctx, s);
  canvas.width = Math.round(l.width * scale);
  canvas.height = Math.round(l.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = "middle";

  const rand = mulberry32(s.seed);
  if (s.background.draw) {
    s.background.draw(ctx, l.width, l.height, rand);
    if (s.grain) grain(ctx, canvas, scale);
  }
  drawWindow(ctx, s, l);
  return l;
}

function drawWindow(ctx: CanvasRenderingContext2D, s: Scene, l: Layout) {
  const { fs, lh, chromeH, px, py, radius } = metrics(s);
  const { x, y, w, h } = l.win;
  const { fg, bg } = s.code;
  const dark = luminance(bg) < 0.4;
  const muted = mix(fg, bg, 0.45);

  // Shadows in two layers, a wide soft one and a close one, as a window casts.
  ctx.save();
  ctx.fillStyle = opaque(bg);
  for (const [color, blur, dy] of [
    ["rgba(0,0,0,0.45)", fs * 4, fs * 1.6],
    ["rgba(0,0,0,0.25)", fs * 0.8, fs * 0.3],
  ] as const) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = dy;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = opaque(bg);
  ctx.fillRect(x, y, w, h);
  // A faint sheen from the top edge.
  const sheen = ctx.createLinearGradient(0, y, 0, y + Math.max(chromeH, fs * 3) * 2);
  sheen.addColorStop(0, dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.6)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);

  // The title bar.
  if (s.chrome !== "none") {
    const cy = y + chromeH / 2;
    const dot = fs * 0.38;
    ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + px + dot + i * dot * 3.2, cy, dot, 0, Math.PI * 2);
      ctx.fill();
    });
    if (s.title) {
      ctx.font = font(fs * 0.85);
      ctx.textAlign = "center";
      if (s.chrome === "tab") {
        const tw = ctx.measureText(s.title).width + fs * 2;
        ctx.fillStyle = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
        ctx.beginPath();
        ctx.roundRect(x + w / 2 - tw / 2, cy - fs * 0.85, tw, fs * 1.7, fs * 0.4);
        ctx.fill();
        ctx.fillStyle = fg;
      } else {
        ctx.fillStyle = muted;
      }
      ctx.fillText(s.title, x + w / 2, cy + 0.5);
      ctx.textAlign = "left";
    }
  }

  // The code. Highlighted lines get a band; the others fade.
  const lines = s.code.lines;
  const focus = s.highlight.size > 0;
  ctx.font = font(fs);
  const gutter = s.lineNumbers ? ctx.measureText(String(lines.length)).width + fs * 1.4 : 0;
  lines.forEach((line, i) => {
    const top = l.codeTop + i * lh;
    const cy = top + lh / 2;
    const on = s.highlight.has(i);
    if (on) {
      ctx.fillStyle = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(x, top, w, lh);
      ctx.fillStyle = mix(fg, bg, 0.2);
      ctx.fillRect(x, top, 3, lh);
    }
    ctx.globalAlpha = focus && !on ? 0.35 : 1;
    if (s.lineNumbers) {
      ctx.font = font(fs);
      ctx.fillStyle = on ? fg : muted;
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), x + px + gutter - fs * 1.4, cy);
      ctx.textAlign = "left";
    }
    let tx = x + px + gutter;
    for (const t of line) {
      ctx.font = font(fs, t.italic);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, tx, cy);
      tx += ctx.measureText(t.text).width;
    }
    ctx.globalAlpha = 1;
  });

  // The output, as a terminal below the code.
  if (s.output) {
    const top = l.codeTop + lines.length * lh + py;
    ctx.fillStyle = dark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.035)";
    ctx.fillRect(x, top, w, y + h - top);
    ctx.fillStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    ctx.fillRect(x, top, w, 1);
    const olh = Math.round(lh * 0.9);
    ctx.font = font(fs * 0.9);
    let oy = top + py + olh / 2;
    ctx.fillStyle = muted;
    ctx.fillText(s.command, x + px, oy);
    const red = dark ? "#f87171" : "#dc2626";
    for (const line of outputLines(s.output)) {
      oy += olh;
      ctx.fillStyle = line.stderr ? red : fg;
      ctx.fillText(line.text, x + px, oy);
    }
  }
  ctx.restore();

  // A hairline edge, so the window holds against a background of its own color.
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

let noise: HTMLCanvasElement | undefined;

/** grain lays fine noise over the background in device pixels, whatever the scale. */
function grain(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scale: number) {
  if (!noise) {
    noise = document.createElement("canvas");
    noise.width = noise.height = 192;
    const n = noise.getContext("2d")!;
    const img = n.createImageData(192, 192);
    const rand = mulberry32(42);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    n.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = ctx.createPattern(noise, "repeat")!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  const full = hex.length <= 4 ? Array.from(hex.slice(0, 3), (c) => c + c).join("") : hex.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** opaque drops a color's alpha: the window is solid whatever the theme says. */
function opaque(color: string): string {
  const [r, g, b] = rgb(color);
  return `rgb(${r},${g},${b})`;
}

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
