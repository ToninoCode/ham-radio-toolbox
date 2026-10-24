import "@/shared/ui/styles/main.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import {
  SETTINGS_SERVICES_KEY,
  usePreferencesStore,
} from "@/modules/settings-backup";
import { MODULE_CATALOG_KEY } from "@/shared/modules";
import App from "./App.vue";
import {
  APP_CONTAINER_KEY,
  createContainer,
  settingsServicesOf,
} from "./container";
import { moduleCatalog } from "./modules";
import { useDatabaseStatusStore } from "./persistence/database-status-store";
import { createAppRouter } from "./router";
import { useThemeStore } from "./theme/theme-store";

/**
 * Longest wait for the stored preferences before mounting. Reading them
 * usually takes a few milliseconds; waiting avoids a theme switch and a
 * favourites list that pops in after the page appears. If the database is
 * slow or blocked by another tab, the app mounts with the defaults and
 * applies the stored values when they arrive.
 */
const STARTUP_PREFERENCES_WAIT_MS = 500;

function within(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    void promise.finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function bootstrap(): Promise<void> {
  const pinia = createPinia();
  const router = createAppRouter(moduleCatalog);
  const container = createContainer();

  const app = createApp(App);
  app.use(pinia);
  app.use(router);
  app.provide(MODULE_CATALOG_KEY, moduleCatalog);
  app.provide(APP_CONTAINER_KEY, container);
  app.provide(SETTINGS_SERVICES_KEY, settingsServicesOf(container));

  useDatabaseStatusStore(pinia).start({
    lifecycle: container.databaseLifecycle,
    database: container.database,
  });
  const preferences = usePreferencesStore(pinia);
  useThemeStore(pinia).start();
  await within(preferences.load(), STARTUP_PREFERENCES_WAIT_MS);

  app.mount("#app");

  // NFR-REL-03: ask the browser to keep the data (no prompt in Chromium).
  void container.services.storage.ensurePersistence();
}

void bootstrap();
