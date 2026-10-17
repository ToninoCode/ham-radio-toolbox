<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <header
    class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
  >
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
        {{ title }}
      </h1>
      <div v-if="$slots.default" class="max-w-prose text-fg-muted">
        <slot />
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
