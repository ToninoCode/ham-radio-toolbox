import "@/shared/ui/styles/main.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import {
  SETTINGS_SERVICES_KEY,
  usePreferencesStore,
  useStorageStatusStore,
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
import { settleWithin, STARTUP_PREFERENCES_WAIT_MS } from "./startup";
import { useThemeStore } from "./theme/theme-store";

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
  // Read only: persist() is asked for by the user, from Settings.
  void useStorageStatusStore(pinia).readPersistence();
  const preferences = usePreferencesStore(pinia);
  useThemeStore(pinia).start();
  await settleWithin(preferences.load(), STARTUP_PREFERENCES_WAIT_MS);

  app.mount("#app");
}

void bootstrap();
