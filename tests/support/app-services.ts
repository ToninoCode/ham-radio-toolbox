import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { createApp, type App } from "vue";
import {
  APP_CONTAINER_KEY,
  createContainer,
  settingsServicesOf,
  type AppContainer,
  type ContainerOptions,
} from "@/app/container";
import { SETTINGS_SERVICES_KEY } from "@/modules/settings-backup";
import {
  silentDataChangeNotifier,
  type StorageEstimate,
  type StorageInfo,
} from "@/shared/application";
import { FakeClock } from "./database";

/*
 * Services for component and store tests (jsdom): a real container on an
 * isolated fake-indexeddb, a deterministic clock, no notifications between
 * tests and a scripted StorageInfo.
 */

export interface FakeStorageOptions {
  estimate?: StorageEstimate;
  persisted?: boolean;
  /** Outcome of `requestPersistence()`; `undefined` = no API. */
  grant?: boolean;
}

export function fakeStorageInfo(
  options: FakeStorageOptions = {},
): StorageInfo & {
  requests: number;
} {
  let persisted = options.persisted;
  const info = {
    requests: 0,
    estimate: async () => options.estimate,
    isPersisted: async () => persisted,
    async requestPersistence() {
      info.requests++;
      if (options.grant) persisted = true;
      return options.grant;
    },
  };
  return info;
}

export function createTestContainer(
  options: ContainerOptions = {},
): AppContainer {
  return createContainer({
    database: {
      name: `hrt-ui-${crypto.randomUUID()}`,
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    },
    clock: new FakeClock(),
    dataChanges: silentDataChangeNotifier,
    storageInfo: fakeStorageInfo({
      estimate: { usageBytes: 10 * 1024 * 1024, quotaBytes: 1024 ** 3 },
      persisted: false,
      grant: true,
    }),
    ...options,
  });
}

/** Provides of the container, as main.ts does. */
export function containerProvides(container: AppContainer) {
  return {
    [APP_CONTAINER_KEY as symbol]: container,
    [SETTINGS_SERVICES_KEY as symbol]: settingsServicesOf(container),
  };
}

/**
 * A Vue app with Pinia and the services, for store tests outside
 * components: setup stores reach the services through inject().
 */
export function createStoreTestApp(container = createTestContainer()): {
  app: App;
  pinia: Pinia;
  container: AppContainer;
} {
  const pinia = createPinia();
  const app = createApp({ render: () => null });
  app.use(pinia);
  app.provide(APP_CONTAINER_KEY, container);
  app.provide(SETTINGS_SERVICES_KEY, settingsServicesOf(container));
  setActivePinia(pinia);
  return { app, pinia, container };
}
