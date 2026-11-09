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
// - Until lib/index.md is written, a list of the namespaces stands in for it.
//
// It returns the navigation of the pages it copied: a sidebar for each area of the docs, and the
// Docs menu that leads to them.

import fs from "node:fs";
import path from "node:path";
import type { DefaultTheme } from "vitepress";

type Page = { file: string; title: string; markdown: string };

export type DocsNav = { sidebar: DefaultTheme.SidebarMulti; menu: DefaultTheme.NavItemWithChildren };

// Pages sort by file name, except those named here, which come first, in this order.
const first = ["start/install.md", "start/editors.md", "start/first-program.md"];

// The sections of docs/README.md, as the Docs menu lists them.
type Section = [dir: string, title: string];
const learn: Section[] = [
  ["start", "Get started"],
  ["tour", "Tour"],
  ["guide", "Language guide"],
  ["howto", "How-to guides"],
  ["coming-from", "Coming from"],
  ["design", "Design notes"],
];
const reference: Section[] = [
  ["language", "Language reference"],
  ["lib", "Standard library"],
  ["tools", "Tools"],
];

// Each area has a sidebar of its own, which lists the sections in it. The library is an area apart:
// its main page lists the namespaces, and each namespace has its own sidebar.
const areas = [["start", "tour"], ["guide", "coming-from", "design"], ["howto"], ["language", "tools"]];
const sectionTitles = new Map([...learn, ...reference]);
for (const [dir] of [...learn, ...reference]) {
  if (dir !== "lib" && areas.flat().filter((d) => d === dir).length !== 1) {
    throw new Error(`docs: section ${dir} must be in exactly one area`);
  }
}

// The namespaces of the library by job, until lib/index.md groups them. A namespace not named here
// is listed under Other.
const libGroups: [title: string, namespaces: string[]][] = [
  [
    "Core",
    ["prelude", "Array", "Map", "Set", "Iter", "Record", "String", "Bytes", "Math", "Bits", "Random", "Regex", "Time"],
  ],
  ["Errors", ["Result", "Error", "Panic"]],
  ["Concurrency", ["Channel", "Parallel", "Context", "Mutex", "RwMutex", "Cond", "Once", "WaitGroup", "Atomic"]],
  ["Files and the system", ["File", "Path", "Os", "Cmd"]],
  ["Network", ["Net", "Http", "Url"]],
  ["Data formats", ["Json", "Csv", "Encoding", "Html", "Crypto"]],
  ["Tooling", ["Test", "Reflect"]],
];

export function syncDocs(from: string, to: string): DocsNav {
  if (!fs.existsSync(path.join(from, "README.md"))) {
    throw new Error(`docs: no Ant docs in ${from}; check out ant-src/ant beside this repository or set ANT_DOCS`);
  }
  const pages = new Map<string, Page>();
  for (const file of fs.readdirSync(from, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const markdown = fs.readFileSync(path.join(from, file), "utf8");
    const status = /^\uFEFF?\s*<!-- status: (\w+) -->/.exec(markdown)?.[1];
    if (status === "skeleton" && !markdown.includes("<!-- generated from ")) continue;
    const name = file.split(path.sep).join("/");
    pages.set(name, { file: name, title: /^# (.+)$/m.exec(markdown)?.[1] ?? name, markdown });
  }
  if (!pages.has("lib/index.md")) {
    pages.set("lib/index.md", { file: "lib/index.md", title: "Standard library", markdown: libIndex(pages) });
  }

  fs.rmSync(to, { recursive: true, force: true });
  for (const page of pages.values()) {
    const out = path.join(to, page.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(page, pages));
  }
  return nav(pages);
}

// render rewrites a page for the site, leaving the inside of code blocks as it is.
function render(page: Page, pages: Map<string, Page>): string {
  const dir = path.posix.dirname(page.file);
  // Comments go and links change in prose only: a code span, such as `<!-- end generated -->`, is
  // set aside first. Whichever starts first, a comment or a code span, takes the text it covers.
  const prose = (text: string) => {
    const spans: string[] = [];
    return text
      .replace(/<!--[\s\S]*?-->\n?|(?<!`)(`+)(?!`)(?:[^\n]|\n(?![ \t]*\n))*?(?<!`)\1(?!`)/g, (match, ticks) =>
        ticks ? `\0${spans.push(match) - 1}\0` : "",
      )
      .replace(/(!?)\[((?:[^\][]|\[[^\]]*\])*)\]\(([^)\s]+)\)/g, (link, image, text, url) => {
        if (image || /^[a-z]+:|^\/|^#/.test(url)) return link;
        const target = path.posix.normalize(path.posix.join(dir, url.replace(/#.*/, "")));
        return pages.has(target) ? link : text;
      })
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\0(\d+)\0/g, (_, i) => spans[Number(i)]);
  };

  let out = "";
  let text = "";
  let fence = ""; // the open fence's marker, such as ``` or ````
  // The indent of the code group around the open fence, when the fence names a file; null otherwise.
  let group: string | null = null;
  const closeGroup = () => (group === null ? "" : `\n${group}:::\n`);
  for (const line of page.markdown.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (!fence && marker) {
      // A code group of one shows the file name of a named block as its tab.
      group = /^( {0,3})[`~]+\w+ \[[^\]]+\]\s*$/.exec(line)?.[1] ?? null;
      out += prose(text) + (group === null ? "" : `${group}::: code-group\n\n`);
      out += line.replace(/^( {0,3}[`~]+ant) signature\b/, "$1");
      text = "";
      fence = marker;
    } else if (fence) {
      out += line;
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length)) {
        out += closeGroup();
        fence = "";
      }
    } else {
      text += line;
    }
  }
  // A fence left open runs to the end of the page, and so does its code group.
  out += fence ? closeGroup() : prose(text);
  return out.replace(/^\n+/, "");
}

function nav(pages: Map<string, Page>): DocsNav {
  const link = (file: string) => "/docs/" + file.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
  const item = (file: string, text = pages.get(file)!.title) => ({ text, link: link(file) });
  const under = (dir: string) => [...pages.keys()].filter((file) => file.startsWith(dir + "/"));

  // A section lists its pages, and a collapsed group for each subdirectory, such as howto/files/.
  const section = (dir: string, text: string): DefaultTheme.SidebarItem => {
    const files = under(dir);
    const direct = files.filter((file) => !file.slice(dir.length + 1).includes("/"));
    const subdirs = new Set(
      files
        .map((file) => file.slice(dir.length + 1).split("/"))
        .flatMap((parts) => (parts.length > 1 ? [parts[0]] : [])),
    );
    return {
      text,
      link: pages.has(`${dir}/index.md`) ? link(`${dir}/index.md`) : undefined,
      items: [
        ...direct
          .filter((file) => !file.endsWith("/index.md"))
          .sort(byName)
          .map((file) => item(file)),
        ...[...subdirs]
          .sort(byName)
          .map((sub) => ({ ...section(`${dir}/${sub}`, title(`${dir}/${sub}`, pages)), collapsed: true })),
      ],
    };
  };
  // The page a section starts at: its index, or its first page.
  const start = (dir: string): string | undefined => {
    if (pages.has(`${dir}/index.md`)) return link(`${dir}/index.md`);
    const first = (items: DefaultTheme.SidebarItem[]): string | undefined =>
      items.map((it) => it.link ?? first(it.items ?? [])).find(Boolean);
    return first(section(dir, "").items ?? []);
  };

  const sidebar: DefaultTheme.SidebarMulti = {};
  for (const area of areas) {
    const groups = area.filter((dir) => under(dir).length > 0).map((dir) => section(dir, sectionTitles.get(dir)!));
    for (const dir of area) sidebar[`/docs/${dir}/`] = groups;
  }
  sidebar["/docs/"] = sidebar["/docs/start/"];

  const namespaces = libNamespaces(pages);
  const back = { text: "‹ Standard library", link: link("lib/index.md") };
  sidebar["/docs/lib/"] = [
    ...(under("lib/guides").length ? [section("lib/guides", "Guides")] : []),
    ...groupNamespaces(namespaces).map(([text, list]) => ({
      text,
      items: list.map((ns) => item(`lib/${ns}/index.md`)),
    })),
  ];
  for (const ns of namespaces) {
    const short = (file: string) => item(file, pages.get(file)!.title.replace(`${ns}.`, ""));
    const files = under(`lib/${ns}`).filter((file) => !file.endsWith("/index.md"));
    const jobs = functionsByJob(ns, pages);
    const placed = new Set(jobs.flatMap(([, list]) => list));
    const functions = files.filter((file) => !file.includes("/types/") && !placed.has(file)).sort(byName);
    const types = files.filter((file) => file.includes("/types/") && !placed.has(file)).sort(byName);
    sidebar[`/docs/lib/${ns}/`] = [
      back,
      {
        text: pages.get(`lib/${ns}/index.md`)!.title,
        link: link(`lib/${ns}/index.md`),
        items: jobs.length
          ? [
              ...jobs.map(([text, list]) => ({ text, collapsed: true, items: list.map(short) })),
              ...(functions.length ? [{ text: "Other", collapsed: true, items: functions.map(short) }] : []),
            ]
          : functions.map(short),
      },
      ...(types.length ? [{ text: "Types", items: types.map(short) }] : []),
    ];
  }

  // The Docs menu: a link to each section that has pages, in two groups.
  const menuGroup = (text: string, sections: Section[]) => ({
    text,
    items: sections.map(([dir, title]) => ({ text: title, link: start(dir)! })).filter((it) => it.link !== undefined),
  });
  const menu = {
    text: "Docs",
    activeMatch: "^/docs/",
    items: [menuGroup("Learn", learn), menuGroup("Reference", reference)],
  };
  return { sidebar, menu };
}

function libNamespaces(pages: Map<string, Page>): string[] {
  return [...new Set([...pages.keys()].map((file) => /^lib\/([^/]+)\/index\.md$/.exec(file)?.[1]))]
    .filter((ns): ns is string => ns !== undefined && ns !== "guides")
    .sort(byName);
}

function groupNamespaces(namespaces: string[]): [string, string[]][] {
  const named = new Set(libGroups.flatMap(([, list]) => list));
  return [...libGroups, ["Other", namespaces.filter((ns) => !named.has(ns))] as [string, string[]]]
    .map(([text, list]): [string, string[]] => [text, list.filter((ns) => namespaces.includes(ns))])
    .filter(([, list]) => list.length > 0);
}

// functionsByJob reads the groups of a namespace page's "Functions by job" section: each third-level
// heading and the pages of the namespace its list links.
function functionsByJob(ns: string, pages: Map<string, Page>): [string, string[]][] {
  const index = pages.get(`lib/${ns}/index.md`)?.markdown ?? "";
  const section = /^## Functions by job\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(index)?.[1] ?? "";
  return section
    .split(/^### /m)
    .slice(1)
    .map((part): [string, string[]] => {
      const [heading, ...rest] = part.split("\n");
      const files = [...rest.join("\n").matchAll(/\]\(([^)#\s]+\.md)/g)]
        .map((m) => path.posix.normalize(`lib/${ns}/${m[1]}`))
        .filter((file) => file.startsWith(`lib/${ns}/`) && pages.has(file) && !file.endsWith("/index.md"));
      return [heading.trim(), [...new Set(files)]];
    })
    .filter(([, files]) => files.length > 0);
}

// libIndex writes a page that lists the namespaces of the library, by job, each with the first
// sentence of its doc comment.
function libIndex(pages: Map<string, Page>): string {
  let out = "# Standard library\n";
  for (const [text, list] of groupNamespaces(libNamespaces(pages))) {
    out += `\n## ${text}\n\n`;
    for (const ns of list) {
      const generated = /^# .*\n([\s\S]*?)<!-- end generated -->/m.exec(pages.get(`lib/${ns}/index.md`)!.markdown);
      const doc = generated?.[1].replace(/^```[\s\S]*?^```$/gm, "").trim();
      // The doc's links are relative to the namespace's directory.
      const sentence = doc
        ?.replace(/\s+/g, " ")
        .match(/^.*?(?<!\b(?:e\.g|i\.e|etc|vs))\.(?=\s|$)/)?.[0]
        .replace(/\]\((?![a-z]+:|\/|#)/g, `](${ns}/`);
      out += `- [${pages.get(`lib/${ns}/index.md`)!.title}](${ns}/index.md)${sentence ? `: ${sentence}` : ""}\n`;
    }
  }
  return out;
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
