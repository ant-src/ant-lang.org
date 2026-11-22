<script setup lang="ts">
// The news index: the newest post first and largest, its date and version, its headline in
// Newsreader, its summary, and the code that sums it up; then every older post as one row of its
// date, version, and headline. The lead's text is one link to its post, and each row is one.
import { withBase } from "vitepress";
import { formatDate } from "../news";
import { data as posts } from "./news.data";

const [latest, ...older] = posts;
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

    <article v-if="latest" class="news-lead">
      <a class="news-item" :href="withBase(latest.url)">
        <span class="news-meta">
          <time :datetime="latest.date">{{ formatDate(latest.date, "long") }}</time
          ><template v-if="latest.version"> · Ant {{ latest.version }}</template>
        </span>
        <span class="news-title">{{ latest.title }}</span>
        <span class="news-summary">{{ latest.summary }}</span>
      </a>
      <div v-if="latest.lead" class="news-lead-code" v-html="latest.lead" />
      <a class="news-more" :href="withBase(latest.url)">Read the post</a>
    </article>

    <section v-if="older.length" class="news-archive" aria-labelledby="news-earlier">
      <h2 id="news-earlier" class="news-meta">Earlier</h2>
      <ol class="news-rows">
        <li v-for="post in older" :key="post.url">
          <a class="news-row" :href="withBase(post.url)">
            <time class="news-row-date" :datetime="post.date">{{ formatDate(post.date, "short") }}</time>
            <span class="news-row-version">{{ post.version }}</span>
            <span class="news-row-title">{{ post.title }}</span>
          </a>
        </li>
      </ol>
    </section>
  </div>
</template>
