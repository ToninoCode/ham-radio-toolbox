import { mount, type ComponentMountingOptions } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import type { Component } from "vue";
import { createMemoryHistory, type Router } from "vue-router";
import { moduleCatalog } from "@/app/modules";
import { createAppRouter } from "@/app/router";
import { MODULE_CATALOG_KEY } from "@/shared/modules";

export interface TestApp {
  router: Router;
  pinia: Pinia;
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
  options: { path?: string; attachTo?: HTMLElement } & Omit<
    ComponentMountingOptions<C>,
    "global"
  > = {},
) {
  const { path = "/", ...mountOptions } = options;
  const { router, pinia } = await createTestApp(path);
  const wrapper = mount(component, {
    ...(mountOptions as ComponentMountingOptions<C>),
    global: {
      plugins: [router, pinia],
      provide: { [MODULE_CATALOG_KEY as symbol]: moduleCatalog },
    },
  });
  return { wrapper, router, pinia };
}
