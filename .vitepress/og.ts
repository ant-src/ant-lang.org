// The images of the news posts, which a link to a post shows where it is shared: one PNG per post,
// at og/news/<post>.png beside the pages, written by config.mts after every build, so a new post
// gets its image with nothing more to do. Each is the news page in small: the black of the news
// pages, the logo, the post's date and version, its title and summary in Inter, and the first
// lines of its lead code (news.ts) in Commit Mono, in a panel that runs off the bottom edge.
//
// Satori lays the image out from a tree of boxes, as an SVG, and resvg draws the SVG as a PNG.
// Satori reads fonts as WOFF, not WOFF2, so the fonts come from their @fontsource packages.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createHighlighter, type HighlighterGeneric, type LanguageRegistration, type ThemeRegistration } from "shiki";
import { formatDate, leadSource, type Post } from "./news";

export const ogSize = { width: 1200, height: 630 };

// Where a post's image is served, as a path under the site: /news/ant-0-3 has /og/news/ant-0-3.png.
export const ogImagePath = (url: string) => `/og${url}.png`;

// The image's margin, and the width of everything inside it.
const margin = 72;
const inner = ogSize.width - 2 * margin;

const ink = "#f5f5f7";
const ink2 = "#a1a1a6";
const ink3 = "#6e6e73";
const panel = "#141416";
const line = "rgba(255, 255, 255, 0.1)";

// The lines of lead code an image shows, and how wide a line may run before it is cut.
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

type Node = { type: string; props: { style?: Record<string, unknown>; children?: Child | Child[]; src?: string } };
type Child = Node | string;

const box = (style: Record<string, unknown>, children?: Child | Child[]): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

// Every post's image, from the post and its Markdown, its code highlighted in the theme and
// languages the site highlights code in.
export async function writeNewsImages(
  posts: { post: Post; src: string }[],
  outDir: string,
  code: { theme: ThemeRegistration; langs: LanguageRegistration[] },
): Promise<void> {
  const fonts = [
    { name: "Inter", data: file("@fontsource/inter/files/inter-latin-400-normal.woff"), weight: 400 as const },
    { name: "Inter", data: file("@fontsource/inter/files/inter-latin-600-normal.woff"), weight: 600 as const },
    { name: "Inter", data: file("@fontsource/inter/files/inter-latin-700-normal.woff"), weight: 700 as const },
    {
      name: "Commit Mono",
      data: withoutLtag(file("@fontsource/commit-mono/files/commit-mono-latin-400-normal.woff")),
      weight: 400 as const,
    },
  ];
  const logo = `data:image/png;base64,${fs.readFileSync(path.join(import.meta.dirname, "../public/logo.png")).toString("base64")}`;
  // Typed by name, as the site's own languages are not among Shiki's bundled ones.
  const highlighter = (await createHighlighter({
    themes: [code.theme],
    langs: code.langs,
  })) as unknown as HighlighterGeneric<string, string>;
  const loaded = new Set(highlighter.getLoadedLanguages());

  // The lead's first lines, each a row of colored tokens; a language the site does not highlight
  // is drawn plain.
  const leadRows = (src: string): Node[] => {
    const lead = leadSource(src);
    if (!lead) return [];
    const lang = loaded.has(lead.lang) ? lead.lang : "text";
    const { tokens } = highlighter.codeToTokens(lead.code, { lang, theme: code.theme.name! });
    return tokens.slice(0, codeLines).map((row) => {
      let left = codeColumns;
      const spans: Node[] = [];
      for (const token of row) {
        if (left <= 0) break;
        const text = token.content.length > left ? `${token.content.slice(0, left - 1)}…` : token.content;
        left -= token.content.length;
        spans.push({ type: "span", props: { style: { color: token.color ?? ink }, children: text } });
      }
      return box({ height: 36, whiteSpace: "pre" }, spans.length ? spans : " ");
    });
  };

  for (const { post, src } of posts) {
    const rows = leadRows(src);
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
                rows,
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
