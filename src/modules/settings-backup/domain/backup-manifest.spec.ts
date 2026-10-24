// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { UtcDateTime } from "@/core/time";
import { issueCode } from "@/core/validation";
import {
  BACKUP_FORMAT,
  backupFileName,
  backupIntegritySchema,
  backupManifestSchema,
} from "./backup-manifest";

const manifest = {
  format: BACKUP_FORMAT,
  backupFormatVersion: 1,
  schemaVersion: 1,
  appVersion: "0.2.0",
  backupId: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
  exportedAt: "2026-10-24T13:21:09Z",
  includesAttachments: false,
  counts: { station_profiles: 1, qso_logs: 0 },
};

describe("backupManifestSchema", () => {
  it("accepts a v1 header and is idempotent on it", () => {
    const parsed = backupManifestSchema.parse(manifest);
    expect(backupManifestSchema.parse(parsed)).toEqual(manifest);
  });

  it.each([
    ["another format", { format: "other-app-backup" }, "zod.invalid_value"],
    [
      "a local time",
      { exportedAt: "2026-10-24T13:21:09" },
      "time.missing-offset",
    ],
    ["a negative count", { counts: { qso_logs: -1 } }, "zod.too_small"],
    [
      "a table name that is not snake_case",
      { counts: { "../x": 1 } },
      "zod.invalid_key",
    ],
    ["a fractional schema version", { schemaVersion: 1.5 }, "zod.invalid_type"],
    ["an unknown field", { device: "tablet" }, "zod.unrecognized_keys"],
  ])("rejects %s", (_label, change, code) => {
    const result = backupManifestSchema.safeParse({ ...manifest, ...change });
    expect(result.error?.issues.map(issueCode)).toContain(code);
  });
});

describe("backupIntegritySchema", () => {
  it("requires SHA-256 hex digests", () => {
    expect(
      backupIntegritySchema.safeParse({
        algorithm: "SHA-256",
        tables: { qso_logs: "a".repeat(64) },
      }).success,
    ).toBe(true);
    expect(
      backupIntegritySchema.safeParse({
        algorithm: "MD5",
        tables: { qso_logs: "a".repeat(32) },
      }).success,
    ).toBe(false);
  });
});

describe("backupFileName", () => {
  it("builds the UTC download name of DATABASE.md § 9.1", () => {
    expect(backupFileName("2026-10-17T13:21:00Z" as UtcDateTime)).toBe(
      "hrt-backup-20261017-1321Z.json",
    );
  });
});
