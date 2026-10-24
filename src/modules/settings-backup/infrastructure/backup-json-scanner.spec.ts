// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/infrastructure/files/sha256";
import { BACKUP_HEADER_FIELDS } from "../domain/backup-manifest";
import {
  BackupJsonScanner,
  BackupScanError,
  type ScanEvent,
} from "./backup-json-scanner";

/*
 * Structural scanning of format v1 (ADR-0015): events, layout rules, limits
 * and the per-table checksum, independently of how the text is chunked.
 */

const options = {
  headerFields: BACKUP_HEADER_FIELDS,
  maxMemberChars: 1024,
  recordChars: (table: string) => (table === "big" ? 64 : 4096),
};

function scan(chunks: readonly string[]): ScanEvent[] {
  const scanner = new BackupJsonScanner(options);
  const events = chunks.flatMap((chunk) => scanner.write(chunk));
  scanner.end();
  return events;
}

function scanError(text: string): BackupScanError {
  try {
    scan([text]);
  } catch (error) {
    if (error instanceof BackupScanError) return error;
    throw error;
  }
  throw new Error("expected a scan error");
}

const qsoArray =
  '[\n{"callsign":"IZ1ABC","comment":"a \\"quoted\\" \\\\ text, with ] and }","n":1},\n' +
  '{"callsign":"I2XYZ","comment":"emoji 📻 and \\u00e8","n":[1,{"x":null}]}\n]';
const sample =
  '{"format":"ham-radio-toolbox-backup","counts":{"qso_logs":2},' +
  `"tables":{\n"qso_logs":${qsoArray},\n"settings":[]\n},` +
  '"integrity":{"algorithm":"SHA-256"}}\n';

describe("BackupJsonScanner", () => {
  it("emits members, tables, records and per-table checksums", () => {
    const events = scan([sample]);
    expect(events.map((event) => event.type)).toEqual([
      "member",
      "member",
      "tables-start",
      "table-start",
      "record",
      "record",
      "table-end",
      "table-start",
      "table-end",
      "member",
    ]);
    expect(events[1]).toEqual({
      type: "member",
      key: "counts",
      value: { qso_logs: 2 },
    });
    const records = events.filter((event) => event.type === "record");
    expect(records.map((record) => JSON.parse(record.text))).toEqual([
      { callsign: "IZ1ABC", comment: 'a "quoted" \\ text, with ] and }', n: 1 },
      { callsign: "I2XYZ", comment: "emoji 📻 and è", n: [1, { x: null }] },
    ]);
    const ends = events.filter((event) => event.type === "table-end");
    expect(ends).toEqual([
      {
        type: "table-end",
        table: "qso_logs",
        count: 2,
        sha256: sha256Hex(new TextEncoder().encode(qsoArray)),
      },
      {
        type: "table-end",
        table: "settings",
        count: 0,
        sha256: sha256Hex(new TextEncoder().encode("[]")),
      },
    ]);
  });

  it("gives the same events whatever the chunk boundaries", () => {
    const expected = scan([sample]);
    for (let split = 1; split < sample.length; split++) {
      expect(
        scan([sample.slice(0, split), sample.slice(split)]),
        `split ${split}`,
      ).toEqual(expected);
    }
    expect(scan(Array.from(sample))).toEqual(expected);
  });

  it.each([
    ["an array root", "[1,2]", "backup.not-a-backup"],
    ["an empty object", "{}", "backup.not-a-backup"],
    ["another first member", '{"tables":{}}', "backup.not-a-backup"],
    [
      "an unknown root member",
      '{"format":"x","device":"tab"}',
      "backup.unknown-field",
    ],
    [
      "a duplicated member",
      '{"format":"x","format":"y"}',
      "backup.layout-invalid",
    ],
    [
      "a header member after the tables",
      '{"format":"x","tables":{},"counts":{}}',
      "backup.layout-invalid",
    ],
    [
      "integrity before the tables",
      '{"format":"x","integrity":{}}',
      "backup.layout-invalid",
    ],
    [
      "a member after integrity",
      '{"format":"x","tables":{},"integrity":{},"counts":{}}',
      "backup.layout-invalid",
    ],
    [
      "tables that are not an object",
      '{"format":"x","tables":[]}',
      "backup.layout-invalid",
    ],
    [
      "a table that is not an array",
      '{"format":"x","tables":{"t":{}}}',
      "backup.layout-invalid",
    ],
    [
      "a duplicated table",
      '{"format":"x","tables":{"t":[],"t":[]}}',
      "backup.table-duplicate",
    ],
    [
      "a trailing comma in a table",
      '{"format":"x","tables":{"t":[{},]}}',
      "backup.json-invalid",
    ],
    [
      "a missing comma",
      '{"format":"x","tables":{"t":[{} {}]}}',
      "backup.json-invalid",
    ],
    ["an invalid header value", '{"format":nope}', "backup.json-invalid"],
    [
      "data after the root object",
      '{"format":"x","tables":{}} {}',
      "backup.json-invalid",
    ],
    [
      "a truncated file",
      '{"format":"x","tables":{"t":[{"a":1}',
      "backup.truncated",
    ],
    ["an empty file", "  \n", "backup.empty"],
    [
      "an oversized record",
      `{"format":"x","tables":{"big":[{"a":"${"x".repeat(80)}"}]}}`,
      "backup.record-too-large",
    ],
    [
      "an oversized header value",
      `{"format":"${"x".repeat(2000)}"}`,
      "backup.layout-invalid",
    ],
  ])("rejects %s", (_label, text, code) => {
    expect(scanError(text).code).toBe(code);
  });

  it("reports where an oversized record is", () => {
    const error = scanError(
      `{"format":"x","tables":{"big":[{},{"a":"${"x".repeat(80)}"}]}}`,
    );
    expect(error.detail).toEqual({ location: "big[1]", limitChars: 64 });
  });

  it("detects an oversized record split over many chunks before it ends", () => {
    const scanner = new BackupJsonScanner(options);
    scanner.write('{"format":"x","tables":{"big":[{"a":"');
    expect(() => scanner.write("x".repeat(100))).toThrow(BackupScanError);
  });

  it("hashes characters outside the BMP split between chunks", () => {
    const text = '{"format":"x","tables":{"t":["📻"]}}';
    const at = text.indexOf("📻") + 1; // between the two UTF-16 surrogates
    const events = scan([text.slice(0, at), text.slice(at)]);
    const end = events.find((event) => event.type === "table-end");
    expect(end).toMatchObject({
      sha256: sha256Hex(new TextEncoder().encode('["📻"]')),
    });
  });
});
