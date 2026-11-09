// The documentation lives in ant-src/ant under docs/, next to the code it describes, and is tested
// there. This module copies it into docs/ here when the site builds, ready for VitePress:
//
// - Pages still marked skeleton are left out, unless they hold the part generated from the prelude
//   (the signature and doc comment of a library function or type), which is worth reading alone.
//   A link to a page left out becomes plain text.
// - HTML comments go: the status, the brief, the generated markers, and the test directives are for
//   the people and the tests that write the pages, not for readers.
// - Fence info that only the tests read is dropped: ```ant signature becomes ```ant. A named block,
//   ```ant [geo.ant], becomes a code group of one, whose tab shows the file name.
//
// It returns the sidebar of the pages it copied.

import fs from "node:fs";
import path from "node:path";
import type { DefaultTheme } from "vitepress";

type Page = { file: string; title: string; markdown: string };

// Pages sort by file name, except those named here, which come first, in this order.
const first = ["start/install.md", "start/editors.md", "start/first-program.md"];

// The sections of docs/README.md, in its order.
const sections: [dir: string, title: string][] = [
  ["start", "Get started"],
  ["tour", "Tour"],
  ["guide", "Language guide"],
  ["howto", "How-to guides"],
  ["coming-from", "Coming from"],
  ["tools", "Tools"],
  ["language", "Language reference"],
  ["lib", "Standard library"],
  ["design", "Design notes"],
];

export function syncDocs(from: string, to: string): DefaultTheme.SidebarMulti {
  if (!fs.existsSync(path.join(from, "README.md"))) {
    throw new Error(`docs: no Ant docs in ${from}; check out ant-src/ant beside this repository or set ANT_DOCS`);
  }
  const pages = new Map<string, Page>();
  for (const file of fs.readdirSync(from, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const markdown = fs.readFileSync(path.join(from, file), "utf8");
    const status = /^<!-- status: (\w+) -->/.exec(markdown)?.[1];
    if (status === "skeleton" && !markdown.includes("<!-- generated from ")) continue;
    const name = file.split(path.sep).join("/");
    pages.set(name, { file: name, title: /^# (.+)$/m.exec(markdown)?.[1] ?? name, markdown });
  }

  fs.rmSync(to, { recursive: true, force: true });
  for (const page of pages.values()) {
    const out = path.join(to, page.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(page, pages));
  }
  return sidebar(pages);
}

// render rewrites a page for the site, leaving the inside of code blocks as it is.
function render(page: Page, pages: Map<string, Page>): string {
  const dir = path.posix.dirname(page.file);
  const prose = (text: string) =>
    text
      .replace(/<!--[\s\S]*?-->\n?/g, "")
      .replace(/(!?)\[((?:[^\][]|\[[^\]]*\])*)\]\(([^)\s]+)\)/g, (link, image, text, url) => {
        if (image || /^[a-z]+:|^\/|^#/.test(url)) return link;
        const target = path.posix.normalize(path.posix.join(dir, url.replace(/#.*/, "")));
        return pages.has(target) ? link : text;
      })
      .replace(/\n{3,}/g, "\n\n");

  let out = "";
  let text = "";
  let fence = ""; // the open fence's marker, such as ``` or ````
  let named = false; // whether the open fence names a file, as ```ant [geo.ant] does
  for (const line of page.markdown.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) {
      // A code group of one shows the file name of a named block as its tab.
      named = /^[`~]+\w+ \[[^\]]+\]\s*$/.test(line);
      out += prose(text) + (named ? "::: code-group\n\n" : "") + line.replace(/^( {0,3}[`~]+ant) signature\b/, "$1");
      text = "";
      fence = marker;
    } else if (fence) {
      out += line;
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length)) {
        out += named ? "\n:::\n" : "";
        fence = "";
      }
    } else {
      text += line;
    }
  }
  out += prose(text);
  return out.replace(/^\n+/, "");
}

function sidebar(pages: Map<string, Page>): DefaultTheme.SidebarMulti {
  const link = (file: string) => "/docs/" + file.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
  const items = (files: string[]) =>
    files.sort(byName).map((file) => ({ text: pages.get(file)!.title, link: link(file) }));
  const under = (dir: string) => [...pages.keys()].filter((file) => file.startsWith(dir + "/"));

  // A section lists its pages, and a group for each subdirectory, such as howto/files/.
  const section = (dir: string, text: string): DefaultTheme.SidebarItem => {
    const files = under(dir);
    const direct = files.filter((file) => !file.slice(dir.length + 1).includes("/"));
    const subdirs = [...new Set(files.map((file) => file.split("/")[1]))].filter((sub) => !sub.endsWith(".md"));
    return {
      text,
      link: pages.has(`${dir}/index.md`) ? link(`${dir}/index.md`) : undefined,
      collapsed: dir === "lib" ? true : undefined,
      items: [
        ...items(direct.filter((file) => !file.endsWith("/index.md"))),
        ...subdirs.sort(byName).map((sub) => section(`${dir}/${sub}`, title(`${dir}/${sub}`, pages))),
      ],
    };
  };

  // The library is too large for one sidebar: a namespace's pages get their own, and the main one
  // lists the namespaces.
  const namespaces = [...new Set(under("lib").map((file) => file.split("/")[1]))]
    .filter((ns) => !ns.endsWith(".md") && ns !== "guides")
    .sort(byName);
  const libGroup: DefaultTheme.SidebarItem = {
    text: "Standard library",
    link: pages.has("lib/index.md") ? link("lib/index.md") : undefined,
    items: [
      ...(under("lib/guides").length ? [section("lib/guides", "Guides")] : []),
      ...namespaces.map((ns) => ({ text: ns, link: link(`lib/${ns}/index.md`) })),
    ],
  };

  const main = sections
    .filter(([dir]) => under(dir).length > 0)
    .map(([dir, text]) => (dir === "lib" ? { ...libGroup, collapsed: true } : section(dir, text)));
  const result: DefaultTheme.SidebarMulti = { "/docs/": main };
  for (const ns of namespaces) {
    const files = under(`lib/${ns}`).filter((file) => !file.endsWith("/index.md"));
    result[`/docs/lib/${ns}/`] = [
      { ...libGroup, collapsed: true },
      {
        text: ns,
        link: link(`lib/${ns}/index.md`),
        items: items(files.filter((file) => !file.includes("/types/"))),
      },
      ...(files.some((file) => file.includes("/types/"))
        ? [{ text: "Types", items: items(files.filter((file) => file.includes("/types/"))) }]
        : []),
    ];
  }
  return result;
}

// title names a directory by its index page, or by its name.
function title(dir: string, pages: Map<string, Page>): string {
  const name = dir.split("/").pop()!;
  return pages.get(`${dir}/index.md`)?.title ?? name[0].toUpperCase() + name.slice(1).replace(/-/g, " ");
}

function byName(a: string, b: string): number {
  const rank = (file: string) => (first.includes(file) ? first.indexOf(file) : first.length);
  return rank(a) - rank(b) || a.localeCompare(b, "en", { sensitivity: "base" });
}
