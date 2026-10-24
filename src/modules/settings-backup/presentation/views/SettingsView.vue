<script setup lang="ts">
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/shared/ui";
import BackupExportSection from "../components/BackupExportSection.vue";
import PreferencesSection from "../components/PreferencesSection.vue";
import RestoreSection from "../components/RestoreSection.vue";
import StationProfilesSection from "../components/StationProfilesSection.vue";
import StorageSection from "../components/StorageSection.vue";

const { t } = useI18n();
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6" data-testid="settings">
    <PageHeader :title="t('modules.settings-backup.title')">
      <p>{{ t("settings.intro") }}</p>
    </PageHeader>
    <StorageSection />
    <StationProfilesSection />
    <PreferencesSection />
    <div class="grid gap-6 lg:grid-cols-2">
      <BackupExportSection />
      <RestoreSection />
    </div>
  </div>
</template>
