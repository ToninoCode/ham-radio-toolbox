<script setup lang="ts">
import { useI18n } from "@/shared/i18n";
import { AppButton, AppIcon } from "@/shared/ui";
import type { PwaUpdate } from "./use-pwa-update";

const props = defineProps<{ pwa: PwaUpdate }>();

const { t } = useI18n();
const { needRefresh, updating } = props.pwa;

// Floating, non-modal: the only notice that needs a decision. It never steals
// focus (e.g. while typing a QSO) and is announced by the live region.
</script>

<template>
  <section
    :aria-label="t('pwa.updateRegion')"
    class="pointer-events-none fixed inset-x-2 bottom-20 z-40 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
    data-testid="pwa-notifications"
  >
    <div aria-live="polite">
      <div
        v-if="needRefresh"
        class="pointer-events-auto flex flex-col gap-3 rounded-card border border-l-4 border-accent bg-surface p-4 shadow-lg"
        data-testid="pwa-update"
      >
        <p class="flex items-start gap-2 font-semibold">
          <AppIcon name="info" :size="20" />
          {{ t("pwa.updateAvailable") }}
        </p>
        <p class="text-sm text-fg-muted">{{ t("pwa.updateDetail") }}</p>
        <div class="flex flex-wrap justify-end gap-2">
          <AppButton variant="ghost" :disabled="updating" @click="pwa.postpone">
            {{ t("pwa.later") }}
          </AppButton>
          <AppButton
            variant="primary"
            :disabled="updating"
            data-testid="pwa-update-confirm"
            @click="pwa.update"
          >
            {{ updating ? t("pwa.updating") : t("pwa.update") }}
          </AppButton>
        </div>
      </div>
    </div>
  </section>
</template>
