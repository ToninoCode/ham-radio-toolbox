<script setup lang="ts">
import AppShell from "./layout/AppShell.vue";
import PwaStatus from "./pwa/PwaStatus.vue";
import PwaUpdatePrompt from "./pwa/PwaUpdatePrompt.vue";
import { usePwaUpdate } from "./pwa/use-pwa-update";

// One registration shared by the in-flow status and the update prompt.
const pwa = usePwaUpdate();
</script>

<template>
  <AppShell>
    <template #notifications>
      <PwaStatus :pwa="pwa" />
    </template>
  </AppShell>
  <PwaUpdatePrompt :pwa="pwa" />
</template>
