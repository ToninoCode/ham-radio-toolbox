// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { emptyImportCounts, MAX_IMPORT_ERRORS } from "@/core/import-job";
import { defineSetting } from "@/modules/settings-backup";
import type { ImportJobDraft } from "@/shared/application";
import { createTestDatabase } from "../../support/database";
import { expectErr, expectOk } from "../../support/records";

/*
 * Repositories of settings (contract for Block D), data source state and
 * import jobs (contract for Block C).
 */

const frequencyUnit = defineSetting(
  "frequency-unit",
  z.enum(["kHz", "MHz"]),
  "kHz",
);
const dashboard = defineSetting(
  "dashboard",
  z.strictObject({ favorites: z.array(z.string()) }),
  { favorites: [] },
);

describe("settings", () => {
  it("returns the default for an absent key, then the stored value", async () => {
    const { container } = createTestDatabase();
    const { settings } = container.repositories;
    expect(expectOk(await settings.read(frequencyUnit))).toBe("kHz");
    expect(expectOk(await settings.write(frequencyUnit, "MHz"))).toBe("MHz");
    expect(expectOk(await settings.read(frequencyUnit))).toBe("MHz");
  });

  it("validates writes with the key's schema", async () => {
    const { container, db } = createTestDatabase();
    const { settings } = container.repositories;
    expect(expectErr(await settings.write(frequencyUnit, "GHz"))).toMatchObject(
      {
        code: "persistence.invalid-input",
        table: "settings",
      },
    );
    expect(await db.settings.count()).toBe(0);
    expectOk(await settings.write(dashboard, { favorites: ["ham-logbook"] }));
    expect(await db.settings.get("dashboard")).toEqual({
      key: "dashboard",
      value: { favorites: ["ham-logbook"] },
      updatedAt: "2026-10-24T10:00:00Z",
    });
  });

  it("reports a stored value that no longer fits its schema, without fallback", async () => {
    const { container, db } = createTestDatabase();
    await db.settings.put({
      key: "frequency-unit",
      value: "Hz",
      updatedAt: "2026-10-24T10:00:00Z" as never,
    });
    expect(
      expectErr(await container.repositories.settings.read(frequencyUnit)),
    ).toMatchObject({ code: "persistence.invalid-input" });
  });

  it("removes keys idempotently", async () => {
    const { container } = createTestDatabase();
    const { settings } = container.repositories;
    expectOk(await settings.write(frequencyUnit, "MHz"));
    expect(expectOk(await settings.remove("frequency-unit"))).toEqual({
      settings: 1,
    });
    expect(expectOk(await settings.remove("frequency-unit"))).toEqual({
      settings: 0,
    });
    expect(expectOk(await settings.read(frequencyUnit))).toBe("kHz");
  });

  it("rejects invalid definitions as programming errors", () => {
    expect(() => defineSetting("Not A Key", z.string(), "x")).toThrow();
    expect(() => defineSetting("unit", z.enum(["a"]), "b" as "a")).toThrow();
  });
});

describe("data sources", () => {
  it("saves, replaces and lists the state of each source", async () => {
    const { container } = createTestDatabase();
    const { dataSources } = container.repositories;
    expect(expectErr(await dataSources.get("eibi"))).toEqual({
      code: "persistence.not-found",
      table: "data_sources",
      key: "eibi",
    });
    expectOk(
      await dataSources.save({
        key: "eibi",
        accessMode: "manual-import",
        datasetVersion: "A26",
        lastSuccessAt: "2026-10-24T10:00:00Z",
      }),
    );
    expectOk(
      await dataSources.save({ key: "celestrak", accessMode: "native" }),
    );
    const replaced = expectOk(
      await dataSources.save({
        key: "eibi",
        accessMode: "manual-import",
        datasetVersion: "B26",
        lastError: "",
      }),
    );
    expect(replaced).toEqual({
      key: "eibi",
      accessMode: "manual-import",
      datasetVersion: "B26",
    });
    expect(
      expectOk(await dataSources.list()).map((source) => source.key),
    ).toEqual(["celestrak", "eibi"]);
  });

  it("rejects keys that are not catalog keys", async () => {
    const { container } = createTestDatabase();
    expect(
      expectErr(
        await container.repositories.dataSources.save({
          key: "EiBi",
          accessMode: "link",
        }),
      ),
    ).toMatchObject({ code: "persistence.invalid-input" });
  });
});

describe("import jobs", () => {
  const job = (overrides: Partial<ImportJobDraft> = {}): ImportJobDraft => ({
    kind: "adif",
    fileName: "log.adi",
    status: "committed",
    startedAt: "2026-10-24T10:00:00Z",
    finishedAt: "2026-10-24T10:00:05Z",
    counts: { ...emptyImportCounts(), total: 2, valid: 2, inserted: 2 },
    errors: [],
    options: { duplicates: "skip" },
    ...overrides,
  });

  it("records jobs and lists the most recent first", async () => {
    const { container } = createTestDatabase();
    const { importJobs } = container.repositories;
    const older = expectOk(await importJobs.create(job()));
    const newer = expectOk(
      await importJobs.create(
        job({
          kind: "eibi",
          sourceKey: "eibi",
          status: "failed",
          startedAt: "2026-10-24T11:00:00Z",
          finishedAt: "2026-10-24T11:00:01Z",
          errors: [
            {
              location: "line 3",
              field: "freq",
              code: "frequency.negative",
              message: "-1",
            },
          ],
        }),
      ),
    );
    expect(expectOk(await importJobs.get(older.id))).toEqual(older);
    expect(expectOk(await importJobs.listRecent(10))).toEqual([newer, older]);
    expect(expectOk(await importJobs.listRecent(1))).toEqual([newer]);
  });

  it("rejects inconsistent jobs", async () => {
    const { container } = createTestDatabase();
    const { importJobs } = container.repositories;
    const tooMany = Array.from({ length: MAX_IMPORT_ERRORS + 1 }, (_, i) => ({
      location: `record ${i + 1}`,
      code: "zod.invalid_type",
      message: "",
    }));
    for (const draft of [
      job({ finishedAt: "2026-10-24T09:00:00Z" }),
      job({ errors: tooMany }),
      job({ kind: "pdf" as never }),
    ]) {
      expect(expectErr(await importJobs.create(draft))).toMatchObject({
        code: "persistence.invalid-input",
        table: "import_jobs",
      });
    }
  });
});
