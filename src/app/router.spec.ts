import { describe, expect, it } from "vitest";
import { createTestApp, mountWithApp } from "../../tests/support/mount-app";
import App from "./App.vue";
import { moduleCatalog } from "./modules";
import { buildRoutes, NOT_FOUND_ROUTE } from "./router";

describe("routes", () => {
  it("defines one lazy route per module plus the 404 route", () => {
    const routes = buildRoutes(moduleCatalog);
    expect(routes).toHaveLength(15);
    for (const route of routes) {
      expect(typeof route.component).toBe("function");
    }
    expect(routes.at(-1)?.name).toBe(NOT_FOUND_ROUTE);
  });

  it.each(moduleCatalog.all.map((m) => [m.id, m.path] as const))(
    "%s is reachable at %s",
    async (id, path) => {
      const { router } = await createTestApp(path);
      expect(router.currentRoute.value.name).toBe(id);
      expect(router.currentRoute.value.meta.moduleId).toBe(id);
    },
  );

  it("sends unknown paths to the not-found route", async () => {
    const { router } = await createTestApp("/does-not-exist/42");
    expect(router.currentRoute.value.name).toBe(NOT_FOUND_ROUTE);
  });
});

describe("navigation", () => {
  it("renders the dashboard at the root", async () => {
    const { wrapper } = await mountWithApp(App, { path: "/" });
    await flushLazyRoute();
    expect(wrapper.find('[data-testid="dashboard"]').exists()).toBe(true);
    expect(document.title).toBe("Ham Radio Toolbox");
  });

  it("renders the 'In sviluppo' page for a module not implemented yet", async () => {
    const { wrapper } = await mountWithApp(App, { path: "/ham-logbook" });
    await flushLazyRoute();
    const page = wrapper.find('[data-testid="under-development"]');
    expect(page.exists()).toBe(true);
    expect(page.find("h1").text()).toBe("Logbook HAM");
    expect(page.text()).toContain("In sviluppo");
    expect(page.text()).toContain("Milestone M3");
    expect(document.title).toBe("Logbook HAM · Ham Radio Toolbox");
  });

  it("navigates from the sidebar and moves focus to the main content", async () => {
    const attachTo = document.body.appendChild(document.createElement("div"));
    const { wrapper, router } = await mountWithApp(App, {
      path: "/",
      attachTo,
    });
    await flushLazyRoute();

    await wrapper
      .find('[data-testid="sidebar"] a[data-module="propagation"]')
      .trigger("click");
    await flushLazyRoute();

    expect(router.currentRoute.value.path).toBe("/propagation");
    expect(document.activeElement?.id).toBe("main-content");
    expect(
      wrapper
        .find('[data-testid="sidebar"] a[data-module="propagation"]')
        .attributes("aria-current"),
    ).toBe("page");
    wrapper.unmount();
    attachTo.remove();
  });

  it("renders the not-found page with a way back", async () => {
    const { wrapper } = await mountWithApp(App, { path: "/nope" });
    await flushLazyRoute();
    const page = wrapper.find('[data-testid="not-found"]');
    expect(page.text()).toContain("Pagina non trovata");
    expect(page.text()).toContain("/nope");
    expect(page.find('a[href="/"]').exists()).toBe(true);
  });
});

/** Lets lazy route components resolve and render. */
async function flushLazyRoute() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}
