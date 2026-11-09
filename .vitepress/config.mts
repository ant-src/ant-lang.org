import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitepress";
import type { Plugin } from "vite";
import type { LanguageRegistration } from "shiki";
import css from "shiki/langs/css.mjs";
import javascript from "shiki/langs/javascript.mjs";
// A copy of syntaxes/ant.tmLanguage.json from ant-src/vscode-ant, the grammar every editor uses.
import antGrammar from "./ant.tmLanguage.json" with { type: "json" };
import { antDark, antLight } from "./ant-theme";
import { syncDocs } from "./docs";

// The documentation comes from docs/ of ant-src/ant, checked out beside this repository or named by
// ANT_DOCS, and is copied into docs/ here on every build.
const site = path.resolve(import.meta.dirname, "..");
const docs = syncDocs(path.resolve(site, process.env.ANT_DOCS ?? "../ant/docs"), path.join(site, "docs"));
// VitePress checks the links of Markdown pages, not those of the theme's components: check the docs
// pages these link to here, so a page moved in ant fails the build instead of the footer.
for (const page of ["start/install.md"]) {
  if (!fs.existsSync(path.join(site, "docs", page)))
    throw new Error(`docs: SiteFooter.vue links docs/${page}, which is gone`);
}

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
  description: "Ant is a typed language with errors as values, pipes for data, and goroutines.",
  cleanUrls: true,
  appearance: "dark",
  lastUpdated: false,
  markdown: { languages: [...css, ...javascript, ant], theme: { light: antLight, dark: antDark } },
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
    ["meta", { name: "theme-color", content: "#7c3aed" }],
  ],
  // A darkOnly page is dark from its first paint, whatever the reader chose for the rest of the
  // site. The page's head tags come after VitePress's own appearance script, so this one wins.
  // The dev server renders pages in the browser only, where theme/index.ts sets the same classes
  // before anything is drawn.
  transformHead({ pageData }) {
    if (pageData.frontmatter.darkOnly !== true) return;
    return [["script", {}, "document.documentElement.classList.add('dark', 'dark-only')"]];
  },
  themeConfig: {
    logo: "/logo.png",
    nav: [
      docs.menu,
      {
        text: "Editors",
        items: [
          { text: "VS Code", link: "/vscode" },
          { text: "IntelliJ IDEA", link: "/intellij" },
          { text: "Neovim", link: "/nvim" },
        ],
      },
      { text: "Playground", link: "/playground" },
      { text: "Specification", link: "https://github.com/ant-src/spec" },
    ],
    sidebar: docs.sidebar,
    editLink: {
      pattern: ({ filePath }) =>
        filePath.startsWith("docs/")
          ? `https://github.com/ant-src/ant/edit/master/${filePath}`
          : `https://github.com/ant-src/ant-lang.org/edit/master/${filePath}`,
    },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/ant-src/ant" }],
  },
  vite: {
    // The year in the footer's copyright (theme/SiteFooter.vue).
    define: { __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()) },
    // The Ant packages point at their worker and ant.wasm with new URL(..., import.meta.url),
    // which dependency pre-bundling would break.
    optimizeDeps: { exclude: ["@ant-lang/monaco", "@ant-lang/wasm"] },
    plugins: [oneAntWasm()],
    worker: { format: "es", plugins: () => [oneAntWasm()] },
    server: { fs: { allow: [".."] } },
  },
});
