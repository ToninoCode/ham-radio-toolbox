<script setup lang="ts">
import { computed } from "vue";
import { ICONS, type IconDefinition, type IconName } from "../icons";

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), {
  size: 24,
});

const icon = computed<IconDefinition>(() => ICONS[props.name]);

// Decorative: the accessible name always comes from the surrounding control.
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :fill="icon.filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
    :data-icon="name"
  >
    <path v-for="(d, index) in icon.paths" :key="index" :d="d" />
  </svg>
</template>
