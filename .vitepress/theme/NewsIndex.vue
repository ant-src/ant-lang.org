<script setup lang="ts">
// The news index: the posts by year, newest first. Each year is a large numeral that stays in view
// beside its posts; each post is its date, its headline in Newsreader with the version as an
// italic aside, and its summary. The whole post is one link.
import { withBase } from "vitepress";
import { computed } from "vue";
import { formatDate, type Post } from "../news";
import { data as posts } from "./news.data";

const years = computed(() => {
  const byYear = new Map<string, Post[]>();
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), post]);
  }
  return [...byYear].map(([year, posts]) => ({ year, posts }));
});
</script>

<template>
  <div class="news">
    <header class="news-head">
      <h1>News</h1>
      <p>
        Releases and notes from the Ant project. Follow along with the
        <a :href="withBase('/feed.xml')">feed</a>.
      </p>
    </header>

    <section v-for="{ year, posts } in years" :key="year" class="news-year" :aria-labelledby="`news-${year}`">
      <h2 :id="`news-${year}`" class="news-numeral">{{ year }}</h2>
      <ol class="news-list">
        <li v-for="post in posts" :key="post.url">
          <a class="news-item" :href="withBase(post.url)">
            <time class="news-date" :datetime="post.date">{{ formatDate(post.date, "short") }}</time>
            <span class="news-text">
              <span class="news-title"
                >{{ post.title }}<span v-if="post.version" class="news-version">{{ post.version }}</span></span
              >
              <span class="news-summary">{{ post.summary }}</span>
            </span>
          </a>
        </li>
      </ol>
    </section>
  </div>
</template>
