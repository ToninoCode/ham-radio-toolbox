<script setup lang="ts" generic="T extends string">
import { useId } from "vue";
import type { IconName } from "../icons";
import AppIcon from "./AppIcon.vue";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  icon?: IconName;
}

/**
 * Single choice among a few options, built on native radio inputs: arrow-key
 * navigation, form semantics and screen reader support come from the browser.
 */
withDefaults(
  defineProps<{
    legend: string;
    options: readonly SegmentedOption<T>[];
    hideLegend?: boolean;
    iconOnly?: boolean;
  }>(),
  { hideLegend: false, iconOnly: false },
);

const model = defineModel<T>({ required: true });
const name = useId();
</script>

<template>
  <fieldset class="min-w-0">
    <legend
      :class="hideLegend ? 'sr-only' : 'mb-1 text-sm font-medium text-fg-muted'"
    >
      {{ legend }}
    </legend>
    <div
      class="inline-flex flex-wrap rounded-lg border border-border-strong bg-surface p-0.5"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="relative inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-fg-muted transition-colors has-checked:bg-accent has-checked:text-accent-fg has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
        :title="iconOnly ? option.label : undefined"
      >
        <input
          v-model="model"
          type="radio"
          class="sr-only"
          :name="name"
          :value="option.value"
        />
        <AppIcon v-if="option.icon" :name="option.icon" :size="20" />
        <span :class="iconOnly && option.icon ? 'sr-only' : ''">
          {{ option.label }}
        </span>
      </label>
    </div>
  </fieldset>
</template>
