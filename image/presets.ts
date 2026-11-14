import type { ThemeRegistrationAny } from "shiki/core";
import { antDark, antLight } from "../.vitepress/ant-theme";

// The code themes: Ant's own first, then a few of Shiki's. The grammar names standard TextMate
// scopes, so any VS Code theme colors Ant code. Shiki's load only when picked.

export interface CodeTheme {
  id: string;
  name: string;
  load: () => Promise<ThemeRegistrationAny>;
}

// The site's themes draw on the page's own background; an image needs one of its own.
const withBackground = (t: ThemeRegistrationAny, bg: string): ThemeRegistrationAny => ({
  ...t,
  colors: { ...t.colors, "editor.background": bg },
});

const shiki = (id: string, name: string): CodeTheme => ({
  id,
  name,
  load: async () => {
    const { bundledThemes } = await import("shiki/themes");
    return (await bundledThemes[id as keyof typeof bundledThemes]()).default;
  },
});

export const themes: CodeTheme[] = [
  { id: "ant-dark", name: "Ant Dark", load: async () => withBackground(antDark, "#16161a") },
  { id: "ant-light", name: "Ant Light", load: async () => withBackground(antLight, "#ffffff") },
  shiki("tokyo-night", "Tokyo Night"),
  shiki("catppuccin-mocha", "Catppuccin Mocha"),
  shiki("rose-pine", "Rosé Pine"),
  shiki("dracula", "Dracula"),
  shiki("one-dark-pro", "One Dark Pro"),
  shiki("nord", "Nord"),
  shiki("vitesse-dark", "Vitesse Dark"),
  shiki("github-dark-default", "GitHub Dark"),
  shiki("catppuccin-latte", "Catppuccin Latte"),
  shiki("rose-pine-dawn", "Rosé Pine Dawn"),
  shiki("github-light-default", "GitHub Light"),
];

// The backgrounds. A mesh is a base color under soft radial blobs, placed by a seed so Shuffle
// moves them; grain goes over the top when it is on.

export type Rand = () => number;

export interface Background {
  id: string;
  name: string;
  /** swatch is the CSS background of the picker's button. */
  swatch: string;
  /** draw paints the background; none means transparent. */
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number, rand: Rand) => void;
}

function mesh(id: string, name: string, base: string, blobs: string[]): Background {
  const spots = ["15% 20%", "85% 15%", "80% 85%", "20% 90%", "50% 50%"];
  return {
    id,
    name,
    swatch: [...blobs.map((c, i) => `radial-gradient(at ${spots[i]}, ${c}, transparent 65%)`), base].join(", "),
    draw(ctx, w, h, rand) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const size = Math.max(w, h);
      for (const color of blobs) {
        const x = rand() * w;
        const y = rand() * h;
        const r = size * (0.45 + rand() * 0.35);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, transparent(color));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };
}

/** transparent is color with no alpha, so a gradient to it fades without going gray. */
function transparent(hex: string): string {
  return hex.length === 7 ? `${hex}00` : "rgba(0,0,0,0)";
}

// The colors of the ant (theme/AntTrail.vue).
const antColors = ["#2563eb", "#7c3aed", "#f43f5e", "#f59e0b"];

const trail: Background = {
  id: "trail",
  name: "Ant trail",
  swatch:
    "radial-gradient(circle, #7c3aed 1.5px, transparent 2px) 0 0 / 8px 8px, radial-gradient(at 30% 30%, #4c1d95, transparent 70%), #0f0b1a",
  draw(ctx, w, h, rand) {
    ctx.fillStyle = "#0f0b1a";
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.3, h * 0.25, 0, w * 0.3, h * 0.25, Math.max(w, h) * 0.8);
    glow.addColorStop(0, "#4c1d95aa");
    glow.addColorStop(1, "#4c1d9500");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    // Dotted trails winding across, one in each of the ant's colors.
    const step = 9;
    antColors.forEach((color, k) => {
      const y0 = h * (0.12 + 0.26 * k + (rand() - 0.5) * 0.1);
      const amp = h * (0.05 + rand() * 0.06);
      const freq = 1 + rand() * 1.2;
      const phase = rand() * Math.PI * 2;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      for (let x = -step; x < w + step; x += step) {
        const y = y0 + Math.sin((x / w) * Math.PI * 2 * freq + phase) * amp;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  },
};

const solid = (id: string, name: string, color: string): Background => ({
  id,
  name,
  swatch: color,
  draw(ctx, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  },
});

export const backgrounds: Background[] = [
  mesh("violet", "Violet", "#1a0b2e", ["#7c3aed", "#c026d3", "#2563eb", "#4c1d95"]),
  mesh("sunset", "Sunset", "#2a0a18", ["#f43f5e", "#f59e0b", "#db2777", "#7c2d12"]),
  mesh("ocean", "Ocean", "#031a26", ["#0ea5e9", "#2563eb", "#14b8a6", "#1e3a8a"]),
  mesh("aurora", "Aurora", "#06101f", ["#22d3ee", "#a78bfa", "#34d399", "#1d4ed8"]),
  mesh("ember", "Ember", "#140806", ["#ea580c", "#b91c1c", "#facc15", "#431407"]),
  trail,
  mesh("peach", "Peach", "#fff4ec", ["#fdba74", "#f9a8d4", "#c4b5fd", "#fde68a"]),
  mesh("mint", "Mint", "#effcf6", ["#6ee7b7", "#93c5fd", "#a5f3fc", "#d9f99d"]),
  mesh("lilac", "Lilac", "#f6f1ff", ["#c4b5fd", "#f0abfc", "#a5b4fc", "#fbcfe8"]),
  solid("graphite", "Graphite", "#26262c"),
  solid("paper", "Paper", "#f3f1ec"),
  {
    id: "none",
    name: "Transparent",
    swatch: "repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 10px 10px",
  },
];

export const sizes = [
  { id: "auto", name: "Fit", ratio: 0 },
  { id: "16:9", name: "16:9", ratio: 16 / 9 },
  { id: "og", name: "1200×630", ratio: 1200 / 630 },
  { id: "4:5", name: "4:5", ratio: 4 / 5 },
  { id: "1:1", name: "1:1", ratio: 1 },
] as const;

export type SizeId = (typeof sizes)[number]["id"];
