<script setup lang="ts">
import { onMounted } from "vue";
import { formatBytes, useI18n } from "@/shared/i18n";
import { AppButton, AppCheckbox, AppIcon, AppNotice } from "@/shared/ui";
import { useBackupExport } from "../backup-export";
import { describeError } from "../error-messages";
import { useSettingsServices } from "../services";

/*
 * Backup export (FR-SET-05, ADR-0015): record counts and attachment size
 * before the export, attachments only on request, progress with cancel,
 * download offered only after the file has been read back and verified.
 */

const { t } = useI18n();
const backup = useBackupExport(useSettingsServices());
const { includeAttachments } = backup;

onMounted(() => void backup.loadInventory());
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
    aria-labelledby="backup-title"
    data-testid="backup-section"
  >
    <h2 id="backup-title" class="flex items-center gap-2 text-xl font-semibold">
      <AppIcon name="download" :size="22" />
      {{ t("backup.export.title") }}
    </h2>
    <p class="text-sm text-fg-muted">{{ t("backup.export.intro") }}</p>

    <div data-testid="backup-inventory" class="flex flex-col gap-1 text-sm">
      <p
        v-if="!backup.inventory.value && !backup.inventoryError.value"
        role="status"
      >
        {{ t("backup.export.inventoryLoading") }}
      </p>
      <AppNotice v-else-if="backup.inventoryError.value" tone="danger">
        <p>{{ describeError(backup.inventoryError.value).message }}</p>
        <p class="text-xs text-fg-muted">
          {{ describeError(backup.inventoryError.value).detail }}
        </p>
      </AppNotice>
      <template v-else-if="backup.inventory.value">
        <p class="font-medium">
          {{
            t("backup.export.records", {
              count: backup.inventory.value.recordCount,
            })
          }}
        </p>
        <p>
          {{
            backup.inventory.value.attachmentCount === 0
              ? t("backup.export.noAttachments")
              : t("backup.export.attachments", {
                  count: backup.inventory.value.attachmentCount,
                  size: formatBytes(backup.inventory.value.attachmentBytes),
                })
          }}
        </p>
        <p class="text-fg-muted">
          {{
            t("backup.export.limit", {
              limit: formatBytes(backup.inventory.value.limitBytes),
            })
          }}
        </p>
      </template>
    </div>

    <AppCheckbox
      v-model="includeAttachments"
      :label="t('backup.export.includeAttachments')"
      :hint="
        backup.inventory.value && backup.inventory.value.attachmentCount > 0
          ? t('backup.export.includeAttachmentsHint', {
              size: formatBytes(backup.inventory.value.attachmentBase64Bytes),
            })
          : undefined
      "
      :disabled="backup.busy.value"
      data-testid="backup-include-attachments"
    />
    <AppNotice v-if="backup.overLimit.value" tone="warning">
      {{
        t("backup.export.overLimit", {
          limit: formatBytes(backup.inventory.value?.limitBytes ?? 0),
        })
      }}
    </AppNotice>

    <div class="flex flex-wrap gap-2">
      <AppButton
        variant="primary"
        icon="database"
        :disabled="backup.busy.value || backup.overLimit.value"
        data-testid="backup-create"
        @click="backup.create"
      >
        {{ t("backup.export.create") }}
      </AppButton>
      <AppButton
        v-if="backup.busy.value"
        data-testid="backup-cancel"
        @click="backup.cancel"
      >
        {{ t("backup.export.cancel") }}
      </AppButton>
    </div>

    <div
      aria-live="polite"
      data-testid="backup-status"
      class="flex flex-col gap-3"
    >
      <p v-if="backup.state.value.step === 'creating'" class="text-sm">
        {{ t("backup.export.creating") }}
      </p>
      <p v-else-if="backup.state.value.step === 'verifying'" class="text-sm">
        {{ t("backup.export.verifying") }}
      </p>
      <AppNotice
        v-else-if="backup.state.value.step === 'cancelled'"
        tone="info"
      >
        {{ t("backup.export.cancelled") }}
      </AppNotice>
      <AppNotice
        v-else-if="backup.state.value.step === 'failed'"
        tone="danger"
        :title="t('backup.export.failed')"
        data-testid="backup-error"
      >
        <p>{{ describeError(backup.state.value.error).message }}</p>
        <p class="text-xs text-fg-muted">
          {{ describeError(backup.state.value.error).detail }}
        </p>
      </AppNotice>
      <AppNotice
        v-else-if="backup.state.value.step === 'ready'"
        tone="success"
        :title="t('backup.export.ready')"
        data-testid="backup-ready"
      >
        <p class="break-all">
          {{
            t("backup.export.readyDetail", {
              name: backup.state.value.file.fileName,
              size: formatBytes(backup.state.value.file.sizeBytes),
              count: backup.state.value.verification.recordCount,
            })
          }}
        </p>
        <p v-if="backup.downloaded.value" class="mt-1">
          {{ t("backup.export.downloaded") }}
        </p>
        <template #actions>
          <AppButton
            variant="primary"
            icon="download"
            data-testid="backup-download"
            @click="backup.download"
          >
            {{ t("backup.export.download") }}
          </AppButton>
        </template>
      </AppNotice>
      <AppNotice v-if="backup.downloadError.value" tone="danger" role="alert">
        <p>{{ describeError(backup.downloadError.value).message }}</p>
        <p class="text-xs text-fg-muted">
          {{ describeError(backup.downloadError.value).detail }}
        </p>
      </AppNotice>
    </div>

    <p class="text-sm text-fg-muted" data-testid="backup-checksum-note">
      {{ t("backup.export.checksumNote") }}
    </p>
    <p class="text-sm text-fg-muted">{{ t("backup.export.privacy") }}</p>
  </section>
</template>
