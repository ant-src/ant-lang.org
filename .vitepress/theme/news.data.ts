// The posts in news/, newest first, for the index and the posts themselves (../news.ts). Every page
// loads them, for a post's older and newer links, so they leave the rendered posts behind and keep
// only the lead code of the newest, which the index shows.
import { createContentLoader } from "vitepress";
import { leadCode, newsGlob, toPosts, type Post } from "../news";

declare const data: Post[];
export { data };

export default createContentLoader(newsGlob, {
  render: true,
  includeSrc: true,
  transform(pages) {
    return toPosts(pages).map((post, index): Post => {
      const page = pages.find((page) => page.url === post.url);
      const lead = index === 0 && page ? leadCode(page.src ?? "", page.html ?? "") : undefined;
      return { ...post, html: undefined, lead };
    });
  },
});
