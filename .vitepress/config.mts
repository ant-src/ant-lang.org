import fs from "node:fs";
import path from "node:path";
import { createContentLoader, defineConfig } from "vitepress";
import type { Plugin } from "vite";
import type { LanguageRegistration } from "shiki";
import css from "shiki/langs/css.mjs";
import javascript from "shiki/langs/javascript.mjs";
// A copy of syntaxes/ant.tmLanguage.json from ant-src/vscode-ant, the grammar every editor uses.
import antGrammar from "./ant.tmLanguage.json" with { type: "json" };
import { antDark, antLight } from "./ant-theme";
import { syncDocs } from "./docs";
import { atomFeed, newsGlob, toPosts } from "./news";

// The documentation comes from docs/ of ant-src/ant, checked out beside this repository or named by
// ANT_DOCS, and is copied into docs/ here on every build.
const site = path.resolve(import.meta.dirname, "..");
const docs = syncDocs(path.resolve(site, process.env.ANT_DOCS ?? "../ant/docs"), path.join(site, "docs"));
// VitePress checks the links of Markdown pages, not those of the nav or the theme's components: check
// the docs pages these link to here, so a page moved in ant fails the build instead of a link.
for (const page of ["start/install.md"]) {
  if (!fs.existsSync(path.join(site, "docs", page)))
    throw new Error(`docs: the nav and SiteFooter.vue link docs/${page}, which is gone`);
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

const description = "Ant is a typed language with errors as values, pipes for data, and goroutines.";

export default defineConfig({
  title: "Ant",
  description,
  cleanUrls: true,
  // The repository README is not a page of the site.
  srcExclude: ["README.md"],
  sitemap: { hostname: "https://ant-lang.org" },
  appearance: "dark",
  lastUpdated: false,
  markdown: {
    languages: [...css, ...javascript, ant],
    theme: { light: antLight, dark: antDark },
    config(md) {
      // Inline examples may contain literal {{ and }}, as DAP logpoints do.
      const inlineCode = md.renderer.rules.code_inline!;
      md.renderer.rules.code_inline = (tokens, index, options, env, self) => {
        tokens[index].attrSet("v-pre", "");
        return inlineCode(tokens, index, options, env, self);
      };
    },
  },
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/favicon.png" }],
    ["meta", { name: "theme-color", content: "#7c3aed" }],
    ["meta", { property: "og:site_name", content: "Ant" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:image", content: "https://ant-lang.org/og.png" }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { property: "og:image:alt", content: "The Ant logo, a colorful ant, beside the word Ant" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["link", { rel: "alternate", type: "application/atom+xml", title: "Ant News", href: "/feed.xml" }],
  ],
  // GitHub Pages serves every page at /foo and /foo.html; the canonical link names the clean URL.
  transformPageData(pageData) {
    // A news post is a plain column of text, dark like the news index, with its title, date, and
    // summary from its frontmatter set above the text and its older and newer links below it
    // (theme/NewsPost.vue). Its summary is the page's description.
    if (/^news\/(?!index\.md$)[^/]+\.md$/.test(pageData.relativePath)) {
      Object.assign(pageData.frontmatter, {
        sidebar: false,
        aside: false,
        outline: false,
        editLink: false,
        prev: false,
        next: false,
        darkOnly: true,
        ...pageData.frontmatter,
      });
      pageData.description ||= pageData.frontmatter.summary ?? "";
    }
    const href = `https://ant-lang.org/${pageData.relativePath}`.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ["link", { rel: "canonical", href }],
      ["meta", { property: "og:url", content: href }],
      ["meta", { property: "og:title", content: pageData.title || "Ant" }],
      ["meta", { property: "og:description", content: pageData.description || description }],
    );
  },
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
      { text: "Install", link: "/docs/start/install" },
      docs.menu,
      {
        text: "Editors",
        items: [
          { text: "VS Code", link: "/vscode" },
          { text: "IntelliJ IDEA", link: "/intellij" },
          { text: "Neovim", link: "/nvim" },
          { text: "Ant Editor", link: "https://editor.ant-lang.org" },
        ],
      },
      { text: "News", link: "/news", activeMatch: "^/news" },
      { text: "Playground", link: "/playground" },
    ],
    sidebar: docs.sidebar,
    editLink: {
      pattern: ({ filePath }) =>
        filePath.startsWith("docs/")
          ? `https://github.com/ant-src/ant/edit/master/${filePath}`
          : `https://github.com/ant-src/ant-lang.org/edit/master/${filePath}`,
    },
    search: {
      provider: "local",
      options: {
        _render(src, env, md) {
          // Read search comments from rendered HTML so code examples cannot opt a page in or out.
          // Reference docs are searchable by default; other pages need <!-- search: true -->.
          const html = md.render(src, env);
          const search = /<!-- search: (true|false) -->/.exec(html)?.[1];
          if (search === "false") return "";
          if (search !== "true" && !/^docs\/(lib|language)\//.test(env.relativePath)) return "";
          // VitePress splits search results at headings. Keep only the page title as a boundary,
          // retaining subsection text in that result. This HTML is used only for the search index.
          return html.replace(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, "<p>$2</p>");
        },
      },
    },
    socialLinks: [{ icon: "github", link: "https://github.com/ant-src/ant" }],
  },
  // The news feed, beside the pages. It names posts by their address on the live site.
  async buildEnd({ outDir }) {
    const posts = toPosts(await createContentLoader(newsGlob, { render: true }).load());
    fs.writeFileSync(path.join(outDir, "feed.xml"), atomFeed(posts, "https://ant-lang.org"));
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
