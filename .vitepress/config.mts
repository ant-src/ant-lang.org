import { defineConfig } from "vitepress";
import type { Plugin } from "vite";

// The playground compiles ant.wasm once and hands the module to its workers, so the default URL
// in @ant-lang/wasm, which would copy ant.wasm into every worker's bundle, goes unused: drop it.
function oneAntWasm(): Plugin {
  return {
    name: "one-ant-wasm",
    transform(code, id) {
      if (!/@ant-lang[/\\]wasm[/\\]index\.js$|packages[/\\]wasm[/\\]index\.js$/.test(id)) return;
      return code.replace('new URL("./ant.wasm", import.meta.url)', "undefined");
    },
  };
}

export default defineConfig({
  title: "Ant",
  description: "Static types, goroutines, and nothing left undefined.",
  cleanUrls: true,
  lastUpdated: false,
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
