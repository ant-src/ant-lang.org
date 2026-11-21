// The news: one Markdown file per post in news/, beside news/index.md, which lists them. A post's
// frontmatter names its title, its date, a one-sentence summary, and for a release, the version:
//
//   ---
//   title: Tests run in WebAssembly
//   date: 2026-11-21
//   summary: The browser build runs tests and the debugger.
//   version: 0.3.2
//   ---
//
// The index (theme/NewsIndex.vue), the header and the older and newer links of a post
// (theme/NewsPost.vue) and the feed (feed.xml, written by config.mts) all read the posts here.
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

// "November 21, 2026" or "Nov 21", read in UTC so the day never shifts with the reader's zone.
export function formatDate(date: string, style: "long" | "short"): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: style,
    day: "numeric",
    year: style === "long" ? "numeric" : undefined,
  });
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
  <link href="${site}/news"/>
  <link rel="self" href="${site}/feed.xml"/>
  <id>${site}/news</id>
  <icon>${site}/favicon.png</icon>
  <author><name>Anton Medvedev</name></author>
  <updated>${updated}</updated>
${entries.join("\n")}
</feed>
`;
}
