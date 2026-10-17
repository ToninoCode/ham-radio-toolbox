import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { mountWithApp } from "../../../../tests/support/mount-app";
import { useDashboardStore } from "./dashboard-store";
import DashboardView from "./views/DashboardView.vue";

describe("dashboard store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("starts with all workspaces and no favourites", () => {
    const store = useDashboardStore();
    expect(store.workspace).toBe("all");
    expect(store.favorites).toEqual([]);
  });

  it("toggles favourites keeping the pinning order", () => {
    const store = useDashboardStore();
    store.toggleFavorite("propagation");
    store.toggleFavorite("ham-logbook");
    expect(store.favorites).toEqual(["propagation", "ham-logbook"]);
    expect(store.isFavorite("ham-logbook")).toBe(true);
    store.toggleFavorite("propagation");
    expect(store.favorites).toEqual(["ham-logbook"]);
  });
});

describe("DashboardView", () => {
  it("shows the HAM, SWL and shared areas with 13 module cards", async () => {
    const { wrapper } = await mountWithApp(DashboardView);
    const areas = wrapper
      .findAll("[data-area]")
      .map((s) => s.attributes("data-area"));
    expect(areas).toEqual(["ham", "swl", "shared"]);
    expect(
      wrapper.findAll('[data-area] [data-testid="module-card"]'),
    ).toHaveLength(13);
    expect(wrapper.find('[data-testid="module-count"]').text()).toBe(
      "13 moduli",
    );
  });

  it("labels every module card as in development with its milestone", async () => {
    const { wrapper } = await mountWithApp(DashboardView);
    const card = wrapper.find('[data-area] [data-module="satellite-explorer"]');
    expect(card.text()).toContain("In sviluppo");
    expect(card.text()).toContain("Milestone M8");
    expect(card.find('a[href="/satellite-explorer"]').exists()).toBe(true);
  });

  it("filters the modules by workspace", async () => {
    const { wrapper } = await mountWithApp(DashboardView);
    const swl = wrapper.findAll(
      '[data-testid="workspace-filter"] input[type="radio"]',
    )[2]!;
    await swl.setValue(true);

    const areas = wrapper
      .findAll("[data-area]")
      .map((s) => s.attributes("data-area"));
    expect(areas[0]).toBe("swl");
    const ids = wrapper
      .findAll('[data-area] [data-testid="module-card"]')
      .map((c) => c.attributes("data-module"));
    expect(ids).toContain("swl-logbook");
    expect(ids).not.toContain("ham-logbook");
  });

  it("pins and unpins favourites, stating that they are not saved yet", async () => {
    const { wrapper } = await mountWithApp(DashboardView);
    const favorites = () => wrapper.find('[data-testid="favorites"]');

    expect(favorites().text()).toContain("milestone M2");
    expect(favorites().find('[data-testid="empty-state"]').exists()).toBe(true);

    const toggle = wrapper.find(
      '[data-area] [data-module="rf-calculators"] [data-testid="favorite-toggle"]',
    );
    expect(toggle.attributes("aria-label")).toBe(
      "Aggiungi Calcolatori RF ai preferiti",
    );
    await toggle.trigger("click");

    expect(favorites().find('[data-module="rf-calculators"]').exists()).toBe(
      true,
    );
    expect(favorites().find('[data-testid="empty-state"]').exists()).toBe(
      false,
    );
    expect(
      wrapper
        .find(
          '[data-area] [data-module="rf-calculators"] [data-testid="favorite-toggle"]',
        )
        .attributes("aria-label"),
    ).toBe("Rimuovi Calcolatori RF dai preferiti");

    await favorites().find('[data-testid="favorite-toggle"]').trigger("click");
    expect(favorites().find('[data-testid="empty-state"]').exists()).toBe(true);
  });

  it("shows the empty data freshness panel without fake sources", async () => {
    const { wrapper } = await mountWithApp(DashboardView);
    const panel = wrapper.find('[data-testid="data-freshness"]');
    expect(panel.text()).toContain("Nessuna fonte importata.");
    expect(panel.findAll("li")).toHaveLength(0);
  });
});
