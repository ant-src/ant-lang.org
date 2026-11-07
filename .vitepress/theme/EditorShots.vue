<script setup lang="ts">
import { onMounted, ref } from "vue";

// The editor previews on the home page: one looping video per editor, each completing the same
// line of the same program, chosen with the buttons above it. The videos are rendered from the
// language server's real answers (see private/*-preview in the ant-lang checkout).
const editors = [
  { id: "vscode", name: "VS Code" },
  { id: "intellij", name: "IntelliJ" },
  { id: "nvim", name: "Neovim" },
] as const;

const current = ref<(typeof editors)[number]["id"]>("vscode");
const reduced = ref(false);

onMounted(() => {
  reduced.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});
</script>

<template>
  <div class="editors">
    <div class="tabs" role="tablist" aria-label="Editor">
      <button
        v-for="editor in editors"
        :key="editor.id"
        role="tab"
        :aria-selected="current === editor.id"
        :class="{ on: current === editor.id }"
        @click="current = editor.id"
      >
        {{ editor.name }}
      </button>
    </div>
    <video
      :key="current"
      :src="`/ide/${current}.mp4`"
      :poster="`/ide/${current}.jpg`"
      :autoplay="!reduced"
      muted
      loop
      playsinline
      preload="metadata"
      width="1024"
      height="640"
      aria-label="The editor completes the functions of Array after a pipe"
    ></video>
  </div>
</template>

<style scoped>
.editors {
  overflow: hidden;
  border-radius: 16px;
  background: var(--home-panel);
}

.dark .editors {
  box-shadow: inset 0 0 0 1px var(--home-line);
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--home-line);
}

.tabs button {
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--home-ink-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.tabs button:hover {
  color: var(--home-ink);
}

.tabs button.on {
  color: var(--home-ink);
  background: rgba(127, 127, 127, 0.16);
}

.tabs button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

video {
  display: block;
  width: 100%;
  height: auto;
}
</style>
