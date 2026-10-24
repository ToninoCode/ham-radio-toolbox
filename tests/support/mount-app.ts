import { mount, type ComponentMountingOptions } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import type { Component } from "vue";
import { createMemoryHistory, type Router } from "vue-router";
import type { AppContainer } from "@/app/container";
import { moduleCatalog } from "@/app/modules";
import { createAppRouter } from "@/app/router";
import { MODULE_CATALOG_KEY } from "@/shared/modules";
import { containerProvides, createTestContainer } from "./app-services";

export interface TestApp {
  router: Router;
  pinia: Pinia;
}

export interface MountedApp extends TestApp {
  container: AppContainer;
}

/** Router (memory history), Pinia and module catalog as wired in main.ts. */
export async function createTestApp(initialPath = "/"): Promise<TestApp> {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(moduleCatalog, createMemoryHistory());
  await router.push(initialPath);
  await router.isReady();
  return { router, pinia };
}

export async function mountWithApp<C extends Component>(
  component: C,
  options: {
    path?: string;
    attachTo?: HTMLElement;
    /** Services of the app; a fresh test container by default. */
    container?: AppContainer;
  } & Omit<ComponentMountingOptions<C>, "global"> = {},
) {
  const {
    path = "/",
    container = createTestContainer(),
    ...mountOptions
  } = options;
  const { router, pinia } = await createTestApp(path);
  const wrapper = mount(component, {
    ...(mountOptions as ComponentMountingOptions<C>),
    global: {
      plugins: [router, pinia],
      provide: {
        [MODULE_CATALOG_KEY as symbol]: moduleCatalog,
        ...containerProvides(container),
      },
    },
  });
  return { wrapper, router, pinia, container };
}
