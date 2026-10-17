<script setup lang="ts">
import { computed } from "vue";
import { useOnline } from "@/shared/composables";
import { useI18n } from "@/shared/i18n";
import { AppIcon } from "@/shared/ui";

const { t } = useI18n();
const online = useOnline();

const description = computed(() =>
  online.value
    ? t("connection.onlineDescription")
    : t("connection.offlineDescription"),
);

// role="status" announces connectivity changes politely (FR-DSH-04).
</script>

<template>
  <div
    role="status"
    class="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold"
    :class="
      online ? 'border-success text-success' : 'border-danger text-danger'
    "
    :title="description"
    data-testid="connection-status"
    :data-online="online"
  >
    <AppIcon :name="online ? 'online' : 'offline'" :size="18" />
    <span>{{ online ? t("connection.online") : t("connection.offline") }}</span>
    <span class="sr-only">{{ description }}</span>
  </div>
</template>
