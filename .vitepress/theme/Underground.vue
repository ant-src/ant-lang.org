<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { colors, crumbEvent, drawAnt, Trail, type Point } from "./ants";

// The second part of the home page, under the anthill: the ground the hill stands on, with the
// tools of the language in chambers dug into it. One tunnel runs from under the hill down through
// every chamber, in the order they are read. Ants walk down it to a chamber, pick up a crumb in
// that chamber's color, and carry it up to the hill (AntTrail.vue), where it stays with the
// crumbs from the rows above. Like the trail, the tunnel and its ants are for screens 960px and
// up; narrower ones get the ground and the chambers one under another.
//
// The canvas is a band a little taller than the window that every frame centers on the window and
// draws in the section's coordinates, as AntTrail.vue explains.

const overscan = 0.25;

const rootEl = ref<HTMLElement>();
const canvasEl = ref<HTMLCanvasElement>();

type Stop = { d: number; color: string };
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

let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let bandTop = 0;
let bandHeight = 0;
let trail = new Trail([], 0);
let dots: Point[] = [];
let stops: Stop[] = [];
let grains: [number, number, number][] = []; // x, y, and grey: the ground line under the hill
const ants: Ant[] = [];
let frame = 0;
let last = 0;
let observer: ResizeObserver | null = null;
let reduce = false;
let wide: MediaQueryList | null = null;

// The tunnel, from the chambers as they are laid out now. It leaves the middle of the top edge,
// under the hill, bends around the left of the opening words, and passes through the middle of
// each chamber. Between two chambers side by side it dips under both; between one row and the
// next it crosses the gap halfway.
function layout() {
  const root = rootEl.value;
  if (!root || !wide?.matches) return;
  const r = root.getBoundingClientRect();
  const rel = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { l: b.left - r.left, r: b.right - r.left, t: b.top - r.top, b: b.bottom - r.top };
  };
  const width = r.width;
  const way: [number, number][] = [[width / 2, 0]];
  const opening = root.querySelector(".opening");
  if (opening) {
    const o = rel(opening);
    way.push([width / 2, o.t * 0.6]);
    way.push([o.l + 20, (o.t + o.b) / 2]);
  }
  const at: number[] = [];
  let prev: ReturnType<typeof rel> | null = null;
  for (const chamber of root.querySelectorAll(".chamber")) {
    const c = rel(chamber);
    if (prev) {
      const side = c.t < prev.b && prev.t < c.b;
      way.push(
        side
          ? [(prev.l + prev.r + c.l + c.r) / 4, Math.max(prev.b, c.b) + 56]
          : [(prev.l + prev.r + c.l + c.r) / 4, (prev.b + c.t) / 2],
      );
    }
    way.push([(c.l + c.r) / 2, (c.t + c.b) / 2]);
    at.push(way.length - 1);
    prev = c;
  }
  trail = new Trail(way, width);
  stops = at.map((wi, i) => ({ d: trail.to(wi), color: colors[i % colors.length] }));
  dots = [];
  for (let d = 4; d < trail.total; d += 7) dots.push(trail.at(d));
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  grains = [];
  for (let i = 0; i < width * 1.2; i++) grains.push([rand() * width, Math.pow(rand(), 2) * 10, 40 + rand() * 50]);
  for (const ant of ants) {
    ant.d = Math.min(ant.d, trail.total);
    ant.target = Math.min(ant.target, stops.length - 1);
  }
}

function newTrip(ant: Ant) {
  ant.target = Math.floor(Math.random() * stops.length);
  ant.dir = 1;
  ant.crumb = null;
}

function makeAnts() {
  ants.length = 0;
  if (stops.length === 0) return;
  for (let i = 0; i < 18; i++) {
    const ant: Ant = {
      d: 0,
      dir: 1,
      speed: 0.028 + Math.random() * 0.016,
      wob: Math.random() * Math.PI * 2,
      wait: 0,
      lane: 0,
      crumb: null,
      target: 0,
    };
    newTrip(ant);
    // Scattered along the tunnel, so the ground is alive from the start.
    const stop = stops[ant.target];
    ant.d = Math.random() * stop.d;
    if (Math.random() < 0.5) {
      ant.dir = -1;
      ant.crumb = stop.color;
    }
    ants.push(ant);
  }
}

// The band never reaches past the section. Narrow screens hide the canvas, so it keeps its pixels
// only while it is shown.
function resizeCanvas() {
  const canvas = canvasEl.value;
  const root = rootEl.value;
  if (!canvas || !root || !wide?.matches) return;
  dpr = window.devicePixelRatio || 1;
  const width = root.clientWidth;
  bandHeight = Math.min(Math.round(window.innerHeight * (1 + 2 * overscan)), root.clientHeight);
  const w = Math.round(width * dpr);
  const h = Math.round(bandHeight * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${bandHeight}px`;
}

function schedule() {
  if (!frame && wide?.matches) frame = requestAnimationFrame(tick);
}

function tick(now: number) {
  frame = 0;
  const dt = Math.min(50, now - last);
  last = now;
  if (!reduce) schedule();
  const canvas = canvasEl.value;
  const root = rootEl.value;
  if (!ctx || !canvas || !root || trail.total === 0 || !wide?.matches) return;

  for (const ant of ants) step(ant, dt);

  const r = root.getBoundingClientRect();
  // Above or below the window, the ants walk on unseen.
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  const view = -r.top - (bandHeight - window.innerHeight) / 2;
  const next = Math.round(Math.max(0, Math.min(root.clientHeight - bandHeight, view)));
  if (next !== bandTop) {
    bandTop = next;
    canvas.style.transform = `translateY(${bandTop}px)`;
  }
  const top = bandTop - 40;
  const bottom = bandTop + bandHeight + 40;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, -bandTop * dpr);

  if (top < 12) {
    for (const [x, y, v] of grains) {
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // The tunnel: a faint lit edge, the dark of the tunnel, and the trail down its middle.
  ctx.beginPath();
  let open = false;
  for (const [x, y] of trail.pts) {
    if (y < top || y > bottom) {
      open = false;
      continue;
    }
    if (open) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    open = true;
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 214, 170, 0.045)";
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.strokeStyle = "rgba(6, 4, 3, 0.9)";
  ctx.lineWidth = 24;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 235, 210, 0.13)";
  ctx.beginPath();
  for (const [x, y] of dots) {
    if (y < top || y > bottom) continue;
    ctx.moveTo(x + 0.9, y);
    ctx.arc(x, y, 0.9, 0, Math.PI * 2);
  }
  ctx.fill();

  for (const ant of ants) {
    // An ant waits in the hill out of sight, and in a chamber under it.
    if (ant.wait > 0 || ant.d <= 0) continue;
    const p = trail.at(ant.d);
    if (p[1] < top || p[1] > bottom) continue;
    // Ants going down and ants coming up keep to their own side of the tunnel.
    ant.lane += ((ant.dir > 0 ? 3 : -3) - ant.lane) * 0.08;
    const side = ant.lane + Math.sin(ant.wob * 0.15) * 1.3;
    const nx = -Math.sin(p[2]);
    const ny = Math.cos(p[2]);
    const heading = p[2] + (ant.dir < 0 ? Math.PI : 0);
    drawAnt(ctx, p[0] + nx * side, p[1] + ny * side, heading, ant.wob, ant.crumb, Math.min(1, ant.d / 14 + 0.05));
  }
}

function step(ant: Ant, dt: number) {
  if (reduce) return;
  if (ant.wait > 0) {
    ant.wait -= dt;
    return;
  }
  const stop = stops[ant.target];
  ant.d += ant.dir * ant.speed * dt;
  ant.wob += dt * 0.022;
  if (ant.dir > 0 && ant.d >= stop.d) {
    ant.d = stop.d;
    ant.dir = -1;
    ant.crumb = stop.color;
    ant.wait = 400 + Math.random() * 900;
  } else if (ant.dir < 0 && ant.d <= 0) {
    if (ant.crumb) window.dispatchEvent(new CustomEvent(crumbEvent, { detail: ant.crumb }));
    ant.d = 0;
    ant.wait = 1500 + Math.random() * 6000;
    newTrip(ant);
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
  ctx = canvasEl.value?.getContext("2d") ?? null;
  if (!rootEl.value || !ctx) return;
  reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  wide = matchMedia("(min-width: 960px)");
  wide.addEventListener("change", onWide);
  onWide();
  // The chambers move as fonts load and videos size themselves.
  observer = new ResizeObserver(onResize);
  observer.observe(rootEl.value);
  window.addEventListener("resize", onResize);
  if (reduce) window.addEventListener("scroll", schedule, { passive: true });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  frame = 0;
  observer?.disconnect();
  wide?.removeEventListener("change", onWide);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("scroll", schedule);
});
</script>

<template>
  <section ref="rootEl" class="underground">
    <canvas ref="canvasEl" class="tunnel" aria-hidden="true"></canvas>
    <div class="landing">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/* Behind the chambers: the section isolates, so -1 stays above the ground's own background. */
.tunnel {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
  pointer-events: none;
}

@media (max-width: 959px) {
  .tunnel {
    display: none;
  }
}
</style>
