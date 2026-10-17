import { describe, expect, it } from "vitest";
import { mountWithApp } from "../../../tests/support/mount-app";
import { moduleCatalog } from "../modules";
import AppShell from "./AppShell.vue";

describe("AppShell", () => {
  it("offers a skip link to the main content", async () => {
    const { wrapper } = await mountWithApp(AppShell);
    const skip = wrapper.find('a[href="#main-content"]');
    expect(skip.text()).toBe("Vai al contenuto principale");
    expect(wrapper.find("main#main-content").attributes("tabindex")).toBe("-1");
  });

  it("lists all 14 modules in the labelled sidebar navigation", async () => {
    const { wrapper } = await mountWithApp(AppShell);
    const sidebar = wrapper.find('[data-testid="sidebar"]');
    expect(sidebar.attributes("aria-label")).toBe("Navigazione principale");
    const linked = sidebar
      .findAll("a[data-module]")
      .map((a) => a.attributes("data-module"));
    expect(linked.sort()).toEqual(moduleCatalog.all.map((m) => m.id).sort());
  });

  it("shows connection status, UTC clock and theme selector in the header", async () => {
    const { wrapper } = await mountWithApp(AppShell);
    const header = wrapper.find('[data-testid="app-header"]');
    expect(
      header.find('[data-testid="connection-status"]').attributes("role"),
    ).toBe("status");
    expect(
      header.find('[data-testid="utc-clock"] time').attributes("datetime"),
    ).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(header.find('[data-testid="theme-selector"] legend').text()).toBe(
      "Tema",
    );
  });

  it("opens the full module menu from the compact navigation and closes it on navigation", async () => {
    const { wrapper, router } = await mountWithApp(AppShell);
    const dialog = wrapper.find<HTMLDialogElement>(
      '[data-testid="module-menu"]',
    );
    expect(dialog.element.open).toBe(false);

    await wrapper.find('[data-testid="open-menu"]').trigger("click");
    expect(dialog.element.open).toBe(true);
    expect(dialog.findAll("a[data-module]")).toHaveLength(14);

    await router.push("/rf-calculators");
    await wrapper.vm.$nextTick();
    expect(dialog.element.open).toBe(false);
  });

  it("puts the most used modules and a menu button in the bottom bar", async () => {
    const { wrapper } = await mountWithApp(AppShell);
    const bar = wrapper.find('[data-testid="bottom-nav"]');
    expect(
      bar.findAll("a[data-module]").map((a) => a.attributes("data-module")),
    ).toEqual(["dashboard", "ham-logbook", "swl-logbook", "rf-calculators"]);
    expect(bar.find("button").attributes("aria-haspopup")).toBe("dialog");
  });
});
