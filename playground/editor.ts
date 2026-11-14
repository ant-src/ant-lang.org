// The editor's half of the playground, loaded only in the browser: Monaco without its bundled
// languages, Ant's language server in a worker, and a worker that runs programs. Both workers
// share one compiled ant.wasm.
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { setupAnt, type AntLanguageServer } from "@ant-lang/monaco";
import LanguageServerWorker from "@ant-lang/monaco/worker?worker";
import { defineThemes } from "./themes";

export { monaco };
export { compileAnt, Runner, type RunHandlers } from "./runner";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
defineThemes(monaco);

export function startLanguageServer(module: WebAssembly.Module, onLog: (line: string) => void): AntLanguageServer {
  return setupAnt(monaco, { wasm: module, worker: () => new LanguageServerWorker(), onLog });
}
