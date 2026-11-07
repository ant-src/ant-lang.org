<script setup lang="ts">
import { computed, ref } from "vue";
import Preview from "./Preview.vue";

// The editor previews on the home page: one looping video per editor, each completing the same
// line of the same program, chosen with the buttons above it. The editor pages show the rest of
// the videos, one per feature.
const editors = [
  { id: "vscode", name: "VS Code" },
  { id: "intellij", name: "IntelliJ" },
  { id: "nvim", name: "Neovim" },
] as const;

const current = ref<(typeof editors)[number]["id"]>("vscode");
const label = computed(
  () => `${editors.find((editor) => editor.id === current.value)?.name} completes the functions of Array after a pipe`,
);
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
    <Preview :key="current" :src="`/ide/${current}/completion.mp4`" :label="label" />
  </div>
</template>

<style scoped>
.editors {
  overflow: hidden;
  border-radius: 16px;
  background: var(--landing-panel);
}

.editors {
  box-shadow: inset 0 0 0 1px var(--landing-line);
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--landing-line);
}

.tabs button {
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--landing-ink-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.tabs button:hover {
  color: var(--landing-ink);
}

.tabs button.on {
  color: var(--landing-ink);
  background: rgba(127, 127, 127, 0.16);
}

.tabs button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
