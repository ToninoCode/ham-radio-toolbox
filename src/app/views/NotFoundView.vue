<script setup lang="ts">
import { useRoute } from "vue-router";
import { useI18n } from "@/shared/i18n";
import { useModuleCatalog } from "@/shared/modules";
import { AppIcon, buttonClasses, PageHeader } from "@/shared/ui";

const { t } = useI18n();
const route = useRoute();
const catalog = useModuleCatalog();
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6" data-testid="not-found">
    <PageHeader :title="t('notFound.title')">
      <p class="break-all">
        {{ t("notFound.body", { path: route.fullPath }) }}
      </p>
    </PageHeader>
    <div>
      <RouterLink :to="catalog.home.path" :class="buttonClasses('primary')">
        <AppIcon name="arrow-left" :size="20" />
        {{ t("notFound.backToDashboard") }}
      </RouterLink>
    </div>
  </div>
</template>
