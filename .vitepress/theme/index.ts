import type { Theme } from "vitepress";
import { inBrowser, useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { watchEffect } from "vue";
import "@fontsource/commit-mono/400.css";
import "@fontsource/commit-mono/400-italic.css";
import "./custom.css";
import "./landing.css";
import AntTrail from "./AntTrail.vue";
import EditorShots from "./EditorShots.vue";
import Preview from "./Preview.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("AntTrail", AntTrail);
    app.component("EditorShots", EditorShots);
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
