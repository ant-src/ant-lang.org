<script setup lang="ts">
import { onMounted, ref } from "vue";
import { encode } from "../../playground/share";

// A row of the home page: text beside a shot of a program and what it prints. The hero is the
// first row, centered. Once mounted, a link marked data-play inside the row opens the playground
// with the row's program, so every example can be run and edited.
defineProps<{ hero?: boolean }>();

const root = ref<HTMLElement>();

onMounted(async () => {
  const row = root.value;
  if (!row) return;
  const links = row.querySelectorAll<HTMLAnchorElement>("a[data-play]");
  const code = row.querySelector(".language-ant pre")?.textContent;
  if (!links.length || !code) return;
  const hash = await encode({ files: { "main.ant": code.replace(/\n*$/, "\n") }, stdin: "" });
  for (const link of links) link.href = `/playground#code=${hash}`;
});
</script>

<template>
  <component :is="hero ? 'header' : 'section'" ref="root" class="feature" :class="{ hero }">
    <slot />
  </component>
</template>
