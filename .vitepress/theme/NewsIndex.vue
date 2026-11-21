<script setup lang="ts">
// The news index: one column of posts, newest first, at the width of a post. Each post opens with
// the line a post's own header opens with, its date and version, then its headline in Newsreader
// and its summary. The whole post is one link.
import { withBase } from "vitepress";
import { formatDate } from "../news";
import { data as posts } from "./news.data";
</script>

<template>
  <div class="news">
    <header class="news-head">
      <h1>News</h1>
      <p>
        Notes on each release of Ant. Follow along with the
        <a :href="withBase('/feed.xml')">feed</a>.
      </p>
    </header>

    <ol class="news-list">
      <li v-for="post in posts" :key="post.url">
        <a class="news-item" :href="withBase(post.url)">
          <span class="news-meta">
            <time :datetime="post.date">{{ formatDate(post.date, "long") }}</time
            ><template v-if="post.version"> · Ant {{ post.version }}</template>
          </span>
          <span class="news-title">{{ post.title }}</span>
          <span class="news-summary">{{ post.summary }}</span>
        </a>
      </li>
    </ol>
  </div>
</template>
