// Running programs, without the editor: ant.wasm compiled once, and a worker that runs programs
// on it. The playground and the image page share it.
import wasmUrl from "@ant-lang/wasm/ant.wasm?url";
import RunWorker from "./run.worker?worker";
import type { FromWorker, ToWorker } from "./run.worker";

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

export interface RunHandlers {
  ready(): void;
  output(stream: "stdout" | "stderr", text: string): void;
  done(exitCode: number, ms: number): void;
  /** failed reports a run that could not finish. */
  failed(message: string): void;
  /** unavailable reports that ant.wasm did not start in the worker, so nothing can run. */
  unavailable(message: string): void;
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
        case "unavailable":
          return this.handlers.unavailable(data.message);
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
