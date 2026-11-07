<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// A looping preview of an editor feature, the shot of a row: a short muted video that plays while
// it is on screen and shows its first frame otherwise. A click, or Enter or Space while it has
// focus, pauses or resumes it, and a pause by the reader holds until they resume it. Readers who
// prefer reduced motion get the first frame and the same controls to play it. Its accessible name
// is the heading of the row it sits in, unless a label is given.
const props = defineProps<{ src: string; label?: string }>();

const video = ref<HTMLVideoElement>();
const name = ref(props.label ?? "Preview");
let observer: IntersectionObserver | undefined;
let pausedByReader = false;

onMounted(() => {
  const el = video.value;
  if (!el) return;
  if (!props.label) {
    name.value = el.closest("section")?.querySelector("h2")?.textContent?.trim() ?? name.value;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  observer = new IntersectionObserver(
    (entries) => {
      // Several records may be queued after a fast scroll; the last one is the current state.
      const entry = entries[entries.length - 1];
      if (!entry.isIntersecting) el.pause();
      else if (!pausedByReader) el.play().catch(() => {});
    },
    { threshold: 0.25 },
  );
  observer.observe(el);
});

onBeforeUnmount(() => observer?.disconnect());

function toggle() {
  const el = video.value;
  if (!el) return;
  pausedByReader = !el.paused;
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
    :aria-label="name"
    tabindex="0"
    muted
    loop
    playsinline
    preload="none"
    width="1024"
    height="640"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
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

.preview:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
</style>
