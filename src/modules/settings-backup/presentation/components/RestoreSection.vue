<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from "vue";
import {
  TABLE_NAMES,
  type RestoreMode,
  type TableName,
} from "@/shared/application";
import {
  formatBytes,
  formatUtcDateTime,
  reportMessage,
  useI18n,
} from "@/shared/i18n";
import {
  AppButton,
  AppCheckbox,
  AppDialog,
  AppIcon,
  AppNotice,
  SegmentedControl,
  type SegmentedOption,
} from "@/shared/ui";
import type { RestorePreview } from "../../application/backup-ports";
import { DEFAULT_MAX_BACKUP_BYTES } from "../../domain/backup-manifest";
import { describeError } from "../error-messages";
import { usePreferencesStore } from "../preferences-store";
import { useRestoreFlow } from "../restore-flow";
import { useSettingsServices } from "../services";
import { useStationProfilesStore } from "../station-profiles-store";

/*
 * Restore (FR-SET-06, DATABASE.md § 9.2): local file → analysis (no
 * writes, cancellable) → contents and problems → mode → preview of the
 * effects → explicit confirmation (acknowledged when local records are
 * deleted) → one atomic transaction, which cannot be interrupted once
 * started → refresh of the app state.
 */

const { t } = useI18n();
const preferences = usePreferencesStore();
const profiles = useStationProfilesStore();
const flow = useRestoreFlow(useSettingsServices(), async () => {
  await Promise.all([preferences.load(), profiles.load()]);
});
const confirmDialog = useTemplateRef<InstanceType<typeof AppDialog>>("confirm");
const fileInput = useTemplateRef<HTMLInputElement>("file");
const inputId = useId();
const acknowledged = ref(false);

const state = flow.state;

const modeOptions = computed<SegmentedOption<RestoreMode>[]>(() => [
  { value: "replace", label: t("backup.restore.mode.replace") },
  { value: "merge", label: t("backup.restore.mode.merge") },
]);
const mode = computed({
  get: () => flow.mode.value,
  set: (value: RestoreMode) => flow.setMode(value),
});

const analysis = computed(() => {
  const current = state.value;
  switch (current.step) {
    case "invalid":
    case "analyzed":
    case "previewing":
    case "commit-failed":
      return current.analysis;
    case "previewed":
    case "committing":
      return current.preview.analysis;
    default:
      return undefined;
  }
});

const preview = computed<RestorePreview | undefined>(() =>
  state.value.step === "previewed" || state.value.step === "committing"
    ? state.value.preview
    : undefined,
);

const busy = computed(
  () =>
    state.value.step === "analyzing" ||
    state.value.step === "previewing" ||
    state.value.step === "committing",
);

function total(
  plan: RestorePreview,
  key: "inserted" | "updated" | "deleted",
): number {
  return TABLE_NAMES.reduce((sum, table) => sum + plan.effects[table][key], 0);
}

const deletedTotal = computed(() =>
  preview.value ? total(preview.value, "deleted") : 0,
);
const changes = computed(() =>
  preview.value
    ? total(preview.value, "inserted") +
      total(preview.value, "updated") +
      deletedTotal.value
    : 0,
);
const destructive = computed(
  () => preview.value?.mode === "replace" && deletedTotal.value > 0,
);
const withoutAttachments = computed(
  () =>
    preview.value?.mode === "replace" &&
    !preview.value.analysis.content.includesAttachments,
);

const restoredCount = computed(() =>
  state.value.step === "done"
    ? TABLE_NAMES.reduce(
        (sum, table) =>
          state.value.step === "done"
            ? sum + state.value.outcome.counts[table]
            : sum,
        0,
      )
    : 0,
);

const tablesOfFile = computed(() =>
  analysis.value
    ? (Object.keys(analysis.value.manifest.counts) as TableName[])
    : [],
);

function tableLabel(table: string): string {
  return (TABLE_NAMES as readonly string[]).includes(table)
    ? t(`tables.${table as TableName}`)
    : table;
}

/** `qso_logs[3]` → "QSO, record n. 4"; other locations as they are. */
function locationLabel(location: string): string {
  const match = /^([a-z_]+)\[(\d+)\]$/.exec(location);
  if (!match) return location;
  return t("backup.restore.invalid.record", {
    table: tableLabel(match[1] ?? ""),
    position: Number(match[2]) + 1,
  });
}

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void flow.analyze(file);
}

function chooseAnother(): void {
  flow.reset();
  if (fileInput.value) fileInput.value.value = "";
}

function askConfirm(): void {
  acknowledged.value = false;
  confirmDialog.value?.open();
}

async function confirmCommit(): Promise<void> {
  confirmDialog.value?.close();
  await flow.commit();
}
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
    aria-labelledby="restore-title"
    data-testid="restore-section"
  >
    <h2
      id="restore-title"
      class="flex items-center gap-2 text-xl font-semibold"
    >
      <AppIcon name="upload" :size="22" />
      {{ t("backup.restore.title") }}
    </h2>
    <p class="text-sm text-fg-muted">{{ t("backup.restore.intro") }}</p>

    <div class="flex flex-col gap-1">
      <label :for="inputId" class="font-medium">
        {{ t("backup.restore.choose") }}
      </label>
      <input
        :id="inputId"
        ref="file"
        type="file"
        accept=".json,application/json"
        :disabled="busy"
        :aria-describedby="`${inputId}-hint`"
        class="min-h-touch max-w-full text-sm file:mr-3 file:min-h-touch file:rounded-lg file:border file:border-border-strong file:bg-surface file:px-4 file:font-medium file:text-fg"
        data-testid="restore-file"
        @change="onFile"
      />
      <p :id="`${inputId}-hint`" class="text-sm text-fg-muted">
        {{
          t("backup.restore.chooseHint", {
            limit: formatBytes(DEFAULT_MAX_BACKUP_BYTES),
          })
        }}
      </p>
    </div>

    <div
      aria-live="polite"
      class="flex flex-col gap-3"
      data-testid="restore-status"
    >
      <div
        v-if="state.step === 'analyzing'"
        class="flex flex-wrap items-center gap-3"
      >
        <p class="text-sm">{{ t("backup.restore.analyzing") }}</p>
        <AppButton
          data-testid="restore-cancel-analysis"
          @click="flow.cancelAnalysis"
        >
          {{ t("backup.restore.cancelAnalysis") }}
        </AppButton>
      </div>
      <p v-else-if="state.step === 'previewing'" class="text-sm">
        {{ t("backup.restore.previewing") }}
      </p>
      <AppNotice v-else-if="state.step === 'discarded'" tone="info">
        {{ t("backup.restore.discarded") }}
      </AppNotice>
    </div>

    <AppNotice
      v-if="state.step === 'analysis-failed'"
      tone="danger"
      role="alert"
      :title="t('backup.restore.analysisFailed')"
      data-testid="restore-error"
    >
      <p>{{ describeError(state.error).message }}</p>
      <p>{{ t("backup.restore.unchanged") }}</p>
      <p class="text-xs text-fg-muted">
        {{ describeError(state.error).detail }}
      </p>
    </AppNotice>

    <!-- Contents of the file -->
    <div
      v-if="analysis"
      class="flex flex-col gap-3"
      data-testid="restore-summary"
    >
      <h3 class="text-lg font-semibold">
        {{ t("backup.restore.summary.title") }}
      </h3>
      <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt class="text-fg-muted">{{ t("backup.restore.summary.file") }}</dt>
        <dd class="break-all">{{ analysis.fileName }}</dd>
        <dt class="text-fg-muted">{{ t("backup.restore.summary.size") }}</dt>
        <dd>{{ formatBytes(analysis.sizeBytes) }}</dd>
        <dt class="text-fg-muted">
          {{ t("backup.restore.summary.exportedAt") }}
        </dt>
        <dd>{{ formatUtcDateTime(analysis.manifest.exportedAt) }}</dd>
        <dt class="text-fg-muted">
          {{ t("backup.restore.summary.appVersion") }}
        </dt>
        <dd>{{ analysis.manifest.appVersion }}</dd>
        <dt class="text-fg-muted">
          {{ t("backup.restore.summary.schemaVersion") }}
        </dt>
        <dd data-testid="restore-schema-version">
          {{ analysis.manifest.schemaVersion }}
        </dd>
        <dt class="text-fg-muted">
          {{ t("backup.restore.summary.formatVersion") }}
        </dt>
        <dd>{{ analysis.manifest.backupFormatVersion }}</dd>
        <dt class="text-fg-muted">
          {{ t("backup.restore.summary.attachments") }}
        </dt>
        <dd>
          {{
            analysis.manifest.includesAttachments
              ? t("backup.restore.summary.included")
              : t("backup.restore.summary.excluded")
          }}
        </dd>
      </dl>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm" data-testid="restore-counts">
          <caption class="sr-only">
            {{
              t("backup.restore.summary.caption")
            }}
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th scope="col" class="py-1 pr-4 font-medium">
                {{ t("backup.restore.summary.table") }}
              </th>
              <th scope="col" class="py-1 text-right font-medium">
                {{ t("backup.restore.summary.records") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="table in tablesOfFile"
              :key="table"
              class="border-b border-border last:border-0"
            >
              <th scope="row" class="py-1 pr-4 font-normal">
                {{ tableLabel(table) }}
              </th>
              <td class="py-1 text-right tabular-nums">
                {{ analysis.manifest.counts[table] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppNotice v-if="analysis.droppedByMigration > 0" tone="info">
        {{
          t("backup.restore.dropped", { count: analysis.droppedByMigration })
        }}
      </AppNotice>
    </div>

    <!-- Problems: the backup cannot be restored -->
    <AppNotice
      v-if="state.step === 'invalid'"
      tone="danger"
      role="alert"
      :title="t('backup.restore.invalid.title')"
      data-testid="restore-invalid"
    >
      <p>
        {{
          t("backup.restore.invalid.body", {
            count: Math.max(
              state.analysis.invalidCount,
              state.analysis.errors.length,
            ),
          })
        }}
        {{ t("backup.restore.unchanged") }}
      </p>
      <p v-if="state.analysis.errorsTruncated">
        {{
          t("backup.restore.invalid.shown", {
            count: state.analysis.errors.length,
          })
        }}
      </p>
      <div class="mt-2 max-h-80 overflow-auto">
        <table class="w-full text-left text-sm" data-testid="restore-errors">
          <caption class="sr-only">
            {{
              t("backup.restore.invalid.caption")
            }}
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th scope="col" class="py-1 pr-3 font-medium">
                {{ t("backup.restore.invalid.where") }}
              </th>
              <th scope="col" class="py-1 pr-3 font-medium">
                {{ t("backup.restore.invalid.field") }}
              </th>
              <th scope="col" class="py-1 font-medium">
                {{ t("backup.restore.invalid.problem") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in state.analysis.errors"
              :key="index"
              class="border-b border-border align-top last:border-0"
            >
              <td class="py-1 pr-3">{{ locationLabel(entry.location) }}</td>
              <td class="py-1 pr-3 font-mono text-xs break-all">
                {{ entry.field }}
              </td>
              <td class="py-1">
                {{ reportMessage(entry.code) }}
                <span class="block text-xs text-fg-muted">{{
                  entry.code
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #actions>
        <AppButton data-testid="restore-discard" @click="flow.discard">
          {{ t("backup.restore.discard") }}
        </AppButton>
      </template>
    </AppNotice>

    <!-- Mode and preview -->
    <div
      v-if="
        state.step === 'analyzed' ||
        state.step === 'previewing' ||
        state.step === 'previewed' ||
        (state.step === 'commit-failed' && analysis?.content)
      "
      class="flex flex-col gap-3"
    >
      <SegmentedControl
        v-model="mode"
        :legend="t('backup.restore.mode.legend')"
        :options="modeOptions"
        data-testid="restore-mode"
      />
      <p class="text-sm text-fg-muted">
        {{
          mode === "replace"
            ? t("backup.restore.mode.replaceHint")
            : t("backup.restore.mode.mergeHint")
        }}
      </p>
      <div class="flex flex-wrap gap-2">
        <AppButton
          v-if="state.step !== 'previewed'"
          variant="primary"
          :disabled="busy"
          data-testid="restore-preview"
          @click="flow.preview"
        >
          {{ t("backup.restore.preview") }}
        </AppButton>
        <AppButton
          :disabled="busy"
          data-testid="restore-discard"
          @click="flow.discard"
        >
          {{ t("backup.restore.discard") }}
        </AppButton>
      </div>
    </div>

    <div
      v-if="preview"
      class="flex flex-col gap-3"
      data-testid="restore-preview-result"
    >
      <h3 class="text-lg font-semibold">
        {{ t("backup.restore.effects.title") }}
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm" data-testid="restore-effects">
          <caption class="sr-only">
            {{
              t("backup.restore.effects.caption")
            }}
          </caption>
          <thead>
            <tr class="border-b border-border">
              <th scope="col" class="py-1 pr-3 font-medium">
                {{ t("backup.restore.effects.table") }}
              </th>
              <th scope="col" class="py-1 pr-3 text-right font-medium">
                {{ t("backup.restore.effects.inserted") }}
              </th>
              <th scope="col" class="py-1 pr-3 text-right font-medium">
                {{ t("backup.restore.effects.updated") }}
              </th>
              <th scope="col" class="py-1 pr-3 text-right font-medium">
                {{ t("backup.restore.effects.deleted") }}
              </th>
              <th scope="col" class="py-1 pr-3 text-right font-medium">
                {{ t("backup.restore.effects.unchanged") }}
              </th>
              <th scope="col" class="py-1 text-right font-medium">
                {{ t("backup.restore.effects.skipped") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="table in TABLE_NAMES"
              :key="table"
              class="border-b border-border last:border-0"
              :data-table="table"
            >
              <th scope="row" class="py-1 pr-3 font-normal">
                {{ tableLabel(table) }}
              </th>
              <td
                class="py-1 pr-3 text-right tabular-nums"
                data-effect="inserted"
              >
                {{ preview.effects[table].inserted }}
              </td>
              <td
                class="py-1 pr-3 text-right tabular-nums"
                data-effect="updated"
              >
                {{ preview.effects[table].updated }}
              </td>
              <td
                class="py-1 pr-3 text-right tabular-nums"
                data-effect="deleted"
              >
                {{ preview.effects[table].deleted }}
              </td>
              <td
                class="py-1 pr-3 text-right tabular-nums"
                data-effect="unchanged"
              >
                {{ preview.effects[table].unchanged }}
              </td>
              <td class="py-1 text-right tabular-nums" data-effect="skipped">
                {{ preview.effects[table].skipped }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="withoutAttachments"
        class="flex flex-col gap-2"
        data-testid="restore-attachments"
      >
        <AppNotice v-if="preview.effects.attachments.unchanged > 0" tone="info">
          {{
            t("backup.restore.attachmentsKept", {
              count: preview.effects.attachments.unchanged,
            })
          }}
        </AppNotice>
        <AppNotice
          v-if="preview.effects.attachments.deleted > 0"
          tone="warning"
        >
          {{
            t("backup.restore.attachmentsDeleted", {
              count: preview.effects.attachments.deleted,
            })
          }}
        </AppNotice>
      </div>

      <AppNotice
        v-if="preview.conflicts.length > 0"
        tone="warning"
        :title="
          t('backup.restore.conflicts.title', {
            count: preview.conflicts.length,
          })
        "
        data-testid="restore-conflicts"
      >
        <div class="max-h-60 overflow-auto">
          <table class="w-full text-left text-sm">
            <caption class="sr-only">
              {{
                t("backup.restore.conflicts.caption")
              }}
            </caption>
            <thead>
              <tr class="border-b border-border">
                <th scope="col" class="py-1 pr-3 font-medium">
                  {{ t("backup.restore.effects.table") }}
                </th>
                <th scope="col" class="py-1 pr-3 font-medium">
                  {{ t("backup.restore.conflicts.record") }}
                </th>
                <th scope="col" class="py-1 font-medium">
                  {{ t("backup.restore.invalid.problem") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="conflict in preview.conflicts"
                :key="`${conflict.table}:${conflict.key}`"
                class="border-b border-border align-top last:border-0"
              >
                <td class="py-1 pr-3">{{ tableLabel(conflict.table) }}</td>
                <td class="py-1 pr-3 font-mono text-xs break-all">
                  {{ conflict.key }}
                </td>
                <td class="py-1">{{ reportMessage(conflict.code) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppNotice>

      <AppNotice v-if="changes === 0" tone="info">
        {{ t("backup.restore.noChanges") }}
      </AppNotice>

      <div v-if="state.step === 'previewed'" class="flex flex-wrap gap-2">
        <AppButton
          :variant="destructive ? 'danger' : 'primary'"
          :disabled="changes === 0"
          data-testid="restore-confirm"
          @click="askConfirm"
        >
          {{ t("backup.restore.confirm") }}
        </AppButton>
      </div>
    </div>

    <AppNotice
      v-if="state.step === 'committing'"
      tone="warning"
      role="status"
      data-testid="restore-committing"
    >
      {{ t("backup.restore.committing") }}
    </AppNotice>

    <AppNotice
      v-if="state.step === 'commit-failed'"
      tone="danger"
      role="alert"
      :title="t('backup.restore.failed')"
      data-testid="restore-error"
    >
      <p>{{ describeError(state.error).message }}</p>
      <p>{{ t("backup.restore.unchanged") }}</p>
      <p class="text-xs text-fg-muted">
        {{ describeError(state.error).detail }}
      </p>
    </AppNotice>

    <AppNotice
      v-if="state.step === 'done'"
      tone="success"
      role="status"
      :title="t('backup.restore.done.title')"
      data-testid="restore-done"
    >
      {{ t("backup.restore.done.body", { count: restoredCount }) }}
    </AppNotice>

    <div
      v-if="
        state.step === 'done' ||
        state.step === 'discarded' ||
        state.step === 'analysis-failed' ||
        state.step === 'commit-failed'
      "
    >
      <AppButton data-testid="restore-another" @click="chooseAnother">
        {{ t("backup.restore.another") }}
      </AppButton>
    </div>

    <AppDialog ref="confirm" :title="t('backup.restore.dialog.title')">
      <template v-if="preview">
        <p v-if="preview.mode === 'replace'">
          {{ t("backup.restore.dialog.replaceBody", { count: deletedTotal }) }}
        </p>
        <p v-else>{{ t("backup.restore.dialog.mergeBody") }}</p>
        <p class="font-medium">{{ t("backup.restore.dialog.irreversible") }}</p>
        <AppCheckbox
          v-if="destructive"
          v-model="acknowledged"
          :label="t('backup.restore.dialog.acknowledge')"
          data-testid="restore-acknowledge"
        />
      </template>
      <template #actions>
        <AppButton @click="confirmDialog?.close()">
          {{ t("backup.restore.dialog.cancel") }}
        </AppButton>
        <AppButton
          :variant="destructive ? 'danger' : 'primary'"
          :disabled="destructive && !acknowledged"
          data-testid="restore-commit"
          @click="confirmCommit"
        >
          {{
            preview?.mode === "merge"
              ? t("backup.restore.dialog.mergeAction")
              : t("backup.restore.dialog.replaceAction")
          }}
        </AppButton>
      </template>
    </AppDialog>
  </section>
</template>
