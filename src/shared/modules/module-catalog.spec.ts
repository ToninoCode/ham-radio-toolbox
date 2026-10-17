import { describe, expect, it } from "vitest";
import { createModuleCatalog } from "./module-catalog";
import type { ModuleManifest } from "./module-manifest";

const base: ModuleManifest = {
  id: "dashboard",
  path: "/",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "home",
  titleKey: "modules.dashboard.title",
  descriptionKey: "modules.dashboard.description",
  availability: { status: "available" },
  view: () => Promise.resolve({}),
};

describe("createModuleCatalog", () => {
  it("rejects duplicate ids and paths", () => {
    expect(() => createModuleCatalog([base, { ...base, path: "/x" }])).toThrow(
      /Duplicate module id/,
    );
    expect(() =>
      createModuleCatalog([base, { ...base, id: "ham-logbook" }]),
    ).toThrow(/Duplicate module path/);
  });

  it("rejects an available module without a view", () => {
    const { view: _view, ...withoutView } = base;
    expect(() => createModuleCatalog([withoutView])).toThrow(/without a view/);
  });

  it("requires the home module", () => {
    expect(() =>
      createModuleCatalog([
        {
          ...base,
          id: "propagation",
          path: "/propagation",
          availability: { status: "in-development", milestone: "M12" },
        },
      ]),
    ).toThrow(/Missing home module/);
  });

  it("throws on unknown module ids", () => {
    expect(() => createModuleCatalog([base]).get("propagation")).toThrow(
      /Unknown module/,
    );
  });
});
