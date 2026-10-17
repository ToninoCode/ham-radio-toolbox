<script setup lang="ts">
import { onScopeDispose, watch } from "vue";
import { useI18n } from "@/shared/i18n";
import { AppIcon, AppIconButton } from "@/shared/ui";
import type { PwaUpdate } from "./use-pwa-update";

const props = defineProps<{ pwa: PwaUpdate }>();

/** The informational "offline ready" notice hides itself after a while. */
const OFFLINE_READY_TIMEOUT_MS = 10_000;

const { t } = useI18n();
const { offlineReady, error } = props.pwa;

let offlineTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  offlineReady,
  (ready) => {
    clearTimeout(offlineTimer);
    if (ready) {
      offlineTimer = setTimeout(
        props.pwa.dismissOfflineReady,
        OFFLINE_READY_TIMEOUT_MS,
      );
    }
  },
  { immediate: true },
);
onScopeDispose(() => clearTimeout(offlineTimer));

// Rendered in the page flow above the content (AppShell "notifications"
// slot): on small screens it pushes the page down instead of covering
// controls. Empty, it takes no space.
</script>

<template>
  <section
    :aria-label="t('pwa.region')"
    class="mx-auto max-w-7xl"
    data-testid="pwa-status"
  >
    <div aria-live="polite">
      <div
        v-if="offlineReady"
        class="mb-4 flex items-start gap-2 rounded-card border border-l-4 border-success bg-surface p-3"
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
      class="mb-4 flex items-start gap-2 rounded-card border border-l-4 border-danger bg-surface p-3"
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
