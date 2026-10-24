// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  TABLE_NAMES,
  type LocalDataState,
  type StoredRecord,
  type TableName,
} from "@/shared/application";
import {
  emptyTables,
  syntheticTables,
  uuidFor,
  type Tables,
} from "../../../../tests/support/backup";
import type { BackupContent } from "./backup-ports";
import { primaryKeyOf } from "./backup-records";
import {
  checkBackupReferences,
  planRestore,
  sameEffects,
} from "./restore-planner";

/*
 * Pure restore planning (DATABASE.md § 6, § 9.2): reference checks of a
 * backup and the writes of `replace` and `merge` against a local state.
 */

function content(tables: Tables, includesAttachments = true): BackupContent {
  return { includesAttachments, tables };
}

/** The projections the gateway would read from a database holding `tables`. */
function localState(tables: Tables): LocalDataState {
  const versions = {} as Record<TableName, Map<string, string | undefined>>;
  const counts = {} as Record<TableName, number>;
  for (const table of TABLE_NAMES) {
    versions[table] = new Map(
      tables[table].map((record) => [
        primaryKeyOf(table, record),
        typeof record["updatedAt"] === "string"
          ? record["updatedAt"]
          : undefined,
      ]),
    );
    counts[table] = tables[table].length;
  }
  const s = (record: StoredRecord, field: string) => String(record[field]);
  const defaultProfile = tables.station_profiles.find(
    (p) => p["isDefault"] === 1,
  );
  return {
    counts,
    versions,
    ...(defaultProfile
      ? { defaultStationProfileId: s(defaultProfile, "id") }
      : {}),
    receptionCategories: new Map(
      tables.swl_receptions.map((r) => [s(r, "id"), s(r, "category")]),
    ),
    receptionDetails: tables.reception_details.map((d) => ({
      id: s(d, "id"),
      receptionId: s(d, "receptionId"),
    })),
    qslRecords: tables.qsl_records.map((q) => ({
      id: s(q, "id"),
      subjectType: s(q, "subjectType"),
      subjectId: s(q, "subjectId"),
      channel: s(q, "channel"),
    })),
    attachments: tables.attachments.map((a) => ({
      id: s(a, "id"),
      ownerType: s(a, "ownerType"),
      ownerId: s(a, "ownerId"),
      sha256: s(a, "sha256"),
    })),
  };
}

const codes = (tables: Tables) =>
  checkBackupReferences(content(tables)).map((e) => `${e.location} ${e.code}`);

describe("checkBackupReferences", () => {
  it("accepts a consistent backup", () => {
    expect(codes(syntheticTables({ qsos: 20, attachments: 2 }))).toEqual([]);
  });

  it("reports duplicate keys and the default profile rule", () => {
    const tables = syntheticTables({ qsos: 2 });
    tables.qso_logs.push({ ...tables.qso_logs[0]! });
    tables.station_profiles[1] = {
      ...tables.station_profiles[1]!,
      isDefault: 1,
    };
    expect(codes(tables)).toEqual([
      "qso_logs[2] backup.duplicate-id",
      "station_profiles[0] station-profile.default-invalid",
    ]);
  });

  it("reports references that the backup does not contain", () => {
    const tables = syntheticTables({ qsos: 11, attachments: 1 });
    const missing = uuidFor(0xdead);
    tables.qso_logs[0] = { ...tables.qso_logs[0]!, stationProfileId: missing };
    tables.swl_receptions[0] = {
      ...tables.swl_receptions[0]!,
      stationProfileId: missing,
    };
    tables.reception_details[1] = {
      ...tables.reception_details[1]!,
      receptionId: missing,
    };
    tables.reception_details[0] = {
      ...tables.reception_details[0]!,
      category: "utility",
      data: {},
    };
    tables.qsl_records[0] = { ...tables.qsl_records[0]!, subjectId: missing };
    tables.attachments[0] = { ...tables.attachments[0]!, ownerId: missing };
    expect(codes(tables)).toEqual([
      "qso_logs[0] qso.station-profile-missing",
      "swl_receptions[0] swl.station-profile-missing",
      "reception_details[0] reception-details.category-mismatch",
      "reception_details[1] reception-details.reception-missing",
      "qsl_records[0] qsl-record.subject-missing",
      "attachments[0] attachment.owner-missing",
    ]);
  });

  it("reports the unique rules of DATABASE.md § 6", () => {
    const tables = syntheticTables({ qsos: 1, attachments: 1 });
    tables.reception_details.push({
      ...tables.reception_details[0]!,
      id: uuidFor(0xd1),
    });
    tables.qsl_records.push({ ...tables.qsl_records[0]!, id: uuidFor(0xd2) });
    tables.attachments.push({ ...tables.attachments[0]!, id: uuidFor(0xd3) });
    tables.attachments.push({
      ...tables.attachments[0]!,
      id: uuidFor(0xd4),
      ownerType: "resource",
    });
    expect(codes(tables)).toEqual([
      "reception_details[1] reception-details.duplicate",
      "qsl_records[1] qsl-record.channel-taken",
      "attachments[1] attachment.same-content",
      "attachments[2] attachment.owner-type-unavailable",
    ]);
  });
});

describe("planRestore: replace", () => {
  it("empties and refills every table of the backup", () => {
    const backup = syntheticTables({ qsos: 8, attachments: 1 });
    const local = syntheticTables({ qsos: 3 });
    const plan = planRestore(content(backup), localState(local), "replace");
    expect(plan.writes.clear).toEqual(TABLE_NAMES);
    expect(plan.writes.puts.qso_logs).toEqual(backup.qso_logs);
    expect(plan.effects.qso_logs).toEqual({
      inserted: 8,
      updated: 0,
      deleted: 3,
      unchanged: 0,
      skipped: 0,
    });
    for (const table of TABLE_NAMES) {
      expect(plan.expectedCounts[table]).toBe(backup[table].length);
    }
  });

  it("without attachments keeps the local ones whose owner survives", () => {
    const backup = syntheticTables({ qsos: 2 });
    const local = syntheticTables({ qsos: 2, attachments: 1 });
    const orphan = {
      ...local.attachments[0]!,
      id: uuidFor(0xa0),
      ownerId: uuidFor(0xbeef),
    };
    local.attachments.push(orphan);
    const plan = planRestore(
      content(backup, false),
      localState(local),
      "replace",
    );
    expect(plan.writes.clear).not.toContain("attachments");
    expect(plan.writes.deletes).toEqual({ attachments: [orphan["id"]] });
    expect(plan.effects.attachments).toMatchObject({
      unchanged: 1,
      deleted: 1,
    });
    expect(plan.expectedCounts.attachments).toBe(1);
  });
});

describe("planRestore: merge", () => {
  const later = "2027-01-01T00:00:00Z";

  it("inserts new records and keeps identical ones", () => {
    const tables = syntheticTables({ qsos: 4, attachments: 1 });
    const empty = planRestore(
      content(tables),
      localState(emptyTables()),
      "merge",
    );
    expect(empty.effects.qso_logs.inserted).toBe(4);
    expect(empty.expectedCounts.qso_logs).toBe(4);
    // The same backup again: nothing to write.
    const again = planRestore(content(tables), localState(tables), "merge");
    expect(again.writes.puts).toEqual({});
    for (const table of TABLE_NAMES) {
      expect(again.effects[table].unchanged).toBe(tables[table].length);
    }
  });

  it("takes the most recent record by updatedAt", () => {
    const backup = syntheticTables({ qsos: 2 });
    const local = syntheticTables({ qsos: 2 });
    backup.qso_logs[0] = {
      ...backup.qso_logs[0]!,
      comment: "newer",
      updatedAt: later,
    };
    local.qso_logs[1] = {
      ...local.qso_logs[1]!,
      comment: "local newer",
      updatedAt: later,
    };
    const plan = planRestore(content(backup), localState(local), "merge");
    expect(plan.writes.puts.qso_logs).toEqual([backup.qso_logs[0]]);
    expect(plan.effects.qso_logs).toMatchObject({ updated: 1, unchanged: 1 });
  });

  it("keeps the local default profile", () => {
    const backup = syntheticTables({ qsos: 0 });
    const localProfile = {
      ...backup.station_profiles[1]!,
      id: uuidFor(0x99),
      isDefault: 1,
    };
    const local = emptyTables();
    local.station_profiles.push(localProfile);
    const plan = planRestore(content(backup), localState(local), "merge");
    expect(
      plan.writes.puts.station_profiles?.map((p) => p["isDefault"]),
    ).toEqual([0, 0]);
  });

  it("replaces the details of a reception taken from the backup", () => {
    const backup = syntheticTables({ qsos: 1 });
    const local = syntheticTables({ qsos: 1 });
    const reception = {
      ...backup.swl_receptions[0]!,
      category: "utility",
      updatedAt: later,
    };
    backup.swl_receptions[0] = reception;
    backup.reception_details = [];
    const plan = planRestore(content(backup), localState(local), "merge");
    expect(plan.writes.puts.swl_receptions).toEqual([reception]);
    expect(plan.writes.deletes.reception_details).toEqual([
      local.reception_details[0]!["id"],
    ]);
    expect(plan.expectedCounts.reception_details).toBe(0);
  });

  it("skips records that break a unique rule and their attachments", () => {
    const backup = syntheticTables({ qsos: 1, attachments: 1 });
    const local = syntheticTables({ qsos: 1 });
    // Same subject and channel under another id in the local data.
    local.qsl_records[0] = { ...local.qsl_records[0]!, id: uuidFor(0x77) };
    backup.attachments[0] = {
      ...backup.attachments[0]!,
      ownerType: "qsl",
      ownerId: backup.qsl_records[0]!["id"],
    };
    const plan = planRestore(content(backup), localState(local), "merge");
    expect(plan.conflicts).toEqual([
      {
        table: "qsl_records",
        key: backup.qsl_records[0]!["id"],
        code: "qsl-record.channel-taken",
      },
      {
        table: "attachments",
        key: backup.attachments[0]!["id"],
        code: "attachment.owner-skipped",
      },
    ]);
    expect(plan.effects.qsl_records.skipped).toBe(1);
    expect(plan.writes.puts.attachments).toBeUndefined();
  });

  it("detects a change of the local data through the effects", () => {
    const backup = syntheticTables({ qsos: 3 });
    const before = planRestore(
      content(backup),
      localState(emptyTables()),
      "merge",
    );
    const local = emptyTables();
    local.qso_logs.push(backup.qso_logs[0]!);
    const after = planRestore(content(backup), localState(local), "merge");
    expect(sameEffects(before, before)).toBe(true);
    expect(sameEffects(before, after)).toBe(false);
  });
});
