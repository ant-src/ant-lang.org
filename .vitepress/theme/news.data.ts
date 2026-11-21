// The posts in news/, newest first, for the index and the posts themselves (../news.ts).
import { createContentLoader } from "vitepress";
import { newsGlob, toPosts, type Post } from "../news";

declare const data: Post[];
export { data };

// Without render, the posts carry no html.
export default createContentLoader(newsGlob, { transform: toPosts });
