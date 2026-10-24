// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dataSourceSchema } from "@/core/data-source";
import { issueCode } from "@/core/validation";
import {
  MAX_IMPORT_ERRORS,
  emptyImportCounts,
  importJobSchema,
  truncateImportErrors,
  type ImportErrorEntry,
} from ".";

const entry = (i: number): ImportErrorEntry => ({
  location: `record ${i}`,
  code: "callsign.invalid-format",
  message: "",
});

describe("truncateImportErrors", () => {
  it("keeps up to 500 errors as they are", () => {
    const errors = Array.from({ length: MAX_IMPORT_ERRORS }, (_, i) =>
      entry(i),
    );
    expect(truncateImportErrors(errors)).toEqual({ errors });
  });

  it("keeps the first 500 and flags the rest", () => {
    const errors = Array.from({ length: 1200 }, (_, i) => entry(i));
    const truncated = truncateImportErrors(errors);
    expect(truncated.errors).toHaveLength(MAX_IMPORT_ERRORS);
    expect(truncated.errors[0]).toEqual(entry(0));
    expect(truncated.errorsTruncated).toBe(true);
  });
});

describe("importJobSchema", () => {
  const job = {
    id: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
    kind: "hfcc",
    sourceKey: "hfcc",
    fileName: "A26allx2.zip",
    fileSha256: "b".repeat(64),
    datasetVersion: "A26",
    status: "committed",
    startedAt: "2026-10-24T10:00:00Z",
    finishedAt: "2026-10-24T10:00:30Z",
    counts: {
      ...emptyImportCounts(),
      total: 3388,
      valid: 3388,
      inserted: 3388,
    },
    errors: [],
  };

  it("accepts a committed job and is idempotent on it", () => {
    const parsed = importJobSchema.parse(job);
    expect(importJobSchema.parse(parsed)).toEqual(parsed);
  });

  it("rejects negative counts and a finish before the start", () => {
    const result = importJobSchema.safeParse({
      ...job,
      counts: { ...job.counts, invalid: -1 },
    });
    expect(result.error?.issues.map(issueCode)).toEqual(["zod.too_small"]);
    expect(
      importJobSchema
        .safeParse({ ...job, finishedAt: "2026-10-24T09:00:00Z" })
        .error?.issues.map(issueCode),
    ).toEqual(["import-job.finished-before-started"]);
  });

  it("only accepts JSON values as options", () => {
    expect(
      importJobSchema.safeParse({ ...job, options: { duplicates: "skip" } })
        .success,
    ).toBe(true);
    expect(
      importJobSchema.safeParse({ ...job, options: { when: new Date() } })
        .success,
    ).toBe(false);
  });
});

describe("dataSourceSchema", () => {
  it("drops blank optional text and requires a catalog key", () => {
    expect(
      dataSourceSchema.parse({
        key: "eibi",
        accessMode: "manual-import",
        lastError: " ",
      }),
    ).toEqual({
      key: "eibi",
      accessMode: "manual-import",
      lastError: undefined,
    });
    expect(
      dataSourceSchema.safeParse({ key: "eibi", accessMode: "scraping" })
        .success,
    ).toBe(false);
  });
});
