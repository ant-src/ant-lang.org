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
    // classes from the script config.mts puts in the page's head.
    const { frontmatter, isDark } = useData();
    if (!inBrowser) return;
    watchEffect(() => {
      const darkOnly = frontmatter.value.darkOnly === true;
      const root = document.documentElement;
      root.classList.toggle("dark-only", darkOnly);
      root.classList.toggle("dark", darkOnly || isDark.value);
    });
  },
} satisfies Theme;
