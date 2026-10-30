// The run worker runs programs, one at a time, on the ant.wasm module the page compiled. The
// page ends a run that will not stop by terminating the worker.
import { loadAnt, type Ant } from "@ant-lang/wasm";

export type ToWorker =
  | { type: "init"; module: WebAssembly.Module }
  | { type: "run"; files: Record<string, string>; stdin: string };

export type FromWorker =
  | { type: "ready" }
  | { type: "output"; stream: "stdout" | "stderr"; text: string }
  | { type: "done"; exitCode: number; ms: number }
  | { type: "failed"; message: string }
  | { type: "unavailable"; message: string };

let ant: Promise<Ant> | undefined;
const post = (m: FromWorker) => self.postMessage(m);

self.onmessage = async ({ data }: MessageEvent<ToWorker>) => {
  if (data.type === "init") {
    ant = loadAnt({ wasm: data.module });
    ant.then(
      () => post({ type: "ready" }),
      (err) => post({ type: "unavailable", message: String(err?.message ?? err) }),
    );
    return;
  }
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  const write = (stream: "stdout" | "stderr", text: string) => text && post({ type: "output", stream, text });
  const sink = (stream: "stdout" | "stderr") => (chunk: Uint8Array) =>
    write(stream, decoders[stream].decode(chunk, { stream: true }));
  const start = performance.now();
  try {
    const result = await (
      await ant!
    ).run({
      files: data.files,
      path: "main.ant",
      stdin: data.stdin,
      stdout: sink("stdout"),
      stderr: sink("stderr"),
    });
    write("stdout", decoders.stdout.decode());
    write("stderr", decoders.stderr.decode());
    for (const d of result.diagnostics) write("stderr", `${d.path}:${d.line}:${d.column}: ${d.message}\n`);
    post({ type: "done", exitCode: result.exitCode, ms: performance.now() - start });
  } catch (err) {
    post({ type: "failed", message: String((err as Error)?.message ?? err) });
  }
};
