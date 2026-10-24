<script setup lang="ts">
import { computed, ref } from "vue";
import { usePreferencesStore } from "@/modules/settings-backup";
import type { PersistenceError } from "@/shared/application";
import { persistenceMessage, technicalDetail, useI18n } from "@/shared/i18n";
import { AppButton, AppIconButton, AppNotice } from "@/shared/ui";
import { useDatabaseStatusStore } from "./database-status-store";

/*
 * Notices about the local database, in the page flow above the content:
 * upgrade from another tab (reload needed), upgrade waiting for other
 * tabs, storage unavailable (navigation keeps working, changes may not be
 * saved).
 */

const { t } = useI18n();
const status = useDatabaseStatusStore();
const preferences = usePreferencesStore();
const dismissed = ref(false);

/** Unavailable at startup, or became unavailable during a write. */
const unavailable = computed<PersistenceError | undefined>(() => {
  if (status.versionChanged) return undefined;
  if (status.connection === "unavailable") return status.error;
  for (const failure of [preferences.saveError, preferences.loadError]) {
    if (failure?.code === "persistence.unavailable") return failure;
  }
  return undefined;
});

function reload(): void {
  window.location.reload();
}
</script>

<template>
  <section
    :aria-label="t('database.region')"
    class="mx-auto flex max-w-7xl flex-col gap-3 empty:hidden"
    :class="{
      'mb-4':
        status.versionChanged || status.blocked || (unavailable && !dismissed),
    }"
    data-testid="database-status"
  >
    <AppNotice
      v-if="status.versionChanged"
      tone="warning"
      role="alert"
      :title="t('database.versionChange.title')"
      data-testid="database-version-change"
    >
      <p>{{ t("database.versionChange.body") }}</p>
      <p class="mt-1 font-medium">{{ t("database.versionChange.action") }}</p>
      <template #actions>
        <AppButton variant="primary" @click="reload">
          {{ t("database.reload") }}
        </AppButton>
      </template>
    </AppNotice>

    <AppNotice
      v-else-if="status.blocked"
      tone="warning"
      role="status"
      :title="t('database.blocked.title')"
      data-testid="database-blocked"
    >
      {{ t("database.blocked.body") }}
    </AppNotice>

    <div
      v-else-if="unavailable && !dismissed"
      class="flex items-start gap-2"
      data-testid="database-unavailable"
    >
      <AppNotice
        class="flex-1"
        tone="danger"
        role="alert"
        :title="t('database.unavailable.title')"
      >
        <p>{{ t("database.unavailable.body") }}</p>
        <p class="mt-1">{{ persistenceMessage(unavailable) }}</p>
        <p class="mt-1 text-xs text-fg-muted">
          {{ technicalDetail(unavailable) }}
        </p>
      </AppNotice>
      <AppIconButton
        icon="close"
        :label="t('database.dismiss')"
        @click="dismissed = true"
      />
    </div>
  </section>
</template>
