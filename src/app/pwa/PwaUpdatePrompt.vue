<script setup lang="ts">
import { onScopeDispose, watch } from "vue";
import { useI18n } from "@/shared/i18n";
import { AppButton, AppIcon, AppIconButton } from "@/shared/ui";
import { usePwaUpdate, type PwaUpdate } from "./use-pwa-update";

const props = defineProps<{
  /** Injected in tests; defaults to the real service worker registration. */
  pwa?: PwaUpdate;
}>();

/** The informational "offline ready" notice hides itself after a while. */
const OFFLINE_READY_TIMEOUT_MS = 10_000;

const { t } = useI18n();
const pwa = props.pwa ?? usePwaUpdate();
const { needRefresh, offlineReady, updating, error } = pwa;

let offlineTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  offlineReady,
  (ready) => {
    clearTimeout(offlineTimer);
    if (ready) {
      offlineTimer = setTimeout(
        pwa.dismissOfflineReady,
        OFFLINE_READY_TIMEOUT_MS,
      );
    }
  },
  { immediate: true },
);
onScopeDispose(() => clearTimeout(offlineTimer));

// Non-modal notifications: they never steal focus while the user is typing
// (e.g. a QSO); the live region announces them politely.
</script>

<template>
  <section
    :aria-label="t('pwa.region')"
    class="pointer-events-none fixed inset-x-2 bottom-20 z-40 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
    data-testid="pwa-notifications"
  >
    <div aria-live="polite" class="flex flex-col gap-2">
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

      <div
        v-else-if="offlineReady"
        class="pointer-events-auto flex items-start gap-2 rounded-card border border-l-4 border-success bg-surface p-3 shadow-lg"
        data-testid="pwa-offline-ready"
      >
        <span class="pt-2.5 text-success"
          ><AppIcon name="online" :size="20"
        /></span>
        <div class="flex-1 pt-2">
          <p class="font-semibold">{{ t("pwa.offlineReady") }}</p>
          <p class="text-sm text-fg-muted">{{ t("pwa.offlineReadyDetail") }}</p>
        </div>
        <AppIconButton
          icon="close"
          :label="t('pwa.dismiss')"
          @click="pwa.dismissOfflineReady"
        />
      </div>
    </div>

    <div
      v-if="error"
      role="alert"
      class="pointer-events-auto flex items-start gap-2 rounded-card border border-l-4 border-danger bg-surface p-3 shadow-lg"
      data-testid="pwa-error"
    >
      <span class="pt-2.5 text-danger"
        ><AppIcon name="offline" :size="20"
      /></span>
      <p class="flex-1 pt-2 text-sm">
        {{
          error === "register" ? t("pwa.registerError") : t("pwa.updateError")
        }}
      </p>
      <AppIconButton
        icon="close"
        :label="t('pwa.dismiss')"
        @click="pwa.dismissError"
      />
    </div>
  </section>
</template>
