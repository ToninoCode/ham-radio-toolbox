// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TABLE_NAMES, type TableName } from "@/shared/application";
import { ok } from "@/shared/types";
import {
  parseBackup,
  syntheticTables,
  writeBackupFile,
} from "../../../../tests/support/backup";
import type { BackupReadEvent } from "../application/backup-ports";
import { validateRecord } from "../application/backup-records";
import { jsonBackupCodec } from "./json-backup-codec";

/*
 * Format v1 without a database: the production writer and the progressive
 * reader agree, and every alteration of the file is detected.
 */

const limits = { recordCharLimit: () => 1024 * 1024 };

async function readAll(blob: Blob, signal?: AbortSignal) {
  const events: BackupReadEvent[] = [];
  const result = await jsonBackupCodec.read(
    blob,
    (event) => {
      events.push(event);
      return ok(undefined);
    },
    { ...limits, ...(signal ? { signal } : {}) },
  );
  return { result, events };
}

async function replaceInFile(blob: Blob, from: string, to: string) {
  const text = await blob.text();
  expect(text).toContain(from);
  return new Blob([text.replace(from, to)]);
}

describe("synthetic dataset", () => {
  it("is canonical: every record validates to itself", () => {
    const tables = syntheticTables({ qsos: 12, attachments: 1 });
    for (const table of TABLE_NAMES) {
      for (const record of tables[table]) {
        const valid = validateRecord(table, record);
        expect(valid, `${table} ${JSON.stringify(record)}`).toEqual(ok(record));
      }
    }
  });
});

describe("JsonBackupWriter + reader", () => {
  it("round-trips every record and the attachments' content", async () => {
    const tables = syntheticTables({
      qsos: 25,
      attachments: 2,
      attachmentBytes: 3000,
    });
    const blob = await writeBackupFile(tables);
    const { result, events } = await readAll(blob);
    expect(result.ok).toBe(true);

    const header = events[0];
    expect(header).toMatchObject({
      type: "header",
      manifest: { schemaVersion: 1, includesAttachments: true },
    });
    for (const table of TABLE_NAMES) {
      const records = events.filter(
        (event): event is Extract<BackupReadEvent, { type: "record" }> =>
          event.type === "record" && event.table === table,
      );
      if (table === "attachments") {
        for (const [i, record] of records.entries()) {
          const { blob: content, ...metadata } = record.value as { blob: Blob };
          const { blob: original, ...expected } = tables.attachments[i]!;
          expect(metadata).toEqual(expected);
          expect(new Uint8Array(await content.arrayBuffer())).toEqual(
            new Uint8Array(await (original as Blob).arrayBuffer()),
          );
          expect(content.type).toBe("audio/ogg");
        }
      } else {
        expect(records.map((record) => record.value)).toEqual(tables[table]);
      }
      expect(events).toContainEqual({
        type: "table-end",
        table,
        count: tables[table].length,
      });
    }
  });

  it("writes the documented layout: header, counts, tables, integrity", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 3 }));
    const file = await parseBackup(blob);
    expect(Object.keys(file)).toEqual([
      "format",
      "backupFormatVersion",
      "schemaVersion",
      "appVersion",
      "backupId",
      "exportedAt",
      "includesAttachments",
      "counts",
      "tables",
      "integrity",
    ]);
    const tables = TABLE_NAMES.filter((table) => table !== "attachments");
    expect(Object.keys(file["counts"] as object)).toEqual(tables);
    expect(Object.keys(file["tables"] as object)).toEqual(tables);
    expect(file["integrity"]).toMatchObject({ algorithm: "SHA-256" });
  });

  it("is deterministic: the same data gives the same bytes", async () => {
    const one = await writeBackupFile(
      syntheticTables({ qsos: 8, attachments: 1 }),
    );
    const two = await writeBackupFile(
      syntheticTables({ qsos: 8, attachments: 1 }),
    );
    expect(await one.text()).toBe(await two.text());
  });

  it("detects any change in a table through its checksum", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 3 }));
    const altered = await replaceInFile(
      blob,
      '"callsign":"I1XYZ"',
      '"callsign":"I1XYY"',
    );
    const { result } = await readAll(altered);
    expect(result).toEqual({
      ok: false,
      error: { code: "backup.checksum-mismatch", tables: ["qso_logs"] },
    });
  });

  it("detects a changed checksum and a missing integrity member", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 1 }));
    const file = await parseBackup(blob);
    const integrity = file["integrity"] as { tables: Record<string, string> };
    const digest = integrity.tables["settings"]!;
    const changed = await replaceInFile(blob, digest, "0".repeat(64));
    expect((await readAll(changed)).result).toMatchObject({
      error: { code: "backup.checksum-mismatch", tables: ["settings"] },
    });

    const text = await blob.text();
    const withoutIntegrity = new Blob([
      `${text.slice(0, text.lastIndexOf(',"integrity"'))}}`,
    ]);
    expect((await readAll(withoutIntegrity)).result).toEqual({
      ok: false,
      error: { code: "backup.integrity-missing" },
    });
  });

  it("detects a truncated file", async () => {
    const text = await (
      await writeBackupFile(syntheticTables({ qsos: 5 }))
    ).text();
    for (const fraction of [0.1, 0.5, 0.99]) {
      const truncated = new Blob([
        text.slice(0, Math.floor(text.length * fraction)),
      ]);
      expect((await readAll(truncated)).result).toMatchObject({
        ok: false,
        error: { code: "backup.truncated" },
      });
    }
  });

  it.each([
    ["another JSON document", '{"name":"x"}', { code: "backup.not-a-backup" }],
    [
      "another format",
      '{"format":"other","tables":{}}',
      { code: "backup.not-a-backup" },
    ],
    [
      "a future container version",
      '{"format":"ham-radio-toolbox-backup","backupFormatVersion":2}',
      { code: "backup.format-version-unsupported", found: 2, supported: 1 },
    ],
    [
      "an incomplete header",
      '{"format":"ham-radio-toolbox-backup","backupFormatVersion":1,"tables":{}}',
      { code: "backup.manifest-invalid" },
    ],
    [
      "a file without tables",
      '{"format":"ham-radio-toolbox-backup","backupFormatVersion":1}',
      { code: "backup.layout-invalid", reason: "tables-missing" },
    ],
  ])("rejects %s", async (_label, text, error) => {
    expect((await readAll(new Blob([text]))).result).toMatchObject({
      ok: false,
      error,
    });
  });

  it("rejects a record that is not valid JSON, with its location", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 2 }));
    const broken = await replaceInFile(blob, '"band":"20m"', '"band":20m');
    expect((await readAll(broken)).result).toEqual({
      ok: false,
      error: { code: "backup.json-invalid", location: "qso_logs[0]" },
    });
  });

  it("rejects invalid UTF-8", async () => {
    const bytes = new TextEncoder().encode(
      '{"format":"ham-radio-toolbox-backup"',
    );
    const invalid = new Blob([
      bytes.slice(0, 12),
      new Uint8Array([0xff, 0xfe]),
      bytes.slice(12),
    ]);
    expect((await readAll(invalid)).result).toEqual({
      ok: false,
      error: { code: "backup.encoding-invalid" },
    });
  });

  it("reports undecodable attachment contents as record errors", async () => {
    const tables = syntheticTables({
      qsos: 1,
      attachments: 1,
      attachmentBytes: 30,
    });
    const blob = await writeBackupFile(tables);
    const text = await blob.text();
    const start = text.indexOf('"dataBase64":"') + 14;
    const broken = new Blob([
      `${text.slice(0, start)}!${text.slice(start + 1)}`,
    ]);
    const { events } = await readAll(broken);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "record",
        table: "attachments",
        contentError: "attachment.content-invalid",
      }),
    );
  });

  it("stops at once when aborted, without reading the rest", async () => {
    const controller = new AbortController();
    controller.abort();
    const blob = await writeBackupFile(syntheticTables({ qsos: 2 }));
    expect((await readAll(blob, controller.signal)).result).toEqual({
      ok: false,
      error: { code: "operation.aborted" },
    });
  });

  it("returns the handler's error and stops reading", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 40 }));
    let records = 0;
    const result = await jsonBackupCodec.read(
      blob,
      (event) => {
        if (event.type !== "record") return ok(undefined);
        records++;
        return records === 3
          ? { ok: false, error: { code: "backup.has-errors" } }
          : ok(undefined);
      },
      limits,
    );
    expect(result).toEqual({ ok: false, error: { code: "backup.has-errors" } });
    expect(records).toBe(3);
  });

  it("enforces the record size limit given by the caller", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 1 }));
    const result = await jsonBackupCodec.read(blob, () => ok(undefined), {
      recordCharLimit: (table: string) =>
        (table as TableName) === "qso_logs" ? 50 : 1024 * 1024,
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "backup.record-too-large",
        location: "qso_logs[0]",
        limitChars: 50,
      },
    });
  });
});
