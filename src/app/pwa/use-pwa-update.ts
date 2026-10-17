import { ref, type Ref } from "vue";
import { useRegisterSW } from "virtual:pwa-register/vue";

/** How often a long-running session (e.g. a tablet in the shack) checks for updates. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type PwaError = "register" | "update";

export interface PwaUpdate {
  /** A new version is installed and waiting for the user's confirmation. */
  needRefresh: Ref<boolean>;
  /** The app shell is precached: the app works offline. */
  offlineReady: Ref<boolean>;
  updating: Ref<boolean>;
  error: Ref<PwaError | null>;
  /** Activates the waiting service worker and reloads the page. */
  update: () => Promise<void>;
  /** Postpones the update; it is offered again at the next start. */
  postpone: () => void;
  dismissOfflineReady: () => void;
  dismissError: () => void;
}

type RegisterSW = typeof useRegisterSW;

/**
 * Wraps the official `virtual:pwa-register/vue` API (registerType "prompt",
 * ARCHITECTURE.md § 8): no update is applied without the user's consent.
 * `register` is injectable for unit tests.
 */
export function usePwaUpdate(register: RegisterSW = useRegisterSW): PwaUpdate {
  const updating = ref(false);
  const error = ref<PwaError | null>(null);

  const { needRefresh, offlineReady, updateServiceWorker } = register({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (!navigator.onLine || registration.installing) return;
        registration.update().catch(() => {
          // Transient network failure: the next interval retries.
        });
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError() {
      error.value = "register";
    },
  });

  async function update(): Promise<void> {
    updating.value = true;
    try {
      await updateServiceWorker(true);
    } catch {
      error.value = "update";
    } finally {
      updating.value = false;
    }
  }

  return {
    needRefresh,
    offlineReady,
    updating,
    error,
    update,
    postpone: () => {
      needRefresh.value = false;
    },
    dismissOfflineReady: () => {
      offlineReady.value = false;
    },
    dismissError: () => {
      error.value = null;
    },
  };
}
