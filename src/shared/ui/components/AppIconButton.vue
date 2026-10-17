<script setup lang="ts">
import type { IconName } from "../icons";
import AppIcon from "./AppIcon.vue";

/**
 * Icon-only button. `label` is mandatory: it is the accessible name and the
 * tooltip, so the control never relies on the icon alone.
 */
withDefaults(
  defineProps<{
    icon: IconName;
    label: string;
    pressed?: boolean;
    type?: "button" | "submit";
  }>(),
  { pressed: undefined, type: "button" },
);
</script>

<template>
  <button
    :type="type"
    :aria-label="label"
    :title="label"
    :aria-pressed="pressed"
    class="inline-flex size-touch items-center justify-center rounded-lg text-fg transition-colors hover:bg-surface-muted"
  >
    <AppIcon :name="icon" :size="22" />
  </button>
</template>
