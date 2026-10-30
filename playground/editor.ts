// The editor's half of the playground, loaded only in the browser: Monaco without its bundled
// languages, Ant's language server in a worker, and a worker that runs programs. Both workers
// share one compiled ant.wasm.
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { setupAnt, type AntLanguageServer } from "@ant-lang/monaco";
import LanguageServerWorker from "@ant-lang/monaco/worker?worker";
import wasmUrl from "@ant-lang/wasm/ant.wasm?url";
import RunWorker from "./run.worker?worker";
import type { FromWorker, ToWorker } from "./run.worker";
import { defineThemes } from "./themes";

export { monaco };

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
defineThemes(monaco);

let compiled: Promise<WebAssembly.Module> | undefined;

/** compileAnt downloads and compiles ant.wasm once. */
export function compileAnt(): Promise<WebAssembly.Module> {
  compiled ??= (async () => {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`ant.wasm: ${response.status} ${response.statusText}`);
    if (response.headers.get("Content-Type")?.startsWith("application/wasm")) {
      return WebAssembly.compileStreaming(response);
    }
    return WebAssembly.compile(await response.arrayBuffer());
  })();
  compiled.catch(() => (compiled = undefined));
  return compiled;
}

export function startLanguageServer(module: WebAssembly.Module, onLog: (line: string) => void): AntLanguageServer {
  return setupAnt(monaco, { wasm: module, worker: () => new LanguageServerWorker(), onLog });
}

export interface RunHandlers {
  ready(): void;
  output(stream: "stdout" | "stderr", text: string): void;
  done(exitCode: number, ms: number): void;
  failed(message: string): void;
}

/** Runner runs programs in a worker, and stops one by replacing the worker. */
export class Runner {
  private worker!: Worker;

  constructor(
    private module: WebAssembly.Module,
    private handlers: RunHandlers,
  ) {
    this.spawn();
  }

  private spawn() {
    this.worker = new RunWorker();
    this.worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
      switch (data.type) {
        case "ready":
          return this.handlers.ready();
        case "output":
          return this.handlers.output(data.stream, data.text);
        case "done":
          return this.handlers.done(data.exitCode, data.ms);
        case "failed":
          return this.handlers.failed(data.message);
      }
    };
    this.post({ type: "init", module: this.module });
  }

  private post(message: ToWorker) {
    this.worker.postMessage(message);
  }

  run(files: Record<string, string>, stdin: string) {
    this.post({ type: "run", files, stdin });
  }

  /** stop ends the run in progress; the runner is ready again when handlers.ready is called. */
  stop() {
    this.worker.terminate();
    this.spawn();
  }

  dispose() {
    this.worker.terminate();
  }
}
