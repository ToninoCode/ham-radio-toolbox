<script setup lang="ts">
import { computed } from "vue";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const props = withDefaults(defineProps<{ tone?: BadgeTone }>(), {
  tone: "neutral",
});

const TONES: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-border-strong text-fg-muted",
  info: "border-accent text-accent",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger",
};

const classes = computed(() => TONES[props.tone]);

// Text is always present: the tone is never the only carrier of meaning.
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
    :class="classes"
    :data-tone="tone"
  >
    <slot />
  </span>
</template>
