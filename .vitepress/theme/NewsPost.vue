<script setup lang="ts">
// A post's own parts around its text: at the top, the way back to the index, the date and version,
// the title, and the summary; at the bottom, links to the older and the newer post. The post's
// Markdown holds only its text. Pages outside news/, and the index, get neither part.
import { useData, withBase } from "vitepress";
import { computed } from "vue";
import { formatDate } from "../news";
import { data as posts } from "./news.data";

const props = defineProps<{ part: "header" | "footer" }>();

const { page } = useData();
const index = computed(() => {
  const url = "/" + page.value.relativePath.replace(/\.md$/, "");
  return posts.findIndex((post) => post.url === url);
});
const post = computed(() => posts[index.value]);
const older = computed(() => posts[index.value + 1]);
const newer = computed(() => posts[index.value - 1]);
</script>

<template>
  <header v-if="post && props.part === 'header'" class="news-post-header">
    <a class="news-back" :href="withBase('/news')">News</a>
    <p class="news-meta">
      <time :datetime="post.date">{{ formatDate(post.date, "long") }}</time
      ><template v-if="post.version"> · Ant {{ post.version }}</template>
    </p>
    <h1>{{ post.title }}</h1>
    <p class="news-dek">{{ post.summary }}</p>
  </header>

  <nav v-if="post && props.part === 'footer' && (older || newer)" class="news-post-nav" aria-label="More news">
    <a v-if="older" class="older" :href="withBase(older.url)"><span>Older</span>{{ older.title }}</a>
    <a v-if="newer" class="newer" :href="withBase(newer.url)"><span>Newer</span>{{ newer.title }}</a>
  </nav>
</template>
