<script setup lang="ts">
import { computed } from "vue";
import type { IconName } from "../icons";
import AppIcon from "./AppIcon.vue";

export type NoticeTone = "info" | "success" | "warning" | "danger";

/**
 * Inline notice in the page flow. `role="alert"` only for failures the
 * user must notice now; `status` for outcomes; none for static guidance.
 * The tone is backed by an icon and by the text itself.
 */
const props = withDefaults(
  defineProps<{
    tone?: NoticeTone;
    title?: string;
    role?: "alert" | "status";
  }>(),
  { tone: "info", title: undefined, role: undefined },
);

const STYLES: Readonly<Record<NoticeTone, { border: string; color: string }>> =
  {
    info: { border: "border-accent", color: "text-accent" },
    success: { border: "border-success", color: "text-success" },
    warning: { border: "border-warning", color: "text-warning" },
    danger: { border: "border-danger", color: "text-danger" },
  };

const ICONS: Readonly<Record<NoticeTone, IconName>> = {
  info: "info",
  success: "check",
  warning: "alert",
  danger: "alert",
};

const style = computed(() => STYLES[props.tone]);
</script>

<template>
  <div
    :role="role"
    class="flex items-start gap-3 rounded-card border border-l-4 bg-surface p-3"
    :class="style.border"
    :data-tone="tone"
  >
    <span class="pt-0.5" :class="style.color"
      ><AppIcon :name="ICONS[tone]" :size="20"
    /></span>
    <div class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
      <p v-if="title" class="font-semibold text-fg">{{ title }}</p>
      <div class="text-fg"><slot /></div>
      <div v-if="$slots.actions" class="mt-2 flex flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
