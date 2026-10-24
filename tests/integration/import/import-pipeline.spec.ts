// @vitest-environment node
import { IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_IMPORT_ERRORS } from "@/core/import-job";
import { blobImportFileReader } from "@/infrastructure/files/blob-import-file-reader";
import {
  createImportPipeline,
  type ImportPipeline,
} from "@/shared/application";
import { createTestDatabase, type TestDatabase } from "../../support/database";
import {
  qsoFormat,
  qsoTarget,
  sourcesFormat,
  sourcesTarget,
  textFile,
} from "../../support/import-formats";
import {
  expectErr,
  expectOk,
  stationProfileDraft,
} from "../../support/records";

/*
 * BL-M2-07: generic import pipeline with the real repositories and unit of
 * work on fake-indexeddb. The formats are synthetic test doubles.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function pipelineOf(test: TestDatabase, maxBytes?: number): ImportPipeline {
  const { container } = test;
  return createImportPipeline({
    unitOfWork: container.unitOfWork,
    importJobs: container.repositories.importJobs,
    clock: container.clock,
    hasher: container.contentHasher,
    files: blobImportFileReader,
    ...(maxBytes ? { maxBytes } : {}),
  });
}

async function counts(test: TestDatabase) {
  return {
    data_sources: await test.db.data_sources.count(),
    qso_logs: await test.db.qso_logs.count(),
    import_jobs: await test.db.import_jobs.count(),
  };
}

const SOURCES = [
  "#hrt-test-sources",
  "eibi;manual-import;A26",
  "# a comment line",
  "hfcc;manual-import;",
  "Not A Key;native;",
  "satnogs;scraping;",
  "eibi;manual-import;A26",
].join("\n");

describe("preview", () => {
  it("classifies valid, invalid, ignored and repeated records without writing", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const before = await counts(test);

    const preview = expectOk(
      await pipeline.preview(
        textFile("sources.txt", SOURCES),
        [sourcesFormat],
        sourcesTarget(test.container),
      ),
    );

    expect(preview.summary).toEqual({
      total: 6,
      valid: 3,
      invalid: 2,
      ignored: 1,
      inFileDuplicates: 1,
      new: 2,
      duplicates: 0,
      conflicts: 0,
    });
    expect(preview.errors).toEqual([
      {
        location: "line 5",
        field: "key",
        code: "catalog-key.invalid",
        message: "",
      },
      {
        location: "line 6",
        field: "accessMode",
        code: "zod.invalid_value",
        message: "",
      },
    ]);
    expect(preview.notices).toEqual([
      { location: "line 3", code: "test.comment" },
      { location: "line 7", code: "import.duplicate-in-file" },
    ]);
    expect(
      preview.candidates.map((c) => [c.location, c.value.key, c.status]),
    ).toEqual([
      ["line 2", "eibi", "new"],
      ["line 4", "hfcc", "new"],
    ]);
    expect(preview).toMatchObject({
      formatId: "test-sources",
      kind: "csv",
      fileName: "sources.txt",
      datasetVersion: "T1",
      previousImports: [],
    });
    expect(preview.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    // Parsing and preview write nothing, not even a job.
    expect(await counts(test)).toEqual(before);
  });

  it("identifies the format among several and rejects unknown files", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const formats = [qsoFormat, sourcesFormat] as never[];
    const target = sourcesTarget(test.container) as never;
    expect(
      expectOk(
        await pipeline.preview(textFile("s.txt", SOURCES), formats, target),
      ).formatId,
    ).toBe("test-sources");
    expect(
      expectErr(
        await pipeline.preview(textFile("x.txt", "hello"), formats, target),
      ),
    ).toEqual({ code: "import.format-unknown" });
  });

  it.each([
    ["an empty file", textFile("s.txt", ""), { code: "import.file-empty" }],
    [
      "a file over the format limit",
      textFile("s.txt", `#hrt-test-sources\n${"x".repeat(70 * 1024)}`),
      { code: "import.file-too-large", limitBytes: 64 * 1024 },
    ],
    [
      "invalid UTF-8",
      {
        name: "s.txt",
        content: new Blob([
          new TextEncoder().encode("#hrt-test-sources\n"),
          new Uint8Array([0xc3, 0x28]),
        ]),
      },
      { code: "import.encoding-invalid" },
    ],
    [
      "a file the format cannot read",
      textFile("s.txt", "#hrt-test-sources\n#version 2\n"),
      {
        code: "import.format-invalid",
        failure: { code: "test.unsupported-version", location: "line 2" },
      },
    ],
  ])("rejects %s with a stable code", async (_label, file, error) => {
    const test = createTestDatabase();
    const result = await pipelineOf(test).preview(
      file,
      [sourcesFormat],
      sourcesTarget(test.container),
    );
    expect(expectErr(result)).toMatchObject(error);
    expect(await counts(test)).toEqual({
      data_sources: 0,
      qso_logs: 0,
      import_jobs: 0,
    });
  });

  it("applies the pipeline's own size limit below the format's", async () => {
    const test = createTestDatabase();
    const result = await pipelineOf(test, 20).preview(
      textFile("s.txt", SOURCES),
      [sourcesFormat],
      sourcesTarget(test.container),
    );
    expect(expectErr(result)).toMatchObject({
      code: "import.file-too-large",
      limitBytes: 20,
    });
  });

  it("keeps the first 500 errors and flags the rest", async () => {
    const test = createTestDatabase();
    const text = [
      "#hrt-test-sources",
      ...Array.from({ length: 700 }, () => "BAD;native;"),
    ].join("\n");
    const preview = expectOk(
      await pipelineOf(test).preview(
        textFile("s.txt", text),
        [sourcesFormat],
        sourcesTarget(test.container),
      ),
    );
    expect(preview.summary.invalid).toBe(700);
    expect(preview.errors).toHaveLength(MAX_IMPORT_ERRORS);
    expect(preview.errorsTruncated).toBe(true);
  });

  it("stops when aborted during processing and writes nothing", async () => {
    const test = createTestDatabase();
    const controller = new AbortController();
    const result = await pipelineOf(test).preview(
      textFile("s.txt", SOURCES),
      [sourcesFormat],
      sourcesTarget(test.container),
      {
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.phase === "parse") controller.abort();
        },
      },
    );
    expect(expectErr(result)).toEqual({ code: "operation.aborted" });
    expect(await counts(test)).toEqual({
      data_sources: 0,
      qso_logs: 0,
      import_jobs: 0,
    });
  });
});

describe("commit", () => {
  it("writes the records and the committed job in one unit", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const target = sourcesTarget(test.container);
    const preview = expectOk(
      await pipeline.preview(
        textFile("sources.txt", SOURCES),
        [sourcesFormat],
        target,
      ),
    );

    const outcome = expectOk(
      await pipeline.commit(preview, target, { conflicts: "skip" }),
    );

    expect(outcome.counts).toEqual({
      total: 6,
      valid: 3,
      invalid: 2,
      duplicates: 1,
      inserted: 2,
      updated: 0,
      skipped: 2,
    });
    expect(outcome.job).toMatchObject({
      kind: "csv",
      status: "committed",
      fileName: "sources.txt",
      fileSha256: preview.fileSha256,
      datasetVersion: "T1",
      options: { format: "test-sources", conflicts: "skip" },
    });
    expect(outcome.job.errors.map((e) => e.code)).toEqual([
      "catalog-key.invalid",
      "zod.invalid_value",
    ]);
    expect(await test.db.data_sources.orderBy("key").primaryKeys()).toEqual([
      "eibi",
      "hfcc",
    ]);
    expect(await test.db.import_jobs.toArray()).toEqual([outcome.job]);
  });

  it("links the imported records to their job", async () => {
    const test = createTestDatabase();
    const profile = expectOk(
      await test.container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    const pipeline = pipelineOf(test);
    const target = qsoTarget(test.container, profile.id);
    const text =
      "#hrt-test-qso\niz1abc;2026-10-24T10:00:00Z;14074000;FT8;20m\ni2xyz;2026-10-24T10:05:00+02:00;7074000;FT8;40m\n";
    const preview = expectOk(
      await pipeline.preview(textFile("log.qso", text), [qsoFormat], target),
    );
    const { job } = expectOk(
      await pipeline.commit(preview, target, { conflicts: "skip" }),
    );
    const stored = await test.db.qso_logs.orderBy("datetimeOn").toArray();
    expect(
      stored.map((qso) => [qso.callsign, qso.datetimeOn, qso.importJobId]),
    ).toEqual([
      ["I2XYZ", "2026-10-24T08:05:00Z", job.id],
      ["IZ1ABC", "2026-10-24T10:00:00Z", job.id],
    ]);
  });

  it("skips duplicates and, by policy, skips or replaces conflicts", async () => {
    for (const conflicts of ["skip", "replace"] as const) {
      const test = createTestDatabase();
      const { dataSources } = test.container.repositories;
      expectOk(
        await dataSources.save({
          key: "eibi",
          accessMode: "manual-import",
          datasetVersion: "A26",
        }),
      );
      expectOk(await dataSources.save({ key: "hfcc", accessMode: "link" }));
      const pipeline = pipelineOf(test);
      const target = sourcesTarget(test.container);
      const preview = expectOk(
        await pipeline.preview(
          textFile("s.txt", SOURCES),
          [sourcesFormat],
          target,
        ),
      );
      expect(
        preview.candidates.map((c) => [c.value.key, c.status, c.existingId]),
      ).toEqual([
        ["eibi", "duplicate", "eibi"],
        ["hfcc", "conflict", "hfcc"],
      ]);

      const { counts: jobCounts } = expectOk(
        await pipeline.commit(preview, target, { conflicts }),
      );
      expect(jobCounts).toMatchObject({
        duplicates: 3,
        inserted: 0,
        updated: conflicts === "replace" ? 1 : 0,
      });
      expect(expectOk(await dataSources.get("hfcc")).accessMode).toBe(
        conflicts === "replace" ? "manual-import" : "link",
      );
    }
  });

  it("refuses a stale preview and records the failure", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const target = sourcesTarget(test.container);
    const preview = expectOk(
      await pipeline.preview(
        textFile("s.txt", SOURCES),
        [sourcesFormat],
        target,
      ),
    );
    // Another tab saves one of the sources after the preview.
    expectOk(
      await test.container.repositories.dataSources.save({
        key: "hfcc",
        accessMode: "link",
      }),
    );

    expect(
      expectErr(await pipeline.commit(preview, target, { conflicts: "skip" })),
    ).toEqual({
      code: "import.preview-stale",
    });
    expect(await test.db.data_sources.count()).toBe(1);
    const [job] = await test.db.import_jobs.toArray();
    expect(job).toMatchObject({ status: "failed", counts: { inserted: 0 } });
    expect(job?.errors[0]).toMatchObject({
      location: "commit",
      code: "import.preview-stale",
    });
  });

  it("rolls back every record when a write returns an error", async () => {
    const test = createTestDatabase();
    const profile = expectOk(
      await test.container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    const pipeline = pipelineOf(test);
    const target = qsoTarget(test.container, profile.id);
    // The third record passes the format (0 Hz is a frequency) but not the
    // QSO schema (frequency > 0): the repository rejects it mid-commit.
    const text = [
      "#hrt-test-qso",
      "iz1abc;2026-10-24T10:00:00Z;14074000;FT8;20m",
      "iz1abd;2026-10-24T10:01:00Z;14074000;FT8;20m",
      "iz1abe;2026-10-24T10:02:00Z;0;FT8;20m",
    ].join("\n");
    const preview = expectOk(
      await pipeline.preview(textFile("log.qso", text), [qsoFormat], target),
    );
    expect(preview.summary.new).toBe(3);

    const error = expectErr(
      await pipeline.commit(preview, target, { conflicts: "skip" }),
    );
    expect(error).toMatchObject({
      code: "persistence.invalid-input",
      table: "qso_logs",
    });
    expect(await test.db.qso_logs.count()).toBe(0);
    const jobs = await test.db.import_jobs.toArray();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      status: "failed",
      counts: { inserted: 0, total: 3 },
    });
    expect(jobs[0]?.errors[0]).toMatchObject({
      location: "commit",
      code: "persistence.invalid-input",
    });
  });

  it("rolls back and rethrows when a write throws", async () => {
    const test = createTestDatabase();
    const profile = expectOk(
      await test.container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    const pipeline = pipelineOf(test);
    const target = qsoTarget(test.container, profile.id, { failOn: "IZ1ABD" });
    const text =
      "#hrt-test-qso\niz1abc;2026-10-24T10:00:00Z;14074000;FT8;20m\niz1abd;2026-10-24T10:01:00Z;14074000;FT8;20m\n";
    const preview = expectOk(
      await pipeline.preview(textFile("log.qso", text), [qsoFormat], target),
    );

    await expect(
      pipeline.commit(preview, target, { conflicts: "skip" }),
    ).rejects.toThrow("target bug");
    expect(await test.db.qso_logs.count()).toBe(0);
    const [job] = await test.db.import_jobs.toArray();
    expect(job?.errors[0]).toMatchObject({ code: "import.unexpected-error" });
  });

  it("rolls back on a storage failure (quota) during the commit", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const target = sourcesTarget(test.container);
    const preview = expectOk(
      await pipeline.preview(
        textFile("s.txt", SOURCES),
        [sourcesFormat],
        target,
      ),
    );
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (
        this.name === "data_sources" &&
        (args[0] as { key: string }).key === "hfcc"
      ) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      return put.apply(this, args);
    });

    expect(
      expectErr(await pipeline.commit(preview, target, { conflicts: "skip" })),
    ).toEqual({
      code: "persistence.quota-exceeded",
    });
    vi.restoreAllMocks();
    expect(await test.db.data_sources.count()).toBe(0);
    expect(
      (await test.db.import_jobs.toArray()).map((job) => job.status),
    ).toEqual(["failed"]);
  });

  it("records a cancelled import and nothing else", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const preview = expectOk(
      await pipeline.preview(
        textFile("s.txt", SOURCES),
        [sourcesFormat],
        sourcesTarget(test.container),
      ),
    );
    const job = expectOk(await pipeline.cancel(preview));
    expect(job).toMatchObject({
      status: "cancelled",
      counts: { inserted: 0, total: 6 },
    });
    expect(await counts(test)).toEqual({
      data_sources: 0,
      qso_logs: 0,
      import_jobs: 1,
    });
  });

  it("does not commit when aborted before the commit", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const target = sourcesTarget(test.container);
    const preview = expectOk(
      await pipeline.preview(
        textFile("s.txt", SOURCES),
        [sourcesFormat],
        target,
      ),
    );
    const controller = new AbortController();
    controller.abort();
    expect(
      expectErr(
        await pipeline.commit(preview, target, {
          conflicts: "skip",
          signal: controller.signal,
        }),
      ),
    ).toEqual({ code: "operation.aborted" });
    expect(await counts(test)).toEqual({
      data_sources: 0,
      qso_logs: 0,
      import_jobs: 0,
    });
  });
});

describe("importing the same file again", () => {
  it("is reported by the preview and writes no duplicates", async () => {
    const test = createTestDatabase();
    const pipeline = pipelineOf(test);
    const target = sourcesTarget(test.container);
    const file = textFile("sources.txt", SOURCES);
    const first = expectOk(
      await pipeline.preview(file, [sourcesFormat], target),
    );
    const { job } = expectOk(
      await pipeline.commit(first, target, { conflicts: "skip" }),
    );

    const second = expectOk(
      await pipeline.preview(file, [sourcesFormat], target),
    );
    expect(second.fileSha256).toBe(first.fileSha256);
    expect(second.previousImports.map((previous) => previous.id)).toEqual([
      job.id,
    ]);
    expect(second.summary).toMatchObject({ new: 0, duplicates: 2 });
    expect(
      expectOk(await pipeline.commit(second, target, { conflicts: "skip" }))
        .counts.inserted,
    ).toBe(0);
    expect(await test.db.data_sources.count()).toBe(2);
  });
});
