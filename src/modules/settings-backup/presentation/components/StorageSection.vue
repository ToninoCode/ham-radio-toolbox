<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import {
  formatBytes,
  formatPercent,
  persistenceMessage,
  technicalDetail,
  useI18n,
} from "@/shared/i18n";
import { AppBadge, AppButton, AppIcon, AppNotice } from "@/shared/ui";
import type {
  PersistenceRequestOutcome,
  StorageStatus,
} from "../../application/storage-service";
import { useSettingsServices } from "../services";

/*
 * Storage status (FR-SET-03, NFR-REL-03): database availability, browser
 * estimates of usage and quota, persistence and its explicit request.
 * Figures are the browser's estimates, never presented as guarantees.
 */

const { t } = useI18n();
const services = useSettingsServices();

const status = shallowRef<StorageStatus>();
const checking = ref(false);
const requesting = ref(false);
const requestOutcome = ref<PersistenceRequestOutcome>();

async function refresh(): Promise<void> {
  checking.value = true;
  try {
    status.value = await services.storage.status();
  } finally {
    checking.value = false;
  }
}

async function requestPersistence(): Promise<void> {
  requesting.value = true;
  try {
    requestOutcome.value = await services.storage.requestPersistence();
    await refresh();
  } finally {
    requesting.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
    aria-labelledby="storage-title"
    data-testid="storage-section"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2
        id="storage-title"
        class="flex items-center gap-2 text-xl font-semibold"
      >
        <AppIcon name="database" :size="22" />
        {{ t("storage.title") }}
      </h2>
      <AppButton :disabled="checking" @click="refresh">
        {{ t("storage.refresh") }}
      </AppButton>
    </div>

    <AppNotice tone="info">
      <p>{{ t("storage.localOnly") }}</p>
      <p class="mt-1 font-medium">{{ t("storage.backupAdvice") }}</p>
    </AppNotice>

    <p v-if="!status" role="status" class="text-sm text-fg-muted">
      {{ t("storage.checking") }}
    </p>

    <dl v-else class="grid gap-4 sm:grid-cols-2" data-testid="storage-status">
      <div class="flex flex-col gap-1">
        <dt class="text-sm font-medium text-fg-muted">
          {{ t("storage.database.label") }}
        </dt>
        <dd class="flex flex-col gap-1" data-testid="storage-database">
          <span>
            <AppBadge :tone="status.database.ok ? 'success' : 'danger'">
              {{
                status.database.ok
                  ? t("storage.database.available")
                  : t("storage.database.unavailable")
              }}
            </AppBadge>
          </span>
          <template v-if="!status.database.ok">
            <span class="text-sm">{{
              persistenceMessage(status.database.error)
            }}</span>
            <span class="text-xs text-fg-muted">{{
              technicalDetail(status.database.error)
            }}</span>
          </template>
        </dd>
      </div>

      <div class="flex flex-col gap-1">
        <dt class="text-sm font-medium text-fg-muted">
          {{ t("storage.usage.label") }}
        </dt>
        <dd data-testid="storage-usage">
          <template v-if="status.usage">
            <span>{{
              t("storage.usage.value", {
                used: formatBytes(status.usage.usageBytes),
                quota: formatBytes(status.usage.quotaBytes),
                percent: formatPercent(status.usage.usageRatio),
              })
            }}</span>
            <progress
              class="mt-2 block h-2 w-full accent-accent"
              :value="status.usage.usageRatio"
              max="1"
              :aria-label="t('storage.usage.label')"
            />
          </template>
          <span v-else class="text-sm">{{ t("storage.usage.unknown") }}</span>
        </dd>
      </div>

      <div class="flex flex-col gap-1">
        <dt class="text-sm font-medium text-fg-muted">
          {{ t("storage.quota.label") }}
        </dt>
        <dd class="flex flex-col gap-1">
          <span v-if="status.usage">{{
            formatBytes(status.usage.quotaBytes)
          }}</span>
          <span v-else class="text-sm">{{ t("storage.usage.unknown") }}</span>
          <span class="text-sm text-fg-muted">{{
            t("storage.quota.note")
          }}</span>
        </dd>
      </div>

      <div class="flex flex-col gap-1">
        <dt class="text-sm font-medium text-fg-muted">
          {{ t("storage.persistence.label") }}
        </dt>
        <dd class="flex flex-col gap-2" data-testid="storage-persistence">
          <span class="text-sm">{{
            status.persistence === "persisted"
              ? t("storage.persistence.persisted")
              : status.persistence === "best-effort"
                ? t("storage.persistence.bestEffort")
                : t("storage.persistence.unsupported")
          }}</span>
          <span v-if="status.persistence === 'best-effort'">
            <AppButton :disabled="requesting" @click="requestPersistence">
              {{
                requesting
                  ? t("storage.persistence.requesting")
                  : t("storage.persistence.request")
              }}
            </AppButton>
          </span>
        </dd>
      </div>
    </dl>

    <div aria-live="polite">
      <AppNotice
        v-if="requestOutcome && !requesting"
        :tone="
          requestOutcome === 'granted'
            ? 'success'
            : requestOutcome === 'denied'
              ? 'warning'
              : 'info'
        "
        data-testid="persistence-outcome"
      >
        {{
          requestOutcome === "granted"
            ? t("storage.persistence.granted")
            : requestOutcome === "denied"
              ? t("storage.persistence.denied")
              : t("storage.persistence.requestUnsupported")
        }}
      </AppNotice>
    </div>

    <AppNotice v-if="status?.usage?.nearQuota" tone="warning" role="alert">
      {{ t("storage.nearQuota") }}
    </AppNotice>
  </section>
</template>
