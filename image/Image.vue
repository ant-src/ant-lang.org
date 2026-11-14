<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import type { Ant, Diagnostic } from "@ant-lang/wasm";
import { examples } from "../playground/examples";
import { compileAnt, Runner } from "../playground/runner";
import { decode, encode, pack, unpack, validPath } from "../playground/share";
import { highlight, type Highlighted } from "./highlight";
import { backgrounds, sizes, themes, type SizeId } from "./presets";
import { draw, fontFamily, fontsReady, lineAt, type Layout, type OutputLine, type Scene } from "./render";

// What the image is made of, all of it kept in the reader's browser and in a shared link.
interface Settings {
  theme: string;
  background: string;
  seed: number;
  grain: number;
  padding: number;
  fontSize: number;
  lineNumbers: boolean;
  chrome: Scene["chrome"];
  title: string;
  size: SizeId;
  output: boolean;
  scale: number;
  highlight: number[];
}

interface Saved {
  code: string;
  modules: Record<string, string>;
  stdin: string;
  settings: Settings;
}

const storageKey = "ant-image";
const runTimeout = 4000;

const defaults: Settings = {
  theme: "ant-dark",
  background: "violet",
  seed: 7,
  grain: 30,
  padding: 64,
  fontSize: 16,
  lineNumbers: false,
  chrome: "mac",
  title: "main.ant",
  size: "auto",
  output: true,
  scale: 2,
  highlight: [],
};

const defaultCode = examples.find((e) => e.id === "pipes")?.files["main.ant"].trimEnd() ?? 'println("Hello, world")';
const code = ref(defaultCode);
// The other modules and the input of code opened from the playground: not drawn, but run.
const modules = ref<Record<string, string>>({});
const stdin = ref("");
const s = reactive<Settings>({ ...defaults });

const canvasEl = ref<HTMLCanvasElement>();
const stageEl = ref<HTMLElement>();
const tokens = shallowRef<Highlighted>();
const output = ref<OutputLine[]>([]);
const running = ref(false);
const diagnostics = ref<Diagnostic[]>([]);
const formatError = ref("");
const toast = ref("");
const fonts = ref(false);
let layoutNow: Layout | undefined;
let antReady: Promise<Ant> | undefined;
let runner: Runner | undefined;
let runnerReady: Promise<void> | undefined;
let runTimer: ReturnType<typeof setTimeout> | undefined;
let checkTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let runId = 0;
let observer: ResizeObserver | undefined;
let restored = false;
let unmounted = false;

const background = computed(() => backgrounds.find((b) => b.id === s.background) ?? backgrounds[0]);
const ratio = computed(() => sizes.find((z) => z.id === s.size)?.ratio ?? 0);
const lineCount = computed(() => code.value.split("\n").length);

function scene(): Scene | undefined {
  if (!tokens.value) return;
  return {
    code: tokens.value,
    output: s.output ? output.value : null,
    command: `$ ant run ${s.title || "main.ant"}`,
    background: background.value,
    seed: s.seed,
    grain: s.grain,
    padding: s.padding,
    fontSize: s.fontSize,
    lineNumbers: s.lineNumbers,
    chrome: s.chrome,
    title: s.title,
    highlight: new Set(s.highlight.filter((i) => i < lineCount.value)),
    ratio: ratio.value,
  };
}

// ---- drawing

function render() {
  const sc = scene();
  if (!sc || !canvasEl.value || !fonts.value) return;
  layoutNow = draw(canvasEl.value, sc, Math.min(window.devicePixelRatio || 1, 2));
  resize();
}

// resize fits the preview into the stage, never larger than the image itself.
function resize() {
  const stage = stageEl.value;
  if (!stage || !layoutNow || !canvasEl.value) return;
  const pad = 48;
  const f = Math.min(1, (stage.clientWidth - pad) / layoutNow.width, (stage.clientHeight - pad) / layoutNow.height);
  canvasEl.value.style.width = `${Math.max(0, layoutNow.width * f)}px`;
  canvasEl.value.style.height = `${Math.max(0, layoutNow.height * f)}px`;
}

let highlightId = 0;
watch(
  [code, () => s.theme],
  async () => {
    const id = ++highlightId;
    const t = await highlight(code.value, s.theme);
    if (id === highlightId) tokens.value = t;
  },
  { immediate: true },
);

// scene() reads everything the drawing uses, and not scale, which only the export uses.
watch(() => fonts.value && scene(), render);

function pick(e: MouseEvent) {
  if (!layoutNow || !canvasEl.value) return;
  const r = canvasEl.value.getBoundingClientRect();
  const i = lineAt(
    layoutNow,
    ((e.clientX - r.left) / r.width) * layoutNow.width,
    ((e.clientY - r.top) / r.height) * layoutNow.height,
  );
  if (i < 0) return;
  const at = s.highlight.indexOf(i);
  if (at >= 0) s.highlight.splice(at, 1);
  else s.highlight.push(i);
}

// ---- running

function ensureRunner(): Promise<void> {
  runnerReady ??= compileAnt().then(
    (module) =>
      new Promise<void>((resolve, reject) => {
        // The page may have gone while ant.wasm compiled: start no worker nothing would end.
        if (unmounted) return reject(new Error("the page is gone"));
        runner = new Runner(module, {
          ready: resolve,
          output: (stream, text) => onOutput(stream, text),
          done: () => finish(),
          failed: (message) => {
            onOutput("stderr", message);
            finish();
          },
          unavailable: (message) => reject(new Error(message)),
        });
      }),
  );
  // A load that failed, as on a network error, is tried again by the next run.
  runnerReady.catch(() => {
    runner?.dispose();
    runner = undefined;
    runnerReady = undefined;
  });
  return runnerReady;
}

let chunks: { stream: "stdout" | "stderr"; text: string }[] = [];
let finishRun: (() => void) | undefined;
let cancelRun: (() => void) | undefined;

function onOutput(stream: "stdout" | "stderr", text: string) {
  chunks.push({ stream, text });
}

function finish() {
  finishRun?.();
}

/** lines splits the run's output into lines, each colored by the stream that began it. */
function lines(): OutputLine[] {
  const out: OutputLine[] = [];
  let open: OutputLine | null = null;
  for (const c of chunks) {
    const parts = c.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) open = null;
      if (!open) {
        if (part === "" && i === parts.length - 1) return;
        open = { text: "", stderr: c.stream === "stderr" };
        out.push(open);
      }
      open.text += part.replace(/\t/g, "    ");
    });
  }
  return out;
}

async function run() {
  const id = ++runId;
  // A run still going ends: one worker runs one program at a time.
  if (cancelRun) {
    cancelRun();
    runner?.stop();
  }
  running.value = true;
  try {
    await ensureRunner();
  } catch (err) {
    running.value = false;
    output.value = [{ text: `Ant did not load: ${(err as Error).message}`, stderr: true }];
    return;
  }
  if (id !== runId) return;
  chunks = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = await new Promise<"done" | "timeout" | "cancelled">((resolve) => {
    finishRun = () => resolve("done");
    cancelRun = () => resolve("cancelled");
    timer = setTimeout(() => resolve("timeout"), runTimeout);
    runner!.run({ ...modules.value, "main.ant": code.value }, stdin.value);
  });
  clearTimeout(timer);
  finishRun = cancelRun = undefined;
  if (end === "cancelled") return;
  if (end === "timeout") {
    runner!.stop();
    const last = chunks.at(-1)?.text ?? "";
    const newline = last === "" || last.endsWith("\n") ? "" : "\n";
    chunks.push({ stream: "stderr", text: `${newline}stopped after ${runTimeout / 1000}s` });
  }
  output.value = lines();
  running.value = false;
}

function scheduleRun() {
  clearTimeout(runTimer);
  if (s.output) runTimer = setTimeout(run, 500);
}

watch(code, scheduleRun);
watch(
  () => s.output,
  (on) => on && run(),
);

// ---- format and check, on the page's own ant.wasm

function loadAntHere(): Promise<Ant> {
  antReady ??= (async () => {
    const { loadAnt } = await import("@ant-lang/wasm");
    return loadAnt({ wasm: await compileAnt() });
  })();
  antReady.catch(() => (antReady = undefined));
  return antReady;
}

async function format() {
  try {
    code.value = (await loadAntHere()).format(code.value).trimEnd();
    formatError.value = "";
  } catch (err) {
    formatError.value = String((err as Error).message ?? err);
  }
}

async function check() {
  try {
    diagnostics.value = (await loadAntHere()).check({
      files: { ...modules.value, "main.ant": code.value },
      path: "main.ant",
    });
  } catch {
    diagnostics.value = [];
  }
}

watch(code, () => {
  formatError.value = "";
  clearTimeout(checkTimer);
  checkTimer = setTimeout(check, 400);
});

// ---- export

function exportCanvas(): HTMLCanvasElement | null {
  const sc = scene();
  if (!sc) return null;
  const c = document.createElement("canvas");
  draw(c, sc, s.scale);
  return c;
}

const fileName = computed(() => `${(s.title || "ant").replace(/\.ant$/, "").replace(/[^\w.-]+/g, "-") || "ant"}.png`);

function savePng() {
  const c = exportCanvas();
  c?.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.value;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}

async function copyImage() {
  const c = exportCanvas();
  if (!c) return;
  try {
    // The promise goes to ClipboardItem as is: Safari allows the write only within the click.
    const blob = new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("no image")))),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    say("Image copied");
  } catch {
    say("This browser cannot copy images; use Save PNG");
  }
}

function saved(): Saved {
  return {
    code: code.value,
    modules: modules.value,
    stdin: stdin.value,
    settings: { ...s, highlight: [...s.highlight] },
  };
}

async function copyLink() {
  const url = `${location.origin}${location.pathname}#image=${await pack(saved())}`;
  try {
    await navigator.clipboard.writeText(url);
    say("Link copied");
  } catch {
    // The next edit takes it out again (see the saving watcher), so a reload keeps the edits.
    history.replaceState(null, "", url);
    say("Link in the address bar");
  }
}

async function openPlayground() {
  location.href = `/playground#code=${await encode({ files: { ...modules.value, "main.ant": code.value }, stdin: stdin.value })}`;
}

// reset starts over with the default code and settings, in place of what this browser kept.
function reset() {
  const changed =
    JSON.stringify(saved()) !== JSON.stringify({ code: defaultCode, modules: {}, stdin: "", settings: defaults });
  if (changed && !confirm("Reset the code and every setting?")) return;
  code.value = defaultCode;
  modules.value = {};
  stdin.value = "";
  Object.assign(s, { ...defaults, highlight: [] });
  formatError.value = "";
  history.replaceState(null, "", location.pathname);
  try {
    localStorage.removeItem(storageKey);
  } catch {}
  say("Reset");
}

function shuffle() {
  s.seed = Math.floor(Math.random() * 1e9);
}

function say(text: string) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 1800);
}

// ---- restoring

function apply(v: unknown) {
  if (typeof v !== "object" || v === null) return;
  const x = v as Partial<Saved>;
  if (typeof x.code === "string") code.value = x.code;
  if (typeof x.stdin === "string") stdin.value = x.stdin;
  if (x.modules && typeof x.modules === "object") {
    modules.value = Object.fromEntries(
      Object.entries(x.modules).filter(([p, src]) => validPath(p) && p !== "main.ant" && typeof src === "string"),
    );
  }
  if (x.settings && typeof x.settings === "object") {
    for (const key of Object.keys(defaults) as (keyof Settings)[]) {
      const value = x.settings[key];
      if (typeof value === typeof defaults[key] && Array.isArray(value) === Array.isArray(defaults[key])) {
        (s as Record<string, unknown>)[key] = value;
      }
    }
    sanitize();
  }
}

/** sanitize brings settings from a link or storage within what the controls can set. */
function sanitize() {
  const clamp = (n: number, lo: number, hi: number, d: number) =>
    Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
  s.fontSize = clamp(s.fontSize, 12, 24, defaults.fontSize);
  s.padding = clamp(s.padding, 16, 160, defaults.padding);
  s.grain = clamp(s.grain, 0, 100, defaults.grain);
  s.seed = clamp(s.seed, 0, 2 ** 31, defaults.seed);
  if (![1, 2, 4].includes(s.scale)) s.scale = defaults.scale;
  if (!themes.some((t) => t.id === s.theme)) s.theme = defaults.theme;
  if (!backgrounds.some((b) => b.id === s.background)) s.background = defaults.background;
  if (!sizes.some((z) => z.id === s.size)) s.size = defaults.size;
  if (!["mac", "tab", "none"].includes(s.chrome)) s.chrome = defaults.chrome;
  s.title = s.title.slice(0, 80);
  s.highlight = s.highlight.filter((n) => Number.isInteger(n) && n >= 0 && n < 10000);
}

async function restore() {
  // A link to an image wins, then code sent from the playground, then this browser's last image.
  const image = location.hash.match(/^#image=(.+)$/);
  const play = location.hash.match(/^#code=(.+)$/);
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) apply(JSON.parse(stored));
  } catch {}
  if (image) {
    try {
      apply(await unpack(image[1]));
    } catch {}
    history.replaceState(null, "", location.pathname);
  } else if (play) {
    const snapshot = await decode(play[1]);
    if (snapshot) {
      const { "main.ant": main, ...rest } = snapshot.files;
      code.value = main.trimEnd();
      modules.value = rest;
      stdin.value = snapshot.stdin;
      s.highlight = [];
    }
    history.replaceState(null, "", location.pathname);
  }
  restored = true;
}

watch(
  [code, modules, stdin, s],
  () => {
    if (!restored) return;
    if (location.hash.startsWith("#image=")) history.replaceState(null, "", location.pathname);
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved()));
    } catch {}
  },
  { deep: true },
);

onMounted(async () => {
  observer = new ResizeObserver(resize);
  if (stageEl.value) observer.observe(stageEl.value);
  await restore();
  await fontsReady();
  if (unmounted) return;
  fonts.value = true;
  start();
  window.addEventListener("hashchange", onHash);
});

// start runs and checks the restored code now, in place of the runs its watchers scheduled.
function start() {
  clearTimeout(runTimer);
  clearTimeout(checkTimer);
  if (s.output) run();
  check();
}

// A link pasted into a tab already on the page arrives as a new fragment.
async function onHash() {
  if (!/^#(image|code)=/.test(location.hash)) return;
  await restore();
  start();
}

onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener("hashchange", onHash);
  cancelRun?.();
  observer?.disconnect();
  runner?.dispose();
  clearTimeout(runTimer);
  clearTimeout(checkTimer);
  clearTimeout(toastTimer);
});

/** where is a diagnostic as shown: main.ant's by line and column, another module's with its path. */
function where(d: Diagnostic): string {
  return `${d.path === "main.ant" ? "" : `${d.path}:`}${d.line}:${d.column}: ${d.message}`;
}

function onKey(e: KeyboardEvent) {
  // Tab indents in the code box instead of leaving it.
  if (e.key !== "Tab" || e.shiftKey) return;
  e.preventDefault();
  const t = e.target as HTMLTextAreaElement;
  t.setRangeText("  ", t.selectionStart, t.selectionEnd, "end");
  code.value = t.value;
}
</script>

<template>
  <div class="image-page">
    <aside class="panel">
      <section class="group code-group">
        <div class="row head">
          <h2>Code</h2>
          <button type="button" class="link" title="Format as ant fmt does" @click="format">Format</button>
        </div>
        <textarea
          v-model="code"
          class="code"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          :style="{ fontFamily }"
          @keydown="onKey"
        />
        <p v-if="formatError" class="problem">{{ formatError }}</p>
        <p v-else-if="diagnostics.length" class="problem" :title="diagnostics.map(where).join('\n')">
          {{ where(diagnostics[0]) }}
          <span v-if="diagnostics.length > 1">(+{{ diagnostics.length - 1 }} more)</span>
        </p>
        <p v-else class="ok">
          Checks clean{{ Object.keys(modules).length ? ` · with ${Object.keys(modules).join(", ")}` : "" }}
        </p>
      </section>

      <section class="group">
        <h2>Theme</h2>
        <select v-model="s.theme" class="select">
          <option v-for="t in themes" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </section>

      <section class="group">
        <div class="row head">
          <h2>Background</h2>
          <button type="button" class="link" title="Move the colors around" @click="shuffle">Shuffle</button>
        </div>
        <div class="swatches">
          <button
            v-for="b in backgrounds"
            :key="b.id"
            type="button"
            class="swatch"
            :class="{ on: b.id === s.background }"
            :title="b.name"
            :aria-label="b.name"
            :style="{ background: b.swatch }"
            @click="s.background = b.id"
          />
        </div>
        <label class="slider">
          <span
            >Grain <b>{{ s.grain }}</b></span
          >
          <input v-model.number="s.grain" type="range" min="0" max="100" step="5" />
        </label>
      </section>

      <section class="group">
        <h2>Window</h2>
        <div class="segmented">
          <button
            v-for="c in ['mac', 'tab', 'none'] as const"
            :key="c"
            type="button"
            :class="{ on: s.chrome === c }"
            @click="s.chrome = c"
          >
            {{ c === "mac" ? "Title" : c === "tab" ? "Tab" : "None" }}
          </button>
        </div>
        <input v-if="s.chrome !== 'none'" v-model="s.title" class="text" placeholder="main.ant" spellcheck="false" />
        <label class="check"><input v-model="s.lineNumbers" type="checkbox" /> Line numbers</label>
        <label class="check">
          <input v-model="s.output" type="checkbox" /> Show output
          <span v-if="running" class="dim">running…</span>
          <button v-else-if="s.output" type="button" class="link" @click="run">Run again</button>
        </label>
        <label class="slider">
          <span
            >Font size <b>{{ s.fontSize }}</b></span
          >
          <input v-model.number="s.fontSize" type="range" min="12" max="24" step="1" />
        </label>
        <label class="slider">
          <span
            >Padding <b>{{ s.padding }}</b></span
          >
          <input v-model.number="s.padding" type="range" min="16" max="160" step="8" />
        </label>
      </section>

      <section class="group">
        <h2>Size</h2>
        <div class="segmented">
          <button v-for="z in sizes" :key="z.id" type="button" :class="{ on: s.size === z.id }" @click="s.size = z.id">
            {{ z.name }}
          </button>
        </div>
      </section>

      <section class="group">
        <button type="button" class="button reset" title="Start over with the default code and settings" @click="reset">
          Reset everything
        </button>
      </section>
    </aside>

    <main class="stage-wrap">
      <div ref="stageEl" class="stage">
        <canvas ref="canvasEl" class="preview" @click="pick" />
      </div>
      <footer class="bar">
        <span class="hint">
          Click lines to highlight them<template v-if="s.highlight.length">
            · <button type="button" class="link" @click="s.highlight = []">clear</button></template
          >
        </span>
        <div class="actions">
          <div class="segmented small">
            <button v-for="n in [1, 2, 4]" :key="n" type="button" :class="{ on: s.scale === n }" @click="s.scale = n">
              {{ n }}×
            </button>
          </div>
          <button type="button" class="button" @click="openPlayground">Open in Playground</button>
          <button type="button" class="button" @click="copyLink">Copy link</button>
          <button type="button" class="button" @click="copyImage">Copy image</button>
          <button type="button" class="button primary" @click="savePng">Save PNG</button>
        </div>
      </footer>
      <Transition name="fade">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.image-page {
  display: grid;
  grid-template-columns: 340px 1fr;
  height: calc(100vh - var(--vp-nav-height));
  height: calc(100dvh - var(--vp-nav-height));
  background: var(--vp-c-bg);
}

.panel {
  overflow-y: auto;
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  padding: 8px 0 24px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.group:last-child {
  border-bottom: none;
}

h2 {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  line-height: 1;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre;
  tab-size: 4;
}

.code:focus,
.text:focus,
.select:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.problem,
.ok {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.problem {
  color: var(--vp-c-danger-1);
}

.ok {
  color: var(--vp-c-text-3);
}

.select,
.text {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
}

.select {
  appearance: none;
  cursor: pointer;
  background: var(--vp-c-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%23888' stroke-width='1.5' d='m1 1 4 4 4-4'/%3E%3C/svg%3E")
    no-repeat right 11px center;
}

.text {
  font-family: var(--vp-font-family-mono);
}

.swatches {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.swatch {
  aspect-ratio: 1;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.3);
  transition: transform 0.1s;
}

.swatch:hover {
  transform: scale(1.06);
}

.swatch.on {
  box-shadow:
    0 0 0 2px var(--vp-c-bg-alt),
    0 0 0 4px var(--vp-c-brand-1);
}

.segmented {
  display: flex;
  padding: 2px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.segmented button {
  flex: 1;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.segmented button:hover {
  color: var(--vp-c-text-1);
}

.segmented button.on {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.segmented.small button {
  padding: 4px 9px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--vp-c-text-1);
  cursor: pointer;
}

.check input {
  accent-color: var(--vp-c-brand-1);
}

.slider {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.slider b {
  font-weight: 500;
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
}

.slider input {
  accent-color: var(--vp-c-brand-1);
}

.link {
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.link:hover {
  text-decoration: underline;
}

.dim {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.stage-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle, var(--vp-c-divider) 1px, transparent 1.5px) 0 0 / 20px 20px,
    var(--vp-c-bg);
}

.preview {
  display: block;
  cursor: pointer;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}

.hint {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.button {
  padding: 5px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  white-space: nowrap;
}

.button:hover {
  border-color: var(--vp-c-brand-1);
}

.button.reset {
  width: 100%;
  padding: 7px 12px;
  color: var(--vp-c-text-2);
}

.button.reset:hover {
  border-color: var(--vp-c-danger-1);
  color: var(--vp-c-danger-1);
}

.button.primary {
  border-color: transparent;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}

.button.primary:hover {
  background: var(--vp-c-brand-2);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  font-size: 13px;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 860px) {
  .image-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    height: auto;
  }

  .panel {
    order: 2;
    border-right: none;
    overflow: visible;
  }

  .stage-wrap {
    order: 1;
  }

  .stage {
    height: 60vh;
    flex: none;
  }
}
</style>
