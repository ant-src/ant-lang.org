// The site as an agent reads it. An agent asked to write Ant has, as a rule, never seen the
// language, so what it fetches first decides what it writes. After every build, writeLlms puts
// beside the pages:
//
// - llms.txt, in the format of llmstxt.org: the notes of llms.md, written by hand, with the program
//   that opens the docs, then a list of pages for each part of the docs.
// - docs/**/*.md, every docs page as Markdown, at the page's address with .md added. The links of
//   llms.txt go there, and each docs page names its Markdown in its head (config.mts).
// - llms-small.txt, the tour and Idiomatic Ant in one file: the language in one fetch.
// - llms-full.txt, every docs page in one file, for a tool that indexes the docs.
//
// The notes are most of the worth of llms.txt. The lists are a map, and they are kept short, a
// line to a page, because an agent reads all of llms.txt to use any of it. They are made from the
// pages, so a page added in ant shows up with nothing to do here. A page that no list leads to
// fails the build, and so does a link of llms.md to a page that is gone.

import fs from "node:fs";
import path from "node:path";
import { byName, type DocsPage } from "./docs";
import type { Post } from "./news";

type Item = { title: string; url: string; note?: string };

// The sections of the docs in the order llms-full.txt holds them: what teaches first, then what is
// looked up. A section not named here follows them.
const order = ["start", "tour", "guide", "howto", "coming-from", "design", "tools", "language", "lib"];

export function writeLlms(pages: DocsPage[], posts: Post[], outDir: string, origin: string): void {
  // A section's index page leads the section, and the index of the docs leads them all.
  const place = (dir: string) => (order.includes(dir) ? order.indexOf(dir) : order.length);
  const section = (page: DocsPage) => (page.file.includes("/") ? place(page.file.split("/")[0]) : -1);
  const key = (page: DocsPage) => page.file.replace(/(^|\/)index\.md$/, "$1");
  const docs = [...pages].sort((a, b) => section(a) - section(b) || byName(key(a), key(b)));

  const url = (page: DocsPage) => `${origin}/docs/${page.file}`;
  const get = (file: string) => {
    const page = docs.find((page) => page.file === file);
    if (!page) throw new Error(`llms: llms.txt is built around docs/${file}, which is gone`);
    return page;
  };
  const under = (dir: string) => docs.filter((page) => page.file.startsWith(`${dir}/`));
  // A page with a line on what it holds, and a page whose title says it: a tour step, a how-to.
  const item = (page: DocsPage, title = page.title): Item => ({ title, url: url(page), note: opening(page.markdown) });
  const named = (page: DocsPage): Item => ({ title: page.title, url: url(page) });

  // The library's index has a line on each namespace and topic guide, written in ant and better
  // than a first sentence. A page it leaves out follows the others.
  const library = (): Item[] => {
    const index = get("lib/index.md");
    const among = under("lib").filter((page) => /^lib\/(guides\/.+|[^/]+\/index)\.md$/.test(page.file));
    const items: Item[] = [item(index)];
    const lines = index.markdown
      .replace(/\n {2,}(?=\S)/g, " ")
      .matchAll(/^- \[([^\]]+)\]\(([^)\s]+)\)(?::\s+(.+))?$/gm);
    for (const [, title, link, note] of lines) {
      if (!among.some((page) => url(page) === link) || items.some((it) => it.url === link)) continue;
      items.push({ title, url: link, note: note && text(note) });
    }
    return [...items, ...among.filter((page) => !items.some((it) => it.url === url(page))).map((page) => item(page))];
  };

  const lists: [title: string, items: Item[]][] = [
    [
      "Get started",
      [
        item(get("index.md"), "Introduction"),
        ...under("start").map((page) => item(page)),
        ...under("coming-from").map((page) => item(page)),
      ],
    ],
    ["Tour", under("tour").map(named)],
    // The reference's index lists its pages, a line to each keyword, operator, literal, and type.
    ["Language", [...under("guide").map((page) => item(page)), item(get("language/index.md"))]],
    ["How-to guides", under("howto").map(named)],
    ["Tools", under("tools").map((page) => item(page))],
    // A namespace's page lists its functions and types.
    ["Standard library", library()],
    [
      // The name llmstxt.org gives the list a reader short of room can skip.
      "Optional",
      [
        ...under("design").map((page) => item(page)),
        ...posts.map((post) => ({
          title: post.version ? `Ant ${post.version}: ${post.title}` : post.title,
          url: `${origin}${post.url}`,
          note: post.summary,
        })),
        {
          title: "Source",
          url: "https://github.com/ant-src/ant",
          note: "The interpreter, the type checker, and the tools, written in Go, with the issues and the releases.",
        },
        {
          title: "Go package",
          url: "https://pkg.go.dev/github.com/ant-src/ant",
          note: "The API a Go program embeds Ant with.",
        },
        { title: "Ant for VS Code", url: `${origin}/vscode` },
        { title: "Ant for IntelliJ IDEA", url: `${origin}/intellij` },
        { title: "Ant for Neovim", url: `${origin}/nvim` },
      ],
    ],
  ];

  // A page is in a list, or under a directory whose index page is in one.
  const listed = new Set(lists.flatMap(([, items]) => items.map((it) => it.url)));
  const above = (file: string) =>
    file
      .split("/")
      .slice(0, -1)
      .map((_, i, dirs) => `${dirs.slice(0, i + 1).join("/")}/index.md`);
  for (const page of docs) {
    if ([page.file, ...above(page.file)].some((file) => listed.has(`${origin}/docs/${file}`))) continue;
    throw new Error(`llms: no list of llms.txt leads to docs/${page.file}; give its section a list in llms.ts`);
  }

  const small = bundle(
    "Ant in one file",
    `The tour of Ant, one concept on each of its pages, and the guide to idiomatic Ant. ` +
      `Every example is tested with Ant. A block of the tour with output under it is a whole program, ` +
      `and a line marked \`// error:\` or \`// panic:\` fails with the message in the comment. ` +
      `A block of the guide is part of a program. ` +
      `The index of the whole documentation is ${origin}/llms.txt.`,
    [...under("tour"), get("guide/idiomatic.md")],
    url,
  );
  const full = bundle(
    "Ant documentation",
    `Every page of ${origin}/docs in one file, ${docs.length} pages: the tour, the guides, the tools, ` +
      `the language reference, and a page for each function and type of the standard library. ` +
      `The index of these pages is ${origin}/llms.txt.`,
    docs,
    url,
  );

  // What llms.md leaves a place for: the program that opens the docs, with its output, which is a
  // page of Ant as it is written, tested in ant with the rest of the docs, and the sizes of the
  // two files, which an agent weighs before it fetches one. The program is the first block that
  // its output follows: no line between the fences of a block opens or closes another.
  const program = /^```ant\n(?:(?!```).*\n)*```\n+```text\n(?:(?!```).*\n)*```$/m.exec(get("index.md").markdown)?.[0];
  if (!program) throw new Error("llms: docs/index.md no longer shows a program and its output");
  const all = new Set(docs.map(url));
  const index = [
    notes(
      { program, small: size(small), full: size(full) },
      (link) => !link.startsWith(`${origin}/docs/`) || all.has(link.replace(/#.*/, "")),
    ),
    ...lists.map(
      ([title, items]) =>
        `## ${title}\n\n${items.map((it) => `- [${it.title}](${it.url})${it.note ? `: ${it.note}` : ""}`).join("\n")}`,
    ),
  ];

  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
    fs.writeFileSync(path.join(outDir, file), content);
  };
  for (const page of docs) write(`docs/${page.file}`, page.markdown);
  write("llms.txt", index.join("\n\n") + "\n");
  write("llms-small.txt", small);
  write("llms-full.txt", full);
}

// notes reads llms.md, the part of llms.txt written by hand, and fills its places: a comment such
// as <!-- program --> stands for what the build knows and the writer does not.
function notes(places: Record<string, string>, exists: (link: string) => boolean): string {
  const source = fs.readFileSync(path.join(import.meta.dirname, "llms.md"), "utf8").trim();
  for (const [, link] of source.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (!exists(link)) throw new Error(`llms: llms.md links ${link}, which is not a page of the docs`);
  }
  const known = Object.keys(places);
  return source.replace(/<!-- (.*?) -->/g, (place, name: string) => {
    if (!known.includes(name)) throw new Error(`llms: llms.md has ${place}, and the places are ${known}`);
    return places[name];
  });
}

// bundle joins pages into one file, a rule between them, each under its title with the address of
// its own Markdown, so a reader of a part can cite it and fetch it alone. The title is the line a
// page starts with, and no later line that looks like one, such as a comment in a shell block.
function bundle(title: string, summary: string, pages: DocsPage[], url: (page: DocsPage) => string): string {
  const parts = pages.map((page) =>
    page.markdown.trimEnd().replace(/^# .*/, (heading) => `${heading}\n\nSource: ${url(page)}`),
  );
  return [`# ${title}\n\n> ${summary}`, ...parts].join("\n\n---\n\n") + "\n";
}

// A link as its text alone.
const text = (markdown: string) => markdown.replace(/\[((?:[^\][]|\[[^\]]*\])*)\]\([^)\s]+\)/g, "$1");

// opening is how a page that opens with a paragraph begins: its first sentence, and the second
// too after a short first one. A page that opens with code, a list, or a table has none. The docs
// say first what a page is about.
function opening(markdown: string): string | undefined {
  const paragraph = markdown.split(/\n{2,}/)[1] ?? "";
  if (/^(`{3}|~{3}|[-*+] |\d+\. |[#|<>:])/.test(paragraph)) return undefined;
  const sentences = text(paragraph.replace(/\s+/g, " ")).match(/.*?(?<!\b(?:e\.g|i\.e|etc|vs))\.(?=\s|$)/g) ?? [];
  const first = sentences[0]?.trim();
  return first && first.length < 60 && sentences[1] ? first + sentences[1] : first;
}

// The size of a file as an agent weighs it: in bytes, and in tokens, at the three and a half bytes
// to a token that these pages come to. The unit follows the rounded number: 999,600 is 1.0 of the
// larger unit, not 1000 of the smaller.
function size(content: string): string {
  const bytes = Buffer.byteLength(content);
  const round = (n: number, small: string, large: string) =>
    n < 999_500 ? `${Math.round(n / 1e3)}${small}` : `${(n / 1e6).toFixed(1)}${large}`;
  return `${round(bytes, " KB", " MB")}, about ${round(bytes / 3.5, "k", "M")} tokens`;
}
