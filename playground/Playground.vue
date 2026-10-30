<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useData } from "vitepress";
import type * as Monaco from "monaco-editor/editor";
import type { AntLanguageServer } from "@ant-lang/monaco";
import { defaultExample, examples, type Example } from "./examples";
import { decode, encode, validPath, type Snapshot } from "./share";

type EditorModule = typeof import("./editor");
type Status = "loading" | "ready" | "running" | "failed";
type Part = { text: string } | { text: string; path: string; line: number; column: number };
interface Chunk {
  stream: "stdout" | "stderr" | "note";
  text: string;
  parts: Part[]; // the text, with positions in the code as links
}

const storageKey = "ant-playground";
// Output past the limit stops the run: a program printing forever would otherwise flood the page.
const outputLimit = 1 << 20;
// A chunk grows to this size, so linking positions on each append costs little.
const chunkSize = 1 << 16;
const mod = shallowRef<EditorModule>();
const { isDark } = useData();

const editorEl = ref<HTMLElement>();
const mainEl = ref<HTMLElement>();
const paths = ref<string[]>([]);
const active = ref("main.ant");
const stdin = ref("");
const chunks = ref<Chunk[]>([]);
const status = ref<Status>("loading");
const loadError = ref("");
const result = ref<{ exitCode: number; ms: number } | null>(null);
const panel = ref<"output" | "input">("output");
const split = ref(55);
const toast = ref("");
const exampleId = ref("");
const naming = ref<{ mode: "add" | "rename"; from?: string; value: string; error: string } | null>(null);
const rootEl = ref<HTMLElement>();

let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
let server: AntLanguageServer | undefined;
let runner: InstanceType<EditorModule["Runner"]> | undefined;
// pristine is the example as it was opened, so picking another replaces it without asking;
// any other code, restored or shared, is asked about.
let pristine: string | null = null;
// fromHash says the code is a shared link not yet edited, which is not saved over the reader's own.
let fromHash = false;
let loaded = false; // the files are in the editor, so there is something to save
let loading = false; // load is replacing the files, which is no edit
let unmounted = false;
let lspReady = false;
let runnerReady = false;
let pendingOutput: { stream: Chunk["stream"]; text: string }[] = [];
let outputSize = 0;
let flushFrame = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const disposables: Monaco.IDisposable[] = [];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod1 = isMac ? "⌘" : "Ctrl";
const running = computed(() => status.value === "running");

// ---- files

const uriOf = (path: string) => mod.value!.monaco.Uri.parse(`file:///${path}`);
const modelOf = (path: string) => mod.value!.monaco.editor.getModel(uriOf(path));

function snapshot(): Snapshot {
  const files: Record<string, string> = {};
  for (const path of paths.value) files[path] = modelOf(path)?.getValue() ?? "";
  return { files, stdin: stdin.value };
}

function load(s: Snapshot) {
  const { monaco } = mod.value!;
  for (const path of paths.value) modelOf(path)?.dispose();
  const order = Object.keys(s.files).sort((a, b) =>
    a === "main.ant" ? -1 : b === "main.ant" ? 1 : a.localeCompare(b),
  );
  for (const path of order) {
    const model = monaco.editor.createModel(s.files[path], "ant", uriOf(path));
    disposables.push(model.onDidChangeContent(changed));
  }
  paths.value = order;
  loading = true;
  stdin.value = s.stdin;
  nextTick(() => (loading = false));
  pristine = null;
  loaded = true;
  show("main.ant");
}

function show(path: string) {
  const model = modelOf(path);
  if (!model || !editor) return;
  active.value = path;
  if (editor.getModel() !== model) editor.setModel(model);
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
    if (saved?.files?.["main.ant"] !== undefined) return { files: saved.files, stdin: saved.stdin ?? "" };
  } catch {
    // Unreadable storage is the same as none.
  }
  return null;
}

function startNaming(mode: "add" | "rename", from?: string) {
  if (mode === "rename" && from === "main.ant") return;
  naming.value = { mode, from, value: from ?? "", error: "" };
  nextTick(() => {
    const input = rootEl.value?.querySelector<HTMLInputElement>("input.name");
    input?.focus();
    input?.select();
  });
}

function commitName() {
  const n = naming.value;
  if (!n) return;
  let name = n.value.trim();
  if (name && !name.endsWith(".ant")) name += ".ant";
  if (n.mode === "rename" && name === n.from) {
    naming.value = null;
    return;
  }
  if (!validPath(name)) {
    n.error = "Use letters, digits, - and _, ending in .ant";
    return;
  }
  if (paths.value.includes(name)) {
    n.error = `${name} exists`;
    return;
  }
  const { monaco } = mod.value!;
  const text =
    n.mode === "rename"
      ? modelOf(n.from!)!.getValue()
      : `// ${name} is imported as "./${name}".\n\nexport func greet(name: string): string { \`hello, \${name}\` }\n`;
  const model = monaco.editor.createModel(text, "ant", uriOf(name));
  disposables.push(model.onDidChangeContent(changed));
  if (n.mode === "rename") {
    modelOf(n.from!)?.dispose();
    paths.value = paths.value.map((p) => (p === n.from ? name : p));
  } else {
    paths.value = [...paths.value, name];
  }
  naming.value = null;
  show(name);
  changed();
}

function removeFile(path: string) {
  if (path === "main.ant") return;
  const model = modelOf(path);
  if (model && model.getValue().trim() !== "" && !confirm(`Delete ${path}?`)) return;
  paths.value = paths.value.filter((p) => p !== path);
  if (active.value === path) show("main.ant");
  model?.dispose();
  changed();
}

// ---- examples

function pickExample(id: string) {
  const example = examples.find((e) => e.id === id);
  exampleId.value = "";
  if (!example) return;
  if (JSON.stringify(snapshot()) !== pristine && !confirm(`Replace your code with “${example.title}”?`)) return;
  own();
  openExample(example);
}

function openExample(example: Example) {
  load({ files: { ...example.files }, stdin: example.stdin });
  pristine = JSON.stringify(snapshot());
  clearOutput();
  panel.value = example.stdin ? "input" : "output";
  save();
  editor?.focus();
}

// ---- running

function run() {
  if (!runner || status.value === "loading" || status.value === "failed") return;
  if (running.value) restart();
  clearOutput();
  panel.value = "output";
  status.value = "running";
  runner.run(snapshot().files, stdin.value);
}

function stop(message = "Stopped.") {
  if (!running.value || !runner) return;
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
  result.value = null;
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
const positionPattern = /([A-Za-z0-9_\-/]+\.ant):(\d+):(\d+)/g;

function segments(text: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(positionPattern)) {
    if (!paths.value.includes(m[1])) continue;
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], path: m[1], line: Number(m[2]), column: Number(m[3]) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function reveal(path: string, line: number, column: number) {
  show(path);
  const position = { lineNumber: line, column };
  editor?.setPosition(position);
  editor?.revealPositionInCenter(position);
  editor?.focus();
}

// ---- toolbar

async function format() {
  await editor?.getAction("editor.action.formatDocument")?.run();
}

async function share() {
  const code = await encode(snapshot());
  const url = `${location.origin}${location.pathname}#code=${code}`;
  history.replaceState(null, "", url);
  fromHash = true;
  try {
    await navigator.clipboard.writeText(url);
    flash("Link copied");
  } catch {
    flash("Link in the address bar");
  }
}

function flash(text: string) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 1800);
}

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    run();
  } else if (e.key === "Escape" && running.value && !editorEl.value?.contains(e.target as Node)) {
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
}

// ---- the divider

function drag(e: PointerEvent) {
  const box = mainEl.value!.getBoundingClientRect();
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    split.value = Math.min(80, Math.max(25, ((ev.clientX - box.left) / box.width) * 100));
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
}

// ---- lifecycle

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", onHash);
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
    scrollBeyondLastLine: false,
    renderLineHighlight: "line",
    "semanticHighlighting.enabled": true,
    // Inferred types show while Ctrl+Alt is held, so they do not crowd code being learned.
    inlayHints: { enabled: "offUnlessPressed" },
    bracketPairColorization: { enabled: false },
    wordWrap: matchMedia("(max-width: 768px)").matches ? "on" : "off",
    fixedOverflowWidgets: true,
    theme: isDark.value ? "ant-dark" : "ant-light",
  });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, format);
  disposables.push(
    monaco.editor.registerEditorOpener({
      openCodeEditor(_source, uri, selection) {
        const path = uri.path.replace(/^\//, "");
        if (uri.scheme !== "file" || !paths.value.includes(path)) return false;
        show(path);
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
  if (shared) {
    fromHash = true;
    load(shared);
  } else {
    const saved = restore();
    load(saved ?? { files: { ...defaultExample.files }, stdin: defaultExample.stdin });
    if (!saved) pristine = JSON.stringify(snapshot());
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
    done(exitCode, ms) {
      flushOutput();
      status.value = "ready";
      result.value = { exitCode, ms };
    },
    failed(message) {
      status.value = "ready";
      note(message);
      result.value = { exitCode: 1, ms: 0 };
    },
    unavailable: fail,
  });
});

// becomeReady leaves loading once both workers are up, at the start and after each Stop.
function becomeReady() {
  if (lspReady && runnerReady && status.value === "loading") status.value = "ready";
}

function fail(err: unknown) {
  status.value = "failed";
  loadError.value = String((err as Error)?.message ?? err);
}

watch(isDark, (dark) => mod.value?.monaco.editor.setTheme(dark ? "ant-dark" : "ant-light"));
watch(stdin, () => loading || changed());

onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("hashchange", onHash);
  clearTimeout(saveTimer);
  cancelAnimationFrame(flushFrame);
  save();
  for (const d of disposables.splice(0)) d.dispose();
  server?.dispose();
  runner?.dispose();
  for (const path of paths.value) modelOf(path)?.dispose();
  editor?.dispose();
});
</script>

<template>
  <div ref="rootEl" class="playground">
    <header class="toolbar">
      <select v-model="exampleId" class="examples" aria-label="Examples" @change="pickExample(exampleId)">
        <option value="" disabled>Examples</option>
        <option v-for="e in examples" :key="e.id" :value="e.id">{{ e.title }}</option>
      </select>

      <nav class="tabs" aria-label="Files">
        <div
          v-for="path in paths"
          :key="path"
          class="tab"
          :class="{ active: path === active }"
          role="button"
          tabindex="0"
          :title="path === 'main.ant' ? 'The program starts here' : 'Double-click to rename'"
          @click="show(path)"
          @keydown.enter="show(path)"
          @dblclick="startNaming('rename', path)"
        >
          <template v-if="naming?.mode === 'rename' && naming.from === path">
            <input
              v-model="naming.value"
              class="name"
              spellcheck="false"
              @keydown.enter.prevent="commitName"
              @keydown.esc="naming = null"
              @blur="naming = null"
            />
          </template>
          <template v-else>
            <span>{{ path }}</span>
            <button
              v-if="path !== 'main.ant'"
              class="close"
              type="button"
              :aria-label="`Delete ${path}`"
              @click.stop="removeFile(path)"
            >
              ×
            </button>
          </template>
        </div>
        <div v-if="naming?.mode === 'add'" class="tab active">
          <input
            v-model="naming.value"
            class="name"
            placeholder="name.ant"
            spellcheck="false"
            @keydown.enter.prevent="commitName"
            @keydown.esc="naming = null"
            @blur="naming = null"
          />
        </div>
        <button v-else class="add" type="button" title="New module" aria-label="New module" @click="startNaming('add')">
          +
        </button>
        <span v-if="naming?.error" class="name-error">{{ naming.error }}</span>
      </nav>

      <div class="actions">
        <span class="state" :class="status" :title="loadError || undefined">
          <span class="dot" />
          {{
            status === "loading"
              ? "Loading Ant…"
              : status === "failed"
                ? "Failed to load"
                : status === "running"
                  ? "Running…"
                  : "Ready"
          }}
        </span>
        <button type="button" class="button" :title="`Format (${mod1}+S)`" @click="format">Format</button>
        <button type="button" class="button" title="Copy a link to this code" @click="share">Share</button>
        <!-- One button that keeps its size, so the toolbar does not move as a run starts and ends. -->
        <button
          type="button"
          class="button run"
          :class="{ stop: running }"
          :disabled="!running && status !== 'ready'"
          :title="running ? 'Stop (Esc)' : `Run (${mod1}+Enter)`"
          @click="running ? stop() : run()"
        >
          <span class="icon" aria-hidden="true">{{ running ? "■" : "▶" }}</span
          >{{ running ? "Stop" : "Run" }}
        </button>
      </div>
    </header>

    <div ref="mainEl" class="main" :style="{ '--split': `${split}%` }">
      <div ref="editorEl" class="editor" />
      <div class="divider" role="separator" aria-orientation="vertical" @pointerdown.prevent="drag" />
      <section class="side">
        <div class="side-tabs" role="tablist">
          <button
            role="tab"
            :aria-selected="panel === 'output'"
            :class="{ on: panel === 'output' }"
            @click="panel = 'output'"
          >
            Output
          </button>
          <button
            role="tab"
            :aria-selected="panel === 'input'"
            :class="{ on: panel === 'input' }"
            @click="panel = 'input'"
          >
            Input<span v-if="stdin" class="badge" />
          </button>
          <span v-if="result" class="exit" :class="{ ok: result.exitCode === 0 }">
            exit {{ result.exitCode
            }}<template v-if="result.ms">
              · {{ result.ms < 1000 ? `${Math.round(result.ms)} ms` : `${(result.ms / 1000).toFixed(2)} s` }}</template
            >
          </span>
        </div>

        <div v-show="panel === 'output'" class="output" aria-live="polite">
          <div v-if="status === 'failed'" class="placeholder error">Ant could not load: {{ loadError }}</div>
          <div v-else-if="!chunks.length && !result" class="placeholder">
            <p v-if="running">Running…</p>
            <template v-else>
              <p>
                Press <kbd>{{ mod1 }}</kbd> <kbd>Enter</kbd> or Run to run <code>main.ant</code>.
              </p>
              <p>
                Hover names for types, <kbd>F12</kbd> jumps to a definition, <kbd>{{ mod1 }}</kbd> <kbd>S</kbd> formats.
              </p>
            </template>
          </div>
          <pre
            v-else
          ><template v-for="(c, i) in chunks" :key="i"><span :class="c.stream"><template v-for="(s, j) in c.parts" :key="j"><a
            v-if="'path' in s"
            href="#"
            @click.prevent="reveal(s.path, s.line, s.column)"
          >{{ s.text }}</a><template v-else>{{ s.text }}</template></template></span></template><span v-if="result && !chunks.length" class="note">(no output)</span></pre>
        </div>

        <div v-show="panel === 'input'" class="input">
          <textarea
            v-model="stdin"
            spellcheck="false"
            placeholder="What the program reads from Os.stdin(), line by line."
            aria-label="Standard input"
          />
        </div>
      </section>
    </div>

    <transition name="fade">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.playground {
  --border: var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--vp-nav-height));
  height: calc(100dvh - var(--vp-nav-height));
  background: var(--vp-c-bg);
  position: relative;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--vp-c-bg-alt);
  min-height: 52px;
}

.examples {
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 30px 5px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%23888' stroke-width='1.5' d='m1 1 4 4 4-4'/%3E%3C/svg%3E")
    no-repeat right 11px center;
  cursor: pointer;
}

.tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.tab:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.tab.active {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: inset 0 0 0 1px var(--border);
}

.close {
  width: 16px;
  height: 16px;
  line-height: 14px;
  border-radius: 4px;
  color: var(--vp-c-text-3);
  font-size: 14px;
}

.close:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.add {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1;
}

.add:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.name {
  width: 140px;
  font: inherit;
  color: var(--vp-c-text-1);
  background: transparent;
  outline: none;
}

.name-error {
  font-size: 12px;
  color: var(--vp-c-danger-1);
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.state {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 96px; /* fits "Loading Ant…", so the buttons stay put as the state changes */
  gap: 6px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vp-c-green-1);
}

.state.loading .dot,
.state.running .dot {
  background: var(--vp-c-yellow-1);
  animation: pulse 1s ease-in-out infinite;
}

.state.failed .dot {
  background: var(--vp-c-danger-1);
}

@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

.button {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  white-space: nowrap;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.button:hover {
  border-color: var(--vp-c-brand-1);
}

.button.run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 84px;
  border-color: transparent;
  color: #fff;
  background: linear-gradient(120deg, var(--ant-violet), var(--ant-pink));
  padding: 5px 16px;
}

.button.run .icon {
  width: 10px;
  font-size: 11px;
  text-align: center;
}

.button.run:hover {
  filter: brightness(1.08);
}

.button.run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
}

.button.stop {
  background: var(--vp-c-danger-1);
}

.main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--split) 6px 1fr;
}

.editor {
  min-width: 0;
  min-height: 0;
}

.divider {
  cursor: col-resize;
  border-left: 1px solid var(--border);
  touch-action: none;
}

.divider:hover {
  background: var(--vp-c-brand-soft);
}

.side {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--vp-c-bg-alt);
}

.side-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
}

.side-tabs button {
  position: relative;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.side-tabs button.on {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

.badge {
  position: absolute;
  top: 4px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}

.exit {
  margin-left: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-danger-1);
}

.exit.ok {
  color: var(--vp-c-green-1);
}

.output,
.input {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.output pre {
  margin: 0;
  padding: 16px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--vp-c-text-1);
}

.output .stderr {
  color: var(--vp-c-danger-1);
}

.output .note {
  color: var(--vp-c-text-3);
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

.placeholder {
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.placeholder p {
  margin: 0 0 6px;
}

.placeholder.error {
  color: var(--vp-c-danger-1);
}

.placeholder code {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

kbd {
  display: inline-block;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 5px;
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  line-height: 18px;
  background: var(--vp-c-bg);
}

.input textarea {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: 0;
  resize: none;
  outline: none;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  background: transparent;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--vp-c-bg);
  background: var(--vp-c-text-1);
  box-shadow: var(--vp-shadow-3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 16px;
  }

  .examples {
    flex: 1;
    min-width: 0;
  }

  .tabs {
    order: 3;
    flex-basis: 100%;
  }

  .actions {
    gap: 6px;
  }

  .button {
    padding: 5px 10px;
  }

  .state {
    display: none;
  }

  .main {
    grid-template-columns: 1fr;
    grid-template-rows: 3fr 2fr;
  }

  .divider {
    display: none;
  }

  .side {
    border-top: 1px solid var(--border);
  }
}
</style>
