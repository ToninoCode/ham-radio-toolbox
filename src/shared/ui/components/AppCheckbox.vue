<script setup lang="ts">
import { useId } from "vue";

/** Native checkbox with its label as a 44 px touch target (NFR-UX-02). */
withDefaults(
  defineProps<{ label: string; hint?: string; disabled?: boolean }>(),
  { hint: undefined, disabled: false },
);

const model = defineModel<boolean>({ required: true });
const id = useId();
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <label
      :for="id"
      class="inline-flex min-h-touch cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed has-disabled:opacity-60"
    >
      <input
        :id="id"
        v-model="model"
        type="checkbox"
        :disabled="disabled"
        :aria-describedby="hint ? `${id}-hint` : undefined"
        class="size-5 shrink-0 accent-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <span class="text-fg">{{ label }}</span>
    </label>
    <p v-if="hint" :id="`${id}-hint`" class="pl-8 text-sm text-fg-muted">
      {{ hint }}
    </p>
  </div>
</template>
