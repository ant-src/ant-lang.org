import type { ThemeRegistrationRaw } from "shiki";

// The colors of the ant, as the playground's editor paints them (playground/themes.ts), so code
// on the site looks the same as code in the editor. Each theme maps the grammar's scopes to the
// editor's token colors.
type Palette = Record<"fg" | "keyword" | "string" | "number" | "type" | "func" | "comment" | "muted" | "error", string>;

const light: Palette = {
  fg: "#24292f",
  keyword: "#7c3aed",
  string: "#b45309",
  number: "#2563eb",
  type: "#0f766e",
  func: "#c026d3",
  comment: "#6e7781",
  muted: "#57606a",
  error: "#dc2626",
};

const dark: Palette = {
  fg: "#dfdfd6",
  keyword: "#c4b5fd",
  string: "#fdba74",
  number: "#93c5fd",
  type: "#5eead4",
  func: "#f0abfc",
  comment: "#8b949e",
  muted: "#9ca3af",
  error: "#f87171",
};

function theme(name: string, type: "light" | "dark", p: Palette): ThemeRegistrationRaw {
  return {
    name,
    type,
    colors: { "editor.foreground": p.fg, "editor.background": "#00000000" },
    settings: [
      { settings: { foreground: p.fg } },
      { scope: "comment", settings: { foreground: p.comment, fontStyle: "italic" } },
      { scope: ["keyword.control", "storage.type", "entity.name.tag"], settings: { foreground: p.keyword } },
      { scope: ["keyword.operator", "punctuation"], settings: { foreground: p.muted } },
      { scope: ["constant.numeric", "constant.language"], settings: { foreground: p.number } },
      {
        scope: ["string", "punctuation.definition.string", "keyword.other.regexp.flags"],
        settings: { foreground: p.string },
      },
      { scope: ["constant.character.escape", "constant.character.entity"], settings: { foreground: p.type } },
      { scope: ["meta.template.expression", "meta.markup.interpolation"], settings: { foreground: p.fg } },
      {
        scope: [
          "entity.name.type",
          "support.type",
          "support.class",
          "entity.name.namespace",
          "entity.other.attribute-name",
        ],
        settings: { foreground: p.type },
      },
      { scope: ["entity.name.function", "support.function"], settings: { foreground: p.func } },
      { scope: "variable", settings: { foreground: p.fg } },
      { scope: "invalid", settings: { foreground: p.error } },
    ],
  };
}

export const antLight = theme("ant-light", "light", light);
export const antDark = theme("ant-dark", "dark", dark);
