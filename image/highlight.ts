// Tokens for the image: Shiki with the editor grammar, colored by the picked theme.
import { createHighlighterCore, type HighlighterCore, type LanguageRegistration } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import antGrammar from "../.vitepress/ant.tmLanguage.json";
import { themes } from "./presets";

export interface Token {
  text: string;
  color: string;
  italic: boolean;
}

export interface Highlighted {
  lines: Token[][];
  fg: string;
  bg: string;
}

let highlighter: Promise<HighlighterCore> | undefined;

function load(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [css, javascript] = await Promise.all([import("shiki/langs/css.mjs"), import("shiki/langs/javascript.mjs")]);
    const ant = { ...(antGrammar as unknown as LanguageRegistration), name: "ant" };
    return createHighlighterCore({
      themes: [],
      // Markup expressions embed CSS and JavaScript, as on the site's pages.
      langs: [...css.default, ...javascript.default, ant],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  })();
  return highlighter;
}

const loaded = new Set<string>();

/** highlight splits code into lines of colored tokens; tabs become four spaces. */
export async function highlight(code: string, themeId: string): Promise<Highlighted> {
  const h = await load();
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];
  if (!loaded.has(theme.id)) {
    const registration = await theme.load();
    await h.loadTheme({ ...registration, name: theme.id });
    loaded.add(theme.id);
  }
  const result = h.codeToTokens(code.replace(/\t/g, "    "), { lang: "ant", theme: theme.id });
  const fg = result.fg ?? "#ddd";
  return {
    fg,
    bg: result.bg ?? "#111",
    lines: result.tokens.map((line) =>
      line.map((t) => ({ text: t.content, color: t.color ?? fg, italic: ((t.fontStyle ?? 0) & 1) !== 0 })),
    ),
  };
}
