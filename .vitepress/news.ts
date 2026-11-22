// The news: one Markdown file per post in news/, beside news/index.md, which lists them. There is a
// post for each minor release, news/ant-X-Y.md (RELEASE.md, step 4), and none for a patch release.
// A post's frontmatter names its title, its date, a one-sentence summary, and the version:
//
//   ---
//   title: Every error in one run
//   date: 2026-11-20
//   summary: ant check reports every error at once, and ant code navigates from the shell.
//   version: 0.3.0
//   ---
//
// The index (theme/NewsIndex.vue), the header and the older and newer links of a post
// (theme/NewsPost.vue) and the feed (feed.xml, written by config.mts) all read the posts here.
//
// The index opens with the newest post and the code that sums it up: the post's first code block,
// or the one whose fence is marked lead, as in ```ant lead. The mark does nothing in the post.
import type { ContentData } from "vitepress";

export const newsGlob = "news/*.md";

export type Post = {
  url: string;
  title: string;
  // The day, as YYYY-MM-DD.
  date: string;
  summary: string;
  version?: string;
  // The rendered post, for the feed only.
  html?: string;
  // The highlighted <pre> of the post's lead code, for the newest post on the index only.
  lead?: string;
};

// The posts, newest first. A post without a title, a date, or a summary fails the build.
export function toPosts(pages: ContentData[]): Post[] {
  return pages
    .filter((page) => page.url !== "/news/")
    .map(({ url, frontmatter, html }): Post => {
      const { title, date, summary, version } = frontmatter;
      for (const [key, value] of Object.entries({ title, date, summary })) {
        if (!value) throw new Error(`news: ${url} has no ${key} in its frontmatter`);
      }
      // YAML reads 2026-11-21 as a Date at midnight UTC; a quoted date stays a string.
      const day = new Date(date);
      if (Number.isNaN(day.getTime())) throw new Error(`news: ${url} has a date that is not a date: ${date}`);
      return {
        url,
        title,
        date: day.toISOString().slice(0, 10),
        summary,
        version: version === undefined ? undefined : String(version),
        html,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

// "November 21, 2026" or "Nov 21, 2026", read in UTC so the day never shifts with the reader's zone.
export function formatDate(date: string, style: "long" | "short"): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: style,
    day: "numeric",
    year: "numeric",
  });
}

// The info strings of the fenced code blocks in a post's Markdown, in order.
function fenceInfos(src: string): string[] {
  const infos: string[] = [];
  let open: string | undefined;
  for (const line of src.split("\n")) {
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence) continue;
    if (open === undefined) {
      open = fence[1];
      infos.push(fence[2].trim());
    } else if (fence[1][0] === open[0] && fence[1].length >= open.length && !fence[2].trim()) {
      open = undefined;
    }
  }
  return infos;
}

// A post's lead code: of its rendered blocks, the one marked lead or else the first, as its
// highlighted <pre> alone, without the copy button and language label around it in the post.
export function leadCode(src: string, html: string): string | undefined {
  const marked = fenceInfos(src).findIndex((info) => /(^|\s)lead(\s|$)/.test(info));
  const pre = html.match(/<pre[\s\S]*?<\/pre>/g)?.[Math.max(marked, 0)];
  return pre?.replace(/ v-pre=""/g, "");
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A post's HTML for a feed reader: without the permalink anchors of its headings or the v-pre
// that config.mts puts on inline code.
const feedHtml = (html: string) =>
  html.replace(/<a class="header-anchor"[^>]*>[\s\S]*?<\/a>/g, "").replace(/ v-pre=""/g, "");

// An Atom feed of the posts, each with its full text. Links in a post are relative to the site.
export function atomFeed(posts: Post[], site: string): string {
  const updated = posts[0] ? `${posts[0].date}T00:00:00Z` : new Date(0).toISOString();
  const entries = posts.map(
    (post) => `  <entry>
    <title>${escape(post.title)}</title>
    <link href="${site}${post.url}"/>
    <id>${site}${post.url}</id>
    <published>${post.date}T00:00:00Z</published>
    <updated>${post.date}T00:00:00Z</updated>
    <summary>${escape(post.summary)}</summary>
    <content type="html" xml:base="${site}${post.url}">${escape(feedHtml(post.html ?? ""))}</content>
  </entry>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Ant News</title>
  <subtitle>Releases and notes from the Ant project.</subtitle>
  <link href="${site}/news/"/>
  <link rel="self" href="${site}/feed.xml"/>
  <id>${site}/news/</id>
  <icon>${site}/favicon.png</icon>
  <author><name>Anton Medvedev</name></author>
  <updated>${updated}</updated>
${entries.join("\n")}
</feed>
`;
}
