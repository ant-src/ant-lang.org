import { defineConfig } from "vitepress";
import type { Plugin } from "vite";
import type { LanguageRegistration } from "shiki";
import css from "shiki/langs/css.mjs";
import javascript from "shiki/langs/javascript.mjs";
// A copy of syntaxes/ant.tmLanguage.json from ant-src/vscode-ant, the grammar every editor uses.
import antGrammar from "./ant.tmLanguage.json" with { type: "json" };
import { antDark, antLight } from "./ant-theme";

// Ant code blocks in Markdown (```ant) highlight with the editor grammar. Markup expressions
// embed CSS in <style> and JavaScript in <script>, so those grammars load with it.
const ant: LanguageRegistration = {
  ...(antGrammar as unknown as LanguageRegistration),
  name: "ant",
};

// The playground compiles ant.wasm once and hands the module to its workers, so the default URL
// in @ant-lang/wasm, which would copy ant.wasm into every worker's bundle, goes unused: drop it.
function oneAntWasm(): Plugin {
  return {
    name: "one-ant-wasm",
    transform(code, id) {
      if (!/@ant-lang[/\\]wasm[/\\]index\.js$/.test(id)) return;
      const url = 'new URL("./ant.wasm", import.meta.url)';
      // A new @ant-lang/wasm that words it otherwise must fail the build, not copy ant.wasm again.
      if (!code.includes(url)) this.error(`one-ant-wasm: ${url} is not in ${id}; update the plugin`);
      return code.replace(url, "undefined");
    },
  };
}

export default defineConfig({
  title: "Ant",
  description: "Static types, goroutines, and nothing left undefined.",
  cleanUrls: true,
  lastUpdated: false,
  markdown: { languages: [...css, ...javascript, ant], theme: { light: antLight, dark: antDark } },
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
    ["meta", { name: "theme-color", content: "#7c3aed" }],
  ],
  themeConfig: {
    logo: "/logo.png",
    nav: [
      { text: "Playground", link: "/playground" },
      { text: "Specification", link: "https://github.com/ant-src/spec" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/ant-src/ant" }],
    footer: {
      message: "Released under the MIT License.",
    },
  },
  vite: {
    // The Ant packages point at their worker and ant.wasm with new URL(..., import.meta.url),
    // which dependency pre-bundling would break.
    optimizeDeps: { exclude: ["@ant-lang/monaco", "@ant-lang/wasm"] },
    plugins: [oneAntWasm()],
    worker: { format: "es", plugins: () => [oneAntWasm()] },
    server: { fs: { allow: [".."] } },
  },
});
