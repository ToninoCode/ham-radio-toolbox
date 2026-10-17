<script setup lang="ts">
import type { IconName } from "../icons";
import AppIcon from "./AppIcon.vue";

withDefaults(
  defineProps<{ title: string; icon?: IconName; compact?: boolean }>(),
  { icon: "info", compact: false },
);
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 rounded-card border border-dashed border-border text-center"
    :class="compact ? 'p-4' : 'p-8'"
    data-testid="empty-state"
  >
    <span class="text-fg-muted"
      ><AppIcon :name="icon" :size="compact ? 24 : 32"
    /></span>
    <p class="font-semibold text-fg">{{ title }}</p>
    <div v-if="$slots.default" class="max-w-prose text-sm text-fg-muted">
      <slot />
    </div>
  </div>
</template>
