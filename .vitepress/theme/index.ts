import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "@fontsource/commit-mono/400.css";
import "@fontsource/commit-mono/400-italic.css";
import "./custom.css";
import "./landing.css";
import EditorShots from "./EditorShots.vue";
import Preview from "./Preview.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("EditorShots", EditorShots);
    app.component("Preview", Preview);
  },
} satisfies Theme;
