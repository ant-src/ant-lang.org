import type * as Monaco from "monaco-editor/editor";

// The themes follow VitePress's backgrounds and the colors of the ant. Rules match Monarch tokens
// and the language server's semantic token types alike.
type Palette = Record<
  "fg" | "bg" | "keyword" | "string" | "number" | "type" | "func" | "comment" | "muted" | "error",
  string
>;

const light: Palette = {
  fg: "24292f",
  bg: "ffffff",
  keyword: "7c3aed",
  string: "b45309",
  number: "2563eb",
  type: "0f766e",
  func: "c026d3",
  comment: "6e7781",
  muted: "57606a",
  error: "dc2626",
};

const dark: Palette = {
  fg: "dfdfd6",
  bg: "1b1b1f",
  keyword: "c4b5fd",
  string: "fdba74",
  number: "93c5fd",
  type: "5eead4",
  func: "f0abfc",
  comment: "8b949e",
  muted: "9ca3af",
  error: "f87171",
};

function theme(base: "vs" | "vs-dark", p: Palette): Monaco.editor.IStandaloneThemeData {
  return {
    base,
    inherit: true,
    rules: [
      { token: "", foreground: p.fg },
      { token: "keyword", foreground: p.keyword },
      { token: "constant", foreground: p.number },
      { token: "number", foreground: p.number },
      { token: "string", foreground: p.string },
      { token: "string.escape", foreground: p.type },
      { token: "regexp", foreground: p.string },
      { token: "comment", foreground: p.comment, fontStyle: "italic" },
      { token: "comment.doc", foreground: p.comment, fontStyle: "italic" },
      { token: "type", foreground: p.type },
      { token: "type.identifier", foreground: p.type },
      { token: "typeParameter", foreground: p.type },
      { token: "namespace", foreground: p.type },
      { token: "predefined", foreground: p.func },
      { token: "function", foreground: p.func },
      { token: "method", foreground: p.func },
      { token: "parameter", foreground: p.fg },
      { token: "variable", foreground: p.fg },
      { token: "property", foreground: p.fg },
      { token: "operator", foreground: p.muted },
      { token: "delimiter", foreground: p.muted },
      { token: "tag", foreground: p.keyword },
      { token: "element", foreground: p.keyword },
      { token: "attribute", foreground: p.type },
      { token: "attribute.name", foreground: p.type },
      { token: "attribute.value", foreground: p.string },
      { token: "invalid", foreground: p.error },
    ],
    colors: {
      "editor.background": `#${p.bg}`,
      "editor.foreground": `#${p.fg}`,
      "editorGutter.background": `#${p.bg}`,
      "editorLineNumber.foreground": `#${p.comment}88`,
      "editorLineNumber.activeForeground": `#${p.muted}`,
      "editorInlayHint.foreground": `#${p.comment}`,
      "editorInlayHint.background": "#00000000",
      focusBorder: "#7c3aed66",
    },
  };
}

export function defineThemes(monaco: typeof Monaco): void {
  monaco.editor.defineTheme("ant-light", theme("vs", light));
  monaco.editor.defineTheme("ant-dark", theme("vs-dark", dark));
}
