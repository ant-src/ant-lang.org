<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { colors, crumbEvent, drawAnt, Trail, type Point } from "./ants";

// The ants of the home page. A dotted trail winds from under the headline, beside every row,
// down to an anthill at the bottom of the page. Ants leave the hill, walk up to a row, pick up a
// crumb in that row's color, and carry it home, where it stays on the hill as a colored grain.
// The hill is kept in this browser, so it grows from visit to visit, and it stands on the ground of
// the next section, whose ants (Underground.vue) bring their crumbs to it too. Everything is drawn on one
// canvas behind the rows. The rows are two columns from 960px up, and the trail walks the gap
// between them; narrower screens have no gap to walk, so they get no ants and no hill.
//
// The canvas is not fixed to the window: the browser scrolls the page off the main thread, and a
// fixed canvas redrawn on the next frame trails behind the rows. It sits in the page instead, a
// band a little taller than the window. Every frame centers the band on the window and draws in
// page coordinates, so between frames the band scrolls with the rows.

// The hill in localStorage: { crumbs }, the latest crumbs carried home, which are the ones drawn.
// Every tab adds its own deliveries to what is stored.
const storageKey = "ant-lang.org/hill";
const maxCrumbs = 900;
const saveDelay = 2000;
// How far the band reaches past the window above and below, as a share of the window's height.
const overscan = 0.25;

const hillEl = ref<HTMLElement>();
const canvasEl = ref<HTMLCanvasElement>();

type Stop = { d: number; color: string | null };
type Crumb = [string, number, number]; // color, spread around the entrance, depth under the surface
type Ant = {
  d: number;
  dir: 1 | -1;
  speed: number;
  wob: number;
  wait: number;
  lane: number;
  crumb: string | null;
  target: number; // an index into stops
};

let landing: HTMLElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let bandTop = 0;
let bandHeight = 0;
let trail = new Trail([], 0);
let total = 0;
let dots: Point[] = [];
let stops: Stop[] = [];
let hill = { cx: 0, base: 0, w: 0, h: 0, ex: 0, ey: 0 };
let ground: HTMLCanvasElement | null = null;
let groundX = 0;
let groundY = 0;
let crumbs: Crumb[] = [];
let unsaved: Crumb[] = [];
let saveTimer = 0;
const ants: Ant[] = [];
let frame = 0;
let last = 0;
let observer: ResizeObserver | null = null;
let reduce = false;
let wide: MediaQueryList | null = null;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const isCrumb = (c: unknown): c is Crumb =>
  Array.isArray(c) &&
  c.length === 3 &&
  colors.includes(c[0]) &&
  Number.isFinite(c[1]) &&
  Math.abs(c[1]) <= 1 &&
  Number.isFinite(c[2]) &&
  c[2] >= 0 &&
  c[2] <= 1;

// What is stored, or an empty hill when nothing usable is.
function stored(): Crumb[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return Array.isArray(saved?.crumbs) ? saved.crumbs.filter(isCrumb).slice(-maxCrumbs) : [];
  } catch {
    return [];
  }
}

// Takes the stored hill, with this tab's unsaved deliveries on top.
function load() {
  crumbs = [...stored(), ...unsaved].slice(-maxCrumbs);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (unsaved.length === 0) return;
  const next = { crumbs: [...stored(), ...unsaved].slice(-maxCrumbs) };
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    unsaved = [];
    // Another tab's crumbs may have come in under these; draw the hill as stored.
    load();
    buildHill();
  } catch {
    // Without storage the hill still grows for this visit.
  }
}

// A crumb carried up out of the tunnel under the hill.
const onCrumb = (e: Event) => {
  const color = (e as CustomEvent<unknown>).detail;
  if (typeof color === "string" && colors.includes(color)) deliver(color);
};

// Another tab saved its crumbs.
const onStorage = (e: StorageEvent) => {
  if (e.key !== storageKey) return;
  load();
  buildHill();
};
const onHide = () => {
  if (document.visibilityState === "hidden") save();
};

// The trail, from the waypoints of the rows as they are laid out now.
function layout() {
  if (!landing || !hillEl.value || !wide?.matches) return;
  const r = landing.getBoundingClientRect();
  const rel = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { l: b.left - r.left, r: b.right - r.left, t: b.top - r.top, b: b.bottom - r.top };
  };
  const width = r.width;
  const room = rel(hillEl.value);
  const w = 230;
  const h = 128;
  // The hill stands on the bottom of its room, where the ground of the next section begins.
  const base = room.b;
  hill = { cx: width / 2, base, w, h, ex: width / 2, ey: base - h + 12 };

  const way: [number, number][] = [];
  const stopAt: [number, string][] = [];
  const hero = landing.querySelector(".hero");
  way.push([width / 2, hero ? rel(hero).b + 34 : 0]);
  landing.querySelectorAll("section.feature").forEach((section, i) => {
    const text = section.querySelector(":scope > .text");
    const shot = [...section.children].find((child) => child !== text);
    if (!text || !shot) return;
    const s = rel(section);
    const st = rel(shot);
    const tx = rel(text);
    const color = colors[i % colors.length];
    const gap = st.l < tx.l ? (st.r + tx.l) / 2 : (tx.r + st.l) / 2;
    way.push([gap, s.t - 44]);
    way.push([gap, (s.t + s.b) / 2]);
    stopAt.push([way.length - 1, color]);
    way.push([gap, s.b + 44]);
  });
  way.push([hill.ex + 40, hill.ey - 60]);
  way.push([hill.ex, hill.ey]);

  trail = new Trail(way, width);
  total = trail.total;
  // The top of the trail is a stop too: some ants just look around and come back empty.
  stops = [{ d: 0, color: null }, ...stopAt.map(([wi, color]) => ({ d: trail.to(wi), color }))];
  dots = [];
  for (let d = 0; d < total - 24; d += 7) dots.push(trail.at(d));
  for (const ant of ants) {
    ant.d = Math.min(ant.d, total);
    ant.target = Math.min(ant.target, stops.length - 1);
  }
  buildHill();
}

// The hill: grey grains lit from the upper left, drawn once on a canvas of its own.
const surface = (x: number) => hill.base - hill.h * Math.pow(Math.max(0, 1 - (x / hill.w) ** 2), 1.4);

function buildHill() {
  if (hill.w === 0) return;
  const spanX = hill.w * 1.4;
  groundX = hill.cx - spanX;
  groundY = hill.base - hill.h - 8;
  ground = document.createElement("canvas");
  ground.width = Math.ceil(spanX * 2 * dpr);
  ground.height = Math.ceil((hill.h + 20) * dpr);
  const g = ground.getContext("2d");
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, -groundX * dpr, -groundY * dpr);
  seed = 7;
  const grains = Math.round(hill.w * hill.h * 0.11);
  for (let i = 0; i < grains; i++) {
    const x = (rand() * 2 - 1) * hill.w;
    const top = surface(x);
    const y = top + Math.pow(rand(), 1.8) * (hill.base - top);
    const depth = (y - top) / Math.max(1, hill.base - top);
    const light = Math.max(0, Math.min(1, 0.5 - (x / hill.w) * 0.35 - depth * 0.3 + (rand() - 0.5) * 0.35));
    const v = Math.round(48 + light * 80);
    g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    const size = 0.9 + rand() * 1.2;
    g.fillRect(hill.cx + x, y, size, size);
  }
  for (let i = 0; i < 260; i++) {
    const x = (rand() * 2 - 1) * hill.w * 1.35;
    const v = Math.round(40 + rand() * 40);
    g.fillStyle = `rgb(${v},${v},${v - 4})`;
    g.fillRect(hill.cx + x, hill.base + rand() * 6 - 2, 1, 1);
  }
  for (const crumb of crumbs) placeCrumb(g, crumb);
}

function placeCrumb(g: CanvasRenderingContext2D, [color, spread, depth]: Crumb) {
  const x = spread * hill.w * 0.62;
  g.fillStyle = color;
  g.beginPath();
  g.arc(hill.cx + x, surface(x) + depth * 10 + 1, 1.15, 0, Math.PI * 2);
  g.fill();
}

// A crumb lands on the hill at once; it is stored a little later, with whatever else came in.
function deliver(color: string) {
  const spread = ((Math.random() + Math.random() + Math.random()) / 3) * 2 - 1;
  const crumb: Crumb = [color, Math.round(spread * 1000) / 1000, Math.round(Math.random() * 100) / 100];
  crumbs.push(crumb);
  unsaved.push(crumb);
  const g = ground?.getContext("2d");
  if (g) placeCrumb(g, crumb);
  if (!saveTimer) saveTimer = window.setTimeout(save, saveDelay);
}

// Most ants go to a row near the hill; a few walk all the way up.
function newTrip(ant: Ant) {
  const far = Math.floor(-Math.log(Math.random() + 1e-9) * 1.3);
  ant.target = Math.max(0, stops.length - 1 - far);
  ant.dir = -1;
  ant.crumb = null;
}

function makeAnts() {
  ants.length = 0;
  for (let i = 0; i < 30; i++) {
    const ant: Ant = {
      d: 0,
      dir: -1,
      speed: 0.028 + Math.random() * 0.016,
      wob: Math.random() * Math.PI * 2,
      wait: 0,
      lane: 0,
      crumb: null,
      target: 0,
    };
    newTrip(ant);
    // Scattered along the trail, so the page is alive from the start.
    const stop = stops[ant.target];
    ant.d = stop.d + Math.random() * (total - stop.d);
    if (Math.random() < 0.5) {
      ant.dir = 1;
      ant.crumb = stop.color;
    }
    ants.push(ant);
  }
}

// The band never reaches past the page, or the page would grow to hold it. Narrow screens hide
// the canvas, so it keeps its pixels only while it is shown.
function resizeCanvas() {
  const canvas = canvasEl.value;
  if (!canvas || !landing || !wide?.matches) return;
  dpr = window.devicePixelRatio || 1;
  const width = landing.clientWidth;
  bandHeight = Math.min(Math.round(window.innerHeight * (1 + 2 * overscan)), landing.clientHeight);
  const w = Math.round(width * dpr);
  const h = Math.round(bandHeight * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${bandHeight}px`;
}

// One frame. The ants walk on every frame while the page is wide enough to show them; with
// reduced motion they stand still, and the canvas is drawn again only when the page moves.
function schedule() {
  if (!frame && wide?.matches) frame = requestAnimationFrame(tick);
}

function tick(now: number) {
  frame = 0;
  const dt = Math.min(50, now - last);
  last = now;
  if (!reduce) schedule();
  const canvas = canvasEl.value;
  if (!ctx || !canvas || !landing || total === 0 || !wide?.matches) return;
  const r = landing.getBoundingClientRect();
  const view = -r.top - (bandHeight - window.innerHeight) / 2;
  const next = Math.round(Math.max(0, Math.min(landing.clientHeight - bandHeight, view)));
  if (next !== bandTop) {
    bandTop = next;
    canvas.style.transform = `translateY(${bandTop}px)`;
  }
  const top = bandTop - 20;
  const bottom = bandTop + bandHeight + 20;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, -bandTop * dpr);

  if (ground && groundY < bottom && groundY + hill.h + 20 > top) {
    ctx.drawImage(ground, groundX, groundY, ground.width / dpr, ground.height / dpr);
    const hole = ctx.createRadialGradient(hill.ex, hill.ey, 0, hill.ex, hill.ey, 11);
    hole.addColorStop(0, "#000");
    hole.addColorStop(0.7, "rgba(0, 0, 0, 0.9)");
    hole.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.ellipse(hill.ex, hill.ey + 1, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  for (const [x, y] of dots) {
    if (y < top || y > bottom) continue;
    ctx.moveTo(x + 0.9, y);
    ctx.arc(x, y, 0.9, 0, Math.PI * 2);
  }
  ctx.fill();

  for (const ant of ants) {
    // An ant waits inside the hill out of sight, and at a row in plain view.
    const waiting = ant.wait > 0;
    if (waiting) {
      if (!reduce) ant.wait -= dt;
      if (ant.d >= total) continue;
    }
    const p = trail.at(ant.d);
    const nx = -Math.sin(p[2]);
    const ny = Math.cos(p[2]);
    if (!reduce && !waiting) {
      const stop = stops[ant.target];
      ant.d += ant.dir * ant.speed * dt;
      ant.wob += dt * 0.022;
      if (ant.dir < 0 && ant.d <= stop.d) {
        ant.d = stop.d;
        ant.dir = 1;
        ant.crumb = stop.color;
        ant.wait = 400 + Math.random() * 900;
      } else if (ant.dir > 0 && ant.d >= total) {
        if (ant.crumb) deliver(ant.crumb);
        ant.d = total;
        ant.wait = 1500 + Math.random() * 6000;
        newTrip(ant);
        continue;
      }
    }
    if (p[1] < top || p[1] > bottom) continue;
    // Ants going up and ants coming home keep to their own side of the trail.
    ant.lane += ((ant.dir > 0 ? 3 : -3) - ant.lane) * 0.08;
    const side = ant.lane + Math.sin(ant.wob * 0.15) * 1.3;
    const heading = p[2] + (ant.dir < 0 ? Math.PI : 0);
    const alpha = Math.min(1, (total - ant.d) / 14 + 0.05);
    drawAnt(ctx, p[0] + nx * side, p[1] + ny * side, heading, ant.wob, ant.crumb, alpha);
  }
}

const onResize = () => {
  resizeCanvas();
  layout();
  schedule();
};
const onWide = () => {
  if (!wide?.matches) return;
  onResize();
  if (ants.length === 0) makeAnts();
  last = performance.now();
  schedule();
};

onMounted(() => {
  landing = hillEl.value?.closest(".landing") ?? null;
  ctx = canvasEl.value?.getContext("2d") ?? null;
  if (!landing || !ctx) return;
  reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  wide = matchMedia("(min-width: 960px)");
  wide.addEventListener("change", onWide);
  load();
  onWide();
  observer = new ResizeObserver(() => {
    resizeCanvas();
    layout();
    schedule();
  });
  observer.observe(landing);
  window.addEventListener("resize", onResize);
  window.addEventListener("storage", onStorage);
  window.addEventListener(crumbEvent, onCrumb);
  document.addEventListener("visibilitychange", onHide);
  if (reduce) window.addEventListener("scroll", schedule, { passive: true });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  frame = 0;
  save();
  observer?.disconnect();
  wide?.removeEventListener("change", onWide);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("storage", onStorage);
  window.removeEventListener(crumbEvent, onCrumb);
  document.removeEventListener("visibilitychange", onHide);
  window.removeEventListener("scroll", schedule);
});
</script>

<template>
  <div ref="hillEl" class="hill"></div>
  <canvas ref="canvasEl" class="trail" aria-hidden="true"></canvas>
</template>

<style scoped>
.hill {
  position: relative;
  height: 300px;
  margin-top: 72px;
}

/* Behind the rows: .landing isolates, so -1 stays above the page's own background. The script
   sizes the band and moves it down the page. */
.trail {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
  pointer-events: none;
}

@media (max-width: 959px) {
  .hill,
  .trail {
    display: none;
  }
}
</style>
