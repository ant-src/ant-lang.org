<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useData } from "vitepress";
import type * as Monaco from "monaco-editor/editor";
import type { AntLanguageServer } from "@ant-lang/monaco";
import { examples, type Example } from "./examples";
import { decode, encode, type Snapshot } from "./share";

type EditorModule = typeof import("./editor");
type Status = "loading" | "ready" | "running" | "failed";
type Part = { text: string } | { text: string; line: number; column: number };
interface Chunk {
  stream: "stdout" | "stderr" | "note";
  text: string;
  parts: Part[]; // the text, with positions in the code as links
}

const storageKey = "ant-playground";
// What a first visit opens with: one line to run, and room to write.
const starter = 'println("Hello, Ant!")\n';
// Output past the limit stops the run: a program printing forever would otherwise flood the page.
const outputLimit = 1 << 20;
// A chunk grows to this size, so linking positions on each append costs little.
const chunkSize = 1 << 16;
// The editor is as tall as its code, between this and what the window leaves it.
const minHeight = 360;
const mod = shallowRef<EditorModule>();
const { isDark } = useData();

const editorEl = ref<HTMLElement>();
const editorHeight = ref(minHeight);
const chunks = ref<Chunk[]>([]);
const status = ref<Status>("loading");
const loadError = ref("");
const exitCode = ref<number | null>(null);
const ran = ref(false); // a run has started, so the output has something to show
const queued = ref(false); // Run was pressed before Ant was ready
const copied = ref("");
const exampleId = ref("");

let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
let server: AntLanguageServer | undefined;
let runner: InstanceType<EditorModule["Runner"]> | undefined;
// The page edits main.ant. A link shared from the older playground may carry more modules and an
// input: they are kept and run with the code, unseen, until the code is replaced.
let modules: Record<string, string> = {};
let stdin = "";
// pristine is the code as it was opened, so picking an example replaces it without asking;
// any other code, restored or shared, is asked about.
let pristine: string | null = null;
// fromHash says the code is a shared link not yet edited, which is not saved over the reader's own.
let fromHash = false;
let loaded = false; // the code is in the editor, so there is something to save
let unmounted = false;
let lspReady = false;
let runnerReady = false;
let pendingOutput: { stream: Chunk["stream"]; text: string }[] = [];
let outputSize = 0;
let flushFrame = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
const disposables: Monaco.IDisposable[] = [];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const runKeys = isMac ? "⌘↵" : "Ctrl+Enter";
const busy = computed(() => status.value === "running" || queued.value);

// ---- the code

const uriOf = (path: string) => mod.value!.monaco.Uri.parse(`file:///${path}`);
const modelOf = (path: string) => mod.value!.monaco.editor.getModel(uriOf(path));
const code = () => modelOf("main.ant")?.getValue() ?? "";

function snapshot(): Snapshot {
  return { files: { ...modules, "main.ant": code() }, stdin };
}

function load(s: Snapshot) {
  const { monaco } = mod.value!;
  for (const path of ["main.ant", ...Object.keys(modules)]) modelOf(path)?.dispose();
  const { "main.ant": main, ...rest } = s.files;
  modules = rest;
  stdin = s.stdin;
  // The other modules get models too, so the language server resolves the imports of main.ant.
  for (const [path, text] of Object.entries(rest)) monaco.editor.createModel(text, "ant", uriOf(path));
  const model = monaco.editor.createModel(main, "ant", uriOf("main.ant"));
  disposables.push(model.onDidChangeContent(changed));
  editor!.setModel(model);
  pristine = null;
  loaded = true;
}

// open replaces the code with code of the playground's own, which is replaced again without asking.
function open(text: string) {
  load({ files: { "main.ant": text }, stdin: "" });
  pristine = text;
  clearOutput();
  ran.value = false;
  save();
  const model = editor!.getModel()!;
  editor!.setPosition({ lineNumber: model.getLineCount(), column: model.getLineMaxColumn(model.getLineCount()) });
  editor!.focus();
}

function changed() {
  // An edit makes the page the reader's own: a reload restores it from storage, not the link.
  own();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function own() {
  if (!fromHash) return;
  fromHash = false;
  history.replaceState(null, "", location.pathname + location.search);
}

function save() {
  if (!loaded || fromHash) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot()));
  } catch {
    // Storage may be full or blocked; the playground works without it.
  }
}

function restore(): Snapshot | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (typeof saved?.files?.["main.ant"] === "string") return { files: saved.files, stdin: saved.stdin ?? "" };
  } catch {
    // Unreadable storage is the same as none.
  }
  return null;
}

// ---- examples

function pick(id: string) {
  exampleId.value = "";
  const example: Example | undefined = examples.find((e) => e.id === id);
  if (!example && id !== "clear") return;
  const mine = code() !== pristine && code().trim() !== "";
  const question = example ? `Replace your code with “${example.title}”?` : "Clear your code?";
  if (mine && !confirm(question)) return;
  own();
  open(example?.code ?? "");
  if (example) run();
}

// ---- running

function run() {
  if (status.value === "failed") return;
  // Before Ant is ready, the run waits for it.
  if (!runner || status.value === "loading") {
    queued.value = true;
    return;
  }
  if (status.value === "running") restart();
  queued.value = false;
  clearOutput();
  ran.value = true;
  status.value = "running";
  runner.run(snapshot().files, stdin);
}

function stop(message = "Stopped.") {
  if (queued.value) {
    queued.value = false;
    return;
  }
  if (status.value !== "running" || !runner) return;
  restart();
  status.value = "loading";
  note(message);
}

// restart replaces the run worker, ending whatever it runs.
function restart() {
  runnerReady = false;
  runner!.stop();
}

function clearOutput() {
  cancelAnimationFrame(flushFrame);
  flushFrame = 0;
  pendingOutput = [];
  outputSize = 0;
  chunks.value = [];
  exitCode.value = null;
}

// output collects what the program writes and shows it once a frame, however often it writes.
function output(stream: Chunk["stream"], text: string) {
  if (outputSize >= outputLimit) return;
  outputSize += text.length;
  pendingOutput.push({ stream, text });
  if (outputSize >= outputLimit) {
    stop(`Stopped: the output passed ${outputLimit >> 20} MB.`);
    return;
  }
  flushFrame ||= requestAnimationFrame(flushOutput);
}

function flushOutput() {
  flushFrame = 0;
  const pending = pendingOutput;
  pendingOutput = [];
  for (const { stream, text } of pending) {
    const last = chunks.value[chunks.value.length - 1];
    if (last?.stream === stream && last.text.length < chunkSize) {
      last.text += text;
      last.parts = segments(last.text);
    } else {
      chunks.value.push({ stream, text, parts: segments(text) });
    }
  }
}

// note adds the playground's own word to the output, past any limit.
function note(text: string) {
  flushOutput();
  const last = chunks.value[chunks.value.length - 1];
  const line = (last && !last.text.endsWith("\n") ? "\n" : "") + text;
  chunks.value.push({ stream: "note", text: line, parts: [{ text: line }] });
}

// The output links positions such as main.ant:3:5 to the editor.
const positionPattern = /\bmain\.ant:(\d+):(\d+)/g;

function segments(text: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(positionPattern)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], line: Number(m[1]), column: Number(m[2]) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function reveal(line: number, column: number) {
  const position = { lineNumber: line, column };
  editor?.setPosition(position);
  editor?.revealPositionInCenter(position);
  editor?.focus();
}

// ---- the bar

async function format() {
  await editor?.getAction("editor.action.formatDocument")?.run();
}

async function share() {
  const url = `${location.origin}${location.pathname}#code=${await encode(snapshot())}`;
  history.replaceState(null, "", url);
  fromHash = true;
  try {
    await navigator.clipboard.writeText(url);
    copied.value = "Link copied";
  } catch {
    copied.value = "Link in the address bar";
  }
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = ""), 1800);
}

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    run();
  } else if (e.key === "Escape" && busy.value && !editorEl.value?.contains(e.target as Node)) {
    // In the editor, Escape closes completions and hovers; there the Stop button stops.
    stop();
  }
}

// A shared link opened in a tab already on the playground arrives as a new fragment.
async function onHash() {
  const hash = location.hash.match(/^#code=(.+)$/);
  if (!hash || !loaded) return;
  const shared = await decode(hash[1]);
  if (!shared || unmounted) return;
  clearTimeout(saveTimer);
  save(); // the reader's own code, before the link replaces it on screen
  fromHash = true;
  load(shared);
  clearOutput();
  ran.value = false;
}

// fit makes the editor as tall as its code, so the page scrolls rather than the editor, up to
// a height that keeps Run and the output in the window.
function fit() {
  if (!editor) return;
  const max = Math.max(minHeight, window.innerHeight - 320);
  editorHeight.value = Math.min(Math.max(editor.getContentHeight(), minHeight), max);
}

// ---- lifecycle

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", onHash);
  window.addEventListener("resize", fit);
  // Each await may end with the page gone; onBeforeUnmount has then cleaned up what existed.
  const m = await import("./editor");
  if (unmounted) return;
  mod.value = m;
  const { monaco } = m;

  editor = monaco.editor.create(editorEl.value!, {
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "var(--vp-font-family-mono)",
    tabSize: 2,
    padding: { top: 16, bottom: 16 },
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    // The wheel scrolls the page once the editor has nothing left to scroll.
    scrollbar: { alwaysConsumeMouseWheel: false },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    renderLineHighlight: "none",
    "semanticHighlighting.enabled": true,
    // Inferred types show while Ctrl+Alt is held, so they do not crowd code being learned.
    inlayHints: { enabled: "offUnlessPressed" },
    bracketPairColorization: { enabled: false },
    wordWrap: matchMedia("(max-width: 768px)").matches ? "on" : "off",
    fixedOverflowWidgets: true,
    theme: isDark.value ? "ant-dark" : "ant-light",
  });
  // Commit Mono is a web font: once it has loaded, Monaco measures its glyphs again, so the cursor
  // and selections line up with the text that swapped in.
  document.fonts.ready.then(() => monaco.editor.remeasureFonts());
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, format);
  disposables.push(
    editor.onDidContentSizeChange(fit),
    // A definition in main.ant is a jump within the editor; one in a module unseen is no jump.
    monaco.editor.registerEditorOpener({
      openCodeEditor(_source, uri, selection) {
        if (uri.scheme !== "file" || uri.path !== "/main.ant") return false;
        if (selection && "startLineNumber" in selection) {
          editor!.setSelection(selection);
          editor!.revealRangeInCenter(selection);
        } else if (selection) {
          editor!.setPosition(selection);
          editor!.revealPositionInCenter(selection);
        }
        return true;
      },
    }),
  );

  const hash = location.hash.match(/^#code=(.+)$/);
  const shared = hash ? await decode(hash[1]) : null;
  if (unmounted) return;
  const saved = shared ? null : restore();
  if (shared) {
    fromHash = true;
    load(shared);
  } else if (saved) {
    load(saved);
  } else {
    open(starter);
    run(); // a first visit shows what running looks like
  }
  editor.focus();

  let module: WebAssembly.Module;
  try {
    module = await m.compileAnt();
  } catch (err) {
    return fail(err);
  }
  if (unmounted) return;
  server = m.startLanguageServer(module, (line) => console.debug("ant lsp:", line));
  server.ready.then(() => {
    lspReady = true;
    becomeReady();
  }, fail);
  runner = new m.Runner(module, {
    ready() {
      runnerReady = true;
      becomeReady();
    },
    output,
    done(code) {
      flushOutput();
      status.value = "ready";
      exitCode.value = code;
    },
    failed(message) {
      status.value = "ready";
      note(message);
      exitCode.value = 1;
    },
    unavailable: fail,
  });
});

// becomeReady leaves loading once both workers are up, at the start and after each Stop.
function becomeReady() {
  if (!lspReady || !runnerReady || status.value !== "loading") return;
  status.value = "ready";
  if (queued.value) run();
}

function fail(err: unknown) {
  status.value = "failed";
  queued.value = false;
  loadError.value = String((err as Error)?.message ?? err);
}

watch(isDark, (dark) => mod.value?.monaco.editor.setTheme(dark ? "ant-dark" : "ant-light"));

onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("hashchange", onHash);
  window.removeEventListener("resize", fit);
  clearTimeout(saveTimer);
  clearTimeout(copiedTimer);
  cancelAnimationFrame(flushFrame);
  save();
  for (const d of disposables.splice(0)) d.dispose();
  server?.dispose();
  runner?.dispose();
  if (mod.value) for (const path of ["main.ant", ...Object.keys(modules)]) modelOf(path)?.dispose();
  editor?.dispose();
});
</script>

<template>
  <div class="playground">
    <div class="card">
      <select v-model="exampleId" class="examples" aria-label="Examples" @change="pick(exampleId)">
        <option value="" disabled>Examples</option>
        <option v-for="e in examples" :key="e.id" :value="e.id">{{ e.title }}</option>
        <hr />
        <option value="clear">Clear the editor</option>
      </select>

      <div ref="editorEl" class="editor" :style="{ height: `${editorHeight}px` }" />

      <div class="bar">
        <button type="button" class="share" title="Copy a link to this code" @click="share">
          {{ copied || "Copy link" }}
        </button>
        <!-- One button that keeps its size, so the bar does not move as a run starts and ends. -->
        <button
          type="button"
          class="run"
          :class="{ stop: busy }"
          :disabled="status === 'failed'"
          :title="busy ? 'Stop (Esc)' : `Run (${runKeys})`"
          @click="busy ? stop() : run()"
        >
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <rect v-if="busy" x="3" y="3" width="10" height="10" rx="1.5" />
            <path v-else d="M4.5 2.6v10.8a1 1 0 0 0 1.5.86l8.6-5.4a1 1 0 0 0 0-1.72L6 1.74a1 1 0 0 0-1.5.86Z" />
          </svg>
          {{ busy ? "Stop" : "Run" }}
          <span v-if="!busy" class="keys">{{ runKeys }}</span>
        </button>
      </div>

      <section v-if="ran || status === 'failed'" class="output" aria-label="Output" aria-live="polite">
        <p v-if="status === 'failed'" class="stderr">Ant could not load: {{ loadError }}</p>
        <template v-else>
          <pre><template v-for="(c, i) in chunks" :key="i"><span :class="c.stream"><template v-for="(s, j) in c.parts" :key="j"><a
            v-if="'line' in s"
            href="#"
            @click.prevent="reveal(s.line, s.column)"
          >{{ s.text }}</a><template v-else>{{ s.text }}</template></template></span></template><span v-if="exitCode !== null && !chunks.length" class="note">(no output)</span></pre>
          <span v-if="exitCode" class="exit">exit {{ exitCode }}</span>
        </template>
      </section>
    </div>

    <p class="more">
      Want more files or a debugger?
      <a href="https://editor.ant-lang.org">Open Ant Editor →</a>
    </p>
  </div>
</template>

<style scoped>
.playground {
  --border: var(--vp-c-divider);
  min-height: calc(100vh - var(--vp-nav-height));
  min-height: calc(100dvh - var(--vp-nav-height));
  padding: 32px 16px;
  background: var(--vp-c-bg-alt);
}

.card {
  position: relative;
  max-width: 880px;
  margin: 0 auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

/* Examples sit in the editor's corner, out of the way of code being written. */
.examples {
  position: absolute;
  top: 8px;
  right: 20px; /* clear of the editor's scrollbar */
  z-index: 5;
  appearance: none;
  width: 104px; /* fits "Examples", not the longest title in the list */
  border-radius: 8px;
  padding: 6px 28px 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%23888' stroke-width='1.5' d='m1 1 4 4 4-4'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  cursor: pointer;
}

.examples:hover,
.examples:focus-visible {
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-default-soft);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 10px 20px;
  border-top: 1px solid var(--border);
}

.share {
  padding: 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.share:hover {
  color: var(--vp-c-text-1);
}

/* Run is the site's brand button, solid and calm; Stop is a plain button with a red square. */
.run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 120px;
  min-height: 40px;
  padding: 0 18px;
  border: 1px solid var(--vp-button-brand-border);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  white-space: nowrap;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.run:hover {
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
  background: var(--vp-button-brand-hover-bg);
}

.run:active {
  background: var(--vp-button-brand-active-bg);
}

.run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.run .icon {
  width: 12px;
  height: 12px;
  flex: none;
  fill: currentColor;
}

.run .keys {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  opacity: 0.85;
}

.run.stop {
  border-color: var(--border);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.run.stop:hover {
  border-color: var(--vp-c-danger-1);
}

.run.stop .icon {
  color: var(--vp-c-danger-1);
}

.output {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  max-height: 50vh;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--vp-c-bg-soft);
  overflow: auto;
}

.output pre,
.output p {
  flex: 1;
  min-width: 0;
  min-height: 22px;
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 22px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--vp-c-text-1);
}

.output .stderr {
  color: var(--vp-c-danger-1);
}

.output .note {
  color: var(--vp-c-text-2);
  font-style: italic;
}

.output a {
  color: inherit;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.output a:hover {
  color: var(--vp-c-brand-1);
}

.exit {
  position: sticky;
  top: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 22px;
  color: var(--vp-c-danger-1);
  white-space: nowrap;
}

.more {
  margin: 16px 0 0;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.more a {
  font-weight: 500;
  color: var(--vp-c-brand-1);
}

.more a:hover {
  color: var(--vp-c-brand-2);
}

@media (max-width: 768px) {
  .playground {
    padding: 16px 12px 24px;
  }

  .run .keys {
    display: none;
  }

  /* Lines wrap on a narrow screen, so the examples take a row of their own above the code. */
  .examples {
    position: static;
    display: block;
    margin: 8px 8px 0 auto;
  }
}
</style>
