import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "@fontsource/commit-mono/400.css";
import "@fontsource/commit-mono/400-italic.css";
import "./custom.css";
import "./home.css";
import Feature from "./Feature.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Feature", Feature);
  },
} satisfies Theme;
