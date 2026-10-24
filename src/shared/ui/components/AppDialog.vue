<script setup lang="ts">
import { useId, useTemplateRef } from "vue";

/**
 * Modal dialog on the native `<dialog>`: focus trap, Escape and an inert
 * background come from the browser. Escape or `close()` emit `close`.
 */
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();

const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const titleId = useId();
const bodyId = useId();

function open(): void {
  if (dialog.value && !dialog.value.open) dialog.value.showModal();
}

function close(): void {
  if (dialog.value?.open) dialog.value.close();
}

defineExpose({ open, close });
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    :aria-describedby="bodyId"
    class="m-auto max-h-[90dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-card border border-border bg-surface p-0 text-fg backdrop:bg-black/60"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-4 p-5">
      <h2 :id="titleId" class="text-lg font-semibold">{{ title }}</h2>
      <div :id="bodyId" class="flex flex-col gap-3 text-sm">
        <slot />
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>
