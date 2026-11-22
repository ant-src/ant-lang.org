// The images of the news posts, which a link to a post shows where it is shared: one PNG per post,
// at og/news/<post>.png beside the pages, written by config.mts after every build, so a new post
// gets its image with nothing more to do. Each is the news page in small: the black of the news
// pages, the logo, the post's date and version, its title and summary in Inter, and the first
// lines of its lead code (news.ts) in Commit Mono, in a panel that runs off the bottom edge.
//
// Satori lays the image out from a tree of boxes, as an SVG, and resvg draws the SVG as a PNG.
// Satori reads fonts as WOFF, not WOFF2, so the fonts come from their @fontsource packages, which
// cover Latin, accented Latin included, and general punctuation, but not arrows or other symbols.
// The code is the lead's <pre> as the post renders it, in the colors of the site's dark theme.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { antDark } from "./ant-theme";
import { formatDate, leadCode, type Post } from "./news";

export const ogSize = { width: 1200, height: 630 };

// Where the image of a post is served, from the post's path under the site, as a page names it
// (news/ant-0-3.md) or as a post's url does (/news/ant-0-3): /og/news/ant-0-3.png.
export const ogImagePath = (page: string) => `/og/${page.replace(/^\//, "").replace(/\.(md|html)$/, "")}.png`;

// The image's margin, and the width of everything inside it.
const margin = 72;
const inner = ogSize.width - 2 * margin;

const ink = "#f5f5f7";
const ink2 = "#a1a1a6";
const ink3 = "#6e6e73";
const panel = "#141416";
const line = "rgba(255, 255, 255, 0.1)";
const codeInk = antDark.colors?.["editor.foreground"] ?? ink;

// The lines of lead code an image shows, and how many columns a line may fill before it is cut.
const codeLines = 6;
const codeColumns = 74;

const require = createRequire(import.meta.url);
const file = (module: string) => fs.readFileSync(require.resolve(module));

// Satori's font parser assigns an undeclared variable when it reads an ltag table, which Commit
// Mono has, and throws. The table only names languages for the font's names: rename it in the
// WOFF's table directory, 20-byte entries after a 44-byte header, and the parser passes it by.
function withoutLtag(woff: Buffer): Buffer {
  const font = Buffer.from(woff);
  for (let i = 0, n = font.readUInt16BE(12); i < n; i++) {
    const entry = 44 + i * 20;
    if (font.toString("latin1", entry, entry + 4) === "ltag") font.write("xtag", entry, "latin1");
  }
  return font;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (html: string) =>
  html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) =>
    name[0] !== "#"
      ? (entities[name] ?? entity)
      : String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))),
  );

type Run = { text: string; color: string };

// The first lines of a highlighted <pre>, each its runs of text in their dark-theme colors, cut
// with an ellipsis where a line runs past codeColumns. Text without a color of its own is the
// theme's foreground.
function codeRows(pre: string): Run[][] {
  const code = pre.slice(pre.indexOf("<code>") + "<code>".length, pre.lastIndexOf("</code>"));
  return code
    .split("\n")
    .slice(0, codeLines)
    .map((html) => {
      const runs = [...html.matchAll(/<span(?: style="([^"]*)")?>([^<]*)<\/span>/g)].map(([, style, text]) => ({
        text: decode(text).replace(/\t/g, "    "),
        color: /--shiki-dark:(#[0-9a-f]+)/i.exec(style ?? "")?.[1] ?? codeInk,
      }));
      const columns = runs.reduce((sum, run) => sum + [...run.text].length, 0);
      if (columns <= codeColumns) return runs;
      const cut: Run[] = [];
      let left = codeColumns - 1;
      for (const run of runs) {
        const chars = [...run.text];
        cut.push({ text: chars.slice(0, left).join(""), color: run.color });
        left -= chars.length;
        if (left <= 0) break;
      }
      cut.push({ text: "…", color: ink3 });
      return cut;
    });
}

type Node = { type: string; props: { style?: Record<string, unknown>; children?: Child | Child[]; src?: string } };
type Child = Node | string;

const box = (style: Record<string, unknown>, children?: Child | Child[]): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

// Inter's files of one weight: Latin and accented Latin.
const inter = (weight: 400 | 600 | 700) =>
  ["latin", "latin-ext"].map((subset) => ({
    name: "Inter",
    data: file(`@fontsource/inter/files/inter-${subset}-${weight}-normal.woff`),
    weight,
  }));

// Every post's image, from the post and its rendered html.
export async function writeNewsImages(posts: Post[], outDir: string): Promise<void> {
  const fonts = [
    ...inter(400),
    ...inter(600),
    ...inter(700),
    {
      name: "Commit Mono",
      data: withoutLtag(file("@fontsource/commit-mono/files/commit-mono-latin-400-normal.woff")),
      weight: 400 as const,
    },
  ];
  const logo = `data:image/png;base64,${fs.readFileSync(path.join(import.meta.dirname, "../public/logo.png")).toString("base64")}`;

  for (const post of posts) {
    const lead = post.html ? leadCode(post.html) : undefined;
    const rows = lead ? codeRows(lead) : [];
    const meta = [post.version && `Ant ${post.version}`, formatDate(post.date, "long")].filter(Boolean).join(" · ");
    const tree = box(
      {
        width: "100%",
        height: "100%",
        flexDirection: "column",
        padding: `56px ${margin}px 0`,
        background: "#000",
        color: ink,
        fontFamily: "Inter",
      },
      [
        box({ alignItems: "center", gap: 14 }, [
          { type: "img", props: { src: logo, style: { width: 44, height: 44 } } },
          box({ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }, "Ant"),
          box({ fontSize: 28, color: ink3 }, "News"),
        ]),
        box(
          {
            marginTop: 44,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: ink3,
          },
          meta,
        ),
        box(
          {
            marginTop: 16,
            fontSize: rows.length ? 60 : 76,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
            display: "block",
            width: inner,
            lineClamp: 2,
          },
          post.title,
        ),
        box(
          {
            marginTop: 18,
            fontSize: 26,
            lineHeight: 1.4,
            color: ink2,
            display: "block",
            width: inner,
            lineClamp: rows.length ? 2 : 3,
          },
          post.summary,
        ),
        ...(rows.length
          ? [
              box(
                {
                  flexDirection: "column",
                  flexGrow: 1,
                  width: inner,
                  boxSizing: "border-box",
                  marginTop: 32,
                  padding: "24px 32px",
                  borderRadius: "16px 16px 0 0",
                  border: `1px solid ${line}`,
                  borderBottom: "none",
                  background: panel,
                  fontFamily: "Commit Mono",
                  fontSize: 22,
                  overflow: "hidden",
                },
                rows.map((runs) =>
                  box(
                    { height: 36, whiteSpace: "pre" },
                    runs.length
                      ? runs.map((run): Node => ({
                          type: "span",
                          props: { style: { color: run.color }, children: run.text },
                        }))
                      : " ",
                  ),
                ),
              ),
            ]
          : []),
      ],
    );
    const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { ...ogSize, fonts });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: ogSize.width } }).render().asPng();
    const out = path.join(outDir, ogImagePath(post.url));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png);
  }
}
