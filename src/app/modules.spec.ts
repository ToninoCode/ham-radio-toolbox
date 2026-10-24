import { describe, expect, it } from "vitest";
import { MODULE_IDS } from "@/shared/modules";
import { MODULE_MANIFESTS, moduleCatalog } from "./modules";

describe("application module catalog", () => {
  it("registers each of the 14 modules exactly once", () => {
    expect(MODULE_MANIFESTS.map((m) => m.id).sort()).toEqual(
      [...MODULE_IDS].sort(),
    );
  });

  it("uses the dashboard as home and the other 13 modules as tools", () => {
    expect(moduleCatalog.home.path).toBe("/");
    expect(moduleCatalog.tools).toHaveLength(13);
    expect(moduleCatalog.tools.map((m) => m.id)).not.toContain("dashboard");
  });

  it("marks Settings as available (M2) and the other tools as in development, with a milestone", () => {
    expect(moduleCatalog.get("settings-backup").availability).toEqual({
      status: "available",
    });
    for (const manifest of moduleCatalog.tools) {
      if (manifest.id === "settings-backup") continue;
      expect(manifest.availability).toEqual({
        status: "in-development",
        milestone: expect.stringMatching(/^M([2-9]|1[0-3])$/),
      });
    }
  });

  it("groups all tools by area in the HAM, SWL, shared order", () => {
    const groups = moduleCatalog.byArea("all");
    expect(groups.map((g) => g.area)).toEqual(["ham", "swl", "shared"]);
    expect(groups.flatMap((g) => g.modules)).toHaveLength(13);
  });

  it("filters and orders modules for the HAM workspace", () => {
    const groups = moduleCatalog.byArea("ham");
    expect(groups.map((g) => g.area)).toEqual(["ham", "shared", "swl"]);
    const ids = groups.flatMap((g) => g.modules.map((m) => m.id));
    expect(ids).toContain("ham-logbook");
    expect(ids).toContain("frequency-explorer");
    expect(ids).not.toContain("swl-logbook");
    expect(ids).not.toContain("signal-explorer");
  });

  it("filters and orders modules for the SWL workspace", () => {
    const groups = moduleCatalog.byArea("swl");
    expect(groups.map((g) => g.area)).toEqual(["swl", "shared", "ham"]);
    const ids = groups.flatMap((g) => g.modules.map((m) => m.id));
    expect(ids).toContain("swl-logbook");
    expect(ids).toContain("qsl-manager");
    expect(ids).not.toContain("ham-logbook");
    expect(ids).not.toContain("dx-cluster");
  });
});
