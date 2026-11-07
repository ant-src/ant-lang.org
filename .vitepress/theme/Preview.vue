<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// A looping preview of an editor feature, the shot of a row on an editor's page: a short muted
// video that plays while it is on screen and shows its first frame otherwise. A click pauses or
// resumes it. Readers who prefer reduced motion get the first frame, and the click to play it.
const props = defineProps<{ src: string; label: string }>();

const video = ref<HTMLVideoElement>();
let observer: IntersectionObserver | undefined;

onMounted(() => {
  const el = video.value;
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) el.play().catch(() => {});
      else el.pause();
    },
    { threshold: 0.25 },
  );
  observer.observe(el);
});

onBeforeUnmount(() => observer?.disconnect());

function toggle() {
  const el = video.value;
  if (!el) return;
  if (el.paused) el.play().catch(() => {});
  else el.pause();
}
</script>

<template>
  <video
    ref="video"
    class="preview"
    :src="props.src"
    :poster="props.src.replace(/\.mp4$/, '.jpg')"
    :aria-label="props.label"
    muted
    loop
    playsinline
    preload="none"
    width="1024"
    height="640"
    @click="toggle"
  ></video>
</template>

<style scoped>
.preview {
  display: block;
  width: 100%;
  height: auto;
  background: #000;
  cursor: pointer;
}
</style>
