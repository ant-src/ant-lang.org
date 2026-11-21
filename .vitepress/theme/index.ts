import type { Theme } from "vitepress";
import { inBrowser, useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h, watchEffect } from "vue";
import "@fontsource/commit-mono/400.css";
import "@fontsource/commit-mono/400-italic.css";
// Newsreader sets the headlines of the news index, with its optical sizes.
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./custom.css";
import "./landing.css";
import "./news.css";
import AntTrail from "./AntTrail.vue";
import EditorShots from "./EditorShots.vue";
import NewsIndex from "./NewsIndex.vue";
import NewsPost from "./NewsPost.vue";
import Preview from "./Preview.vue";
import SiteFooter from "./SiteFooter.vue";

export default {
  extends: DefaultTheme,
  // The site's own footer takes the place of the default theme's, on every page. A news post gets
  // its header and its older and newer links around its text.
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-before": () => h(NewsPost, { part: "header" }),
      "doc-after": () => h(NewsPost, { part: "footer" }),
      "layout-bottom": () => h(SiteFooter),
    }),
  enhanceApp({ app }) {
    app.component("AntTrail", AntTrail);
    app.component("EditorShots", EditorShots);
    app.component("NewsIndex", NewsIndex);
    app.component("Preview", Preview);
  },
  setup() {
    // A page whose frontmatter sets darkOnly is always dark and hides the appearance switch, but
    // leaves the reader's choice as it was for the other pages. The first paint gets the same
    // classes from the script config.mts puts in its head.
    const { frontmatter, isDark } = useData();
    if (!inBrowser) return;
    const root = document.documentElement;
    const darkOnly = () => frontmatter.value.darkOnly === true;
    watchEffect(() => {
      root.classList.toggle("dark-only", darkOnly());
      root.classList.toggle("dark", darkOnly() || isDark.value);
    });
    // VitePress writes the dark class itself whenever the reader's mode changes, as when the
    // system turns light under "auto", and it writes it after the effect above: put it back.
    new MutationObserver(() => {
      if (darkOnly() && !root.classList.contains("dark")) root.classList.add("dark");
    }).observe(root, { attributes: true, attributeFilter: ["class"] });
  },
} satisfies Theme;
