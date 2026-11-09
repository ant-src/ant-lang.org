<script setup lang="ts">
// The site's footer, after Apple's: a directory of link columns, then a line of fine print. On
// narrow screens each column folds behind its heading, which opens and closes it. A page whose
// frontmatter sets footer to false, the playground, has none.
import { useData } from "vitepress";
import { useSidebar } from "vitepress/theme";
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";

type Link = { text: string; link: string };
type Column = { title: string; links: Link[] };

const { frontmatter, theme } = useData();

// Learn and Reference follow the Docs menu, which lists the sections of the docs that have pages,
// so the footer never links a section that is not written yet.
type NavEntry = { text?: string; link?: string; items?: NavEntry[] };
const docsGroup = (title: string): Link[] => {
  const docs = (theme.value.nav as NavEntry[]).find((item) => item.text === "Docs");
  const group = docs?.items?.find((item) => item.text === title);
  return (group?.items ?? []).flatMap(({ text, link }) => (text && link ? [{ text, link }] : []));
};

const install = "/docs/start/install";
const columns = computed((): Column[] => [
  {
    title: "Learn",
    links: [
      { text: "Install", link: install },
      ...docsGroup("Learn").filter((item) => item.link !== install),
      { text: "Playground", link: "/playground" },
    ],
  },
  { title: "Reference", links: docsGroup("Reference") },
  {
    title: "Editors",
    links: [
      { text: "VS Code", link: "/vscode" },
      { text: "IntelliJ IDEA", link: "/intellij" },
      { text: "Neovim", link: "/nvim" },
    ],
  },
  {
    // For running Ant inside a Go program or a web page.
    title: "Embed",
    links: [
      { text: "Go package", link: "https://pkg.go.dev/github.com/ant-src/ant" },
      { text: "@ant-lang/wasm", link: "https://www.npmjs.com/package/@ant-lang/wasm" },
      { text: "@ant-lang/monaco", link: "https://www.npmjs.com/package/@ant-lang/monaco" },
    ],
  },
  {
    title: "Project",
    links: [
      { text: "Ask a question", link: "https://github.com/ant-src/ant/discussions" },
      { text: "Report a bug", link: "https://github.com/ant-src/ant/issues/new" },
      { text: "Releases", link: "https://github.com/ant-src/ant/releases" },
      { text: "Source", link: "https://github.com/ant-src/ant" },
    ],
  },
]);
const { hasSidebar } = useSidebar();

// The year the site was built, so the copyright stays current without an edit each January.
declare const __BUILD_YEAR__: number;
const years = __BUILD_YEAR__ > 2026 ? `2026–${__BUILD_YEAR__}` : "2026";

const isExternal = (link: string) => /^https?:/.test(link);

// The columns fold only on narrow screens, and only once the script runs: the headings become
// buttons and the lists fold together, so a list is never hidden without a button to open it.
// Until then, or without the script, every link shows. The CSS stacks the columns at the same
// width, @media (max-width: 767px); a mismatch would only misplace the fold, never hide a link.
const narrow = ref(false);
const open = reactive<Record<string, boolean>>({});
let query: MediaQueryList | undefined;
const update = () => (narrow.value = query!.matches);

onMounted(() => {
  query = window.matchMedia("(max-width: 767px)");
  update();
  query.addEventListener("change", update);
});
onUnmounted(() => query?.removeEventListener("change", update));
</script>

<template>
  <footer v-if="frontmatter.footer !== false" class="site-footer" :class="{ 'has-sidebar': hasSidebar }">
    <div class="container">
      <nav class="directory" :class="{ foldable: narrow }" aria-label="Site">
        <section
          v-for="(column, i) in columns"
          :key="column.title"
          class="column"
          :class="{ open: open[column.title] }"
        >
          <h3 class="title">
            <button
              v-if="narrow"
              type="button"
              class="toggle"
              :aria-expanded="!!open[column.title]"
              :aria-controls="`footer-links-${i}`"
              @click="open[column.title] = !open[column.title]"
            >
              {{ column.title }}
            </button>
            <template v-else>{{ column.title }}</template>
          </h3>
          <ul :id="`footer-links-${i}`" class="links">
            <li v-for="item in column.links" :key="item.link">
              <a
                :href="item.link"
                :target="isExternal(item.link) ? '_blank' : undefined"
                :rel="isExternal(item.link) ? 'noreferrer' : undefined"
                >{{ item.text }}</a
              >
            </li>
          </ul>
        </section>
      </nav>

      <div class="legal">
        <p class="copyright">Copyright © {{ years }} Anton Medvedev</p>
        <ul class="legal-links">
          <li>
            <a href="https://github.com/ant-src/ant/blob/master/LICENSE" target="_blank" rel="noreferrer"
              >MIT License</a
            >
          </li>
        </ul>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  --footer-bg: #f5f5f7;
  --footer-ink: #1d1d1f;
  --footer-ink-2: #6e6e73;
  --footer-line: #d2d2d7;
  position: relative;
  /* Above the anthill on the home page, which reaches down past its section, and above the fade
     at the foot of a docs page's outline, which is fixed to the bottom of the screen. */
  z-index: calc(var(--vp-z-index-footer) + 1);
  background: var(--footer-bg);
  color: var(--footer-ink-2);
  font-size: 12px;
  line-height: 1.33;
}

.dark .site-footer {
  --footer-bg: #161617;
  --footer-ink: #e8e8ed;
  --footer-ink-2: #86868b;
  --footer-line: #424245;
}

.container {
  max-width: 1152px;
  margin: 0 auto;
  padding: 40px 24px 24px;
}

/* Docs pages keep their sidebar on the left; the footer sits beside it, as the content does. */
@media (min-width: 960px) {
  .site-footer.has-sidebar {
    padding-left: var(--vp-sidebar-width);
  }
}

@media (min-width: 1440px) {
  .site-footer.has-sidebar {
    padding-left: calc((100vw - var(--vp-layout-max-width)) / 2 + var(--vp-sidebar-width));
    padding-right: calc((100vw - var(--vp-layout-max-width)) / 2);
  }
}

.directory {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 24px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--footer-line);
}

.title {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.33;
  font-weight: 600;
  color: var(--footer-ink);
  letter-spacing: -0.01em;
}

.links {
  margin: 0;
  padding: 0;
  list-style: none;
}

.links li + li {
  margin-top: 10px;
}

a {
  color: var(--footer-ink-2);
  text-decoration: none;
  transition: color 0.2s;
}

a:hover {
  color: var(--footer-ink);
  text-decoration: underline;
}

.legal {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 24px;
  padding-top: 16px;
}

.copyright {
  margin: 0;
}

.legal-links {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legal-links li + li {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--footer-line);
}

@media (max-width: 959px) {
  .directory {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 32px;
  }
}

/* Narrow screens: the columns stack, each folded behind its heading. */
@media (max-width: 767px) {
  .container {
    padding-top: 16px;
  }

  .directory {
    display: block;
    padding-bottom: 0;
    border-bottom: 0;
  }

  .column {
    border-bottom: 1px solid var(--footer-line);
  }

  .title {
    margin: 0;
    padding: 12px 0;
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin: -12px 0;
    padding: 12px 0;
    font: inherit;
    color: inherit;
    text-align: left;
  }

  /* A chevron that points down when folded and up when open. */
  .toggle::after {
    content: "";
    width: 7px;
    height: 7px;
    margin-right: 4px;
    border-right: 1.5px solid var(--footer-ink-2);
    border-bottom: 1.5px solid var(--footer-ink-2);
    transform: translateY(-2px) rotate(45deg);
    transition: transform 0.2s;
  }

  .open .toggle::after {
    transform: translateY(2px) rotate(-135deg);
  }

  .links {
    padding: 0 0 16px 12px;
  }

  .foldable .column:not(.open) .links {
    display: none;
  }

  .links li + li {
    margin-top: 12px;
  }

  .links a {
    font-size: 14px;
  }

  .legal {
    flex-direction: column;
    padding-top: 24px;
  }
}
</style>
