import type { ImportErrorEntry } from "@/core/import-job";
import {
  TABLE_NAMES,
  type LocalDataState,
  type RestoreMode,
  type StoredRecord,
  type TableCounts,
  type TableName,
} from "@/shared/application";
import type {
  BackupContent,
  RestoreConflict,
  RestorePlan,
  TableEffects,
} from "./backup-ports";
import { primaryKeyOf } from "./backup-records";

/*
 * Pure planning of a restore (DATABASE.md § 6, § 9.2, ADR-0015): checks the
 * references inside a backup and computes the writes of `replace` and
 * `merge` against the local state. No I/O: the same function runs for the
 * preview and again inside the commit's transaction, where a different
 * result means that the local data changed (`backup.preview-stale`).
 */

/** Table of each attachment owner type; `resource` has none before v5. */
const OWNER_TABLES: Readonly<Record<string, TableName | undefined>> = {
  qso: "qso_logs",
  swl_reception: "swl_receptions",
  qsl: "qsl_records",
};

/** Table of each QSL subject type. */
const SUBJECT_TABLES: Readonly<Record<string, TableName | undefined>> = {
  qso: "qso_logs",
  swl: "swl_receptions",
};

const text = (record: StoredRecord, field: string) => String(record[field]);

function location(table: TableName, index: number): string {
  return `${table}[${index}]`;
}

function keySet(content: BackupContent, table: TableName): Set<string> {
  return new Set(
    content.tables[table].map((record) => primaryKeyOf(table, record)),
  );
}

/**
 * Integrity of the backup on its own: unique keys, exactly one default
 * profile, every reference resolved inside the file, the unique rules of
 * DATABASE.md § 6. Codes are those of the repositories where one exists.
 */
export function checkBackupReferences(
  content: BackupContent,
): ImportErrorEntry[] {
  const errors: ImportErrorEntry[] = [];
  const issue = (
    table: TableName,
    index: number,
    field: string,
    code: string,
  ) => {
    errors.push({ location: location(table, index), field, code, message: "" });
  };

  for (const table of TABLE_NAMES) {
    const seen = new Set<string>();
    content.tables[table].forEach((record, index) => {
      const key = primaryKeyOf(table, record);
      if (seen.has(key)) {
        issue(
          table,
          index,
          table === "settings" || table === "data_sources" ? "key" : "id",
          "backup.duplicate-id",
        );
      }
      seen.add(key);
    });
  }

  const profiles = content.tables.station_profiles;
  const defaults = profiles.filter((profile) => profile["isDefault"] === 1);
  if (profiles.length > 0 && defaults.length !== 1) {
    issue(
      "station_profiles",
      0,
      "isDefault",
      "station-profile.default-invalid",
    );
  }
  const profileIds = keySet(content, "station_profiles");
  content.tables.qso_logs.forEach((qso, index) => {
    if (!profileIds.has(text(qso, "stationProfileId"))) {
      issue(
        "qso_logs",
        index,
        "stationProfileId",
        "qso.station-profile-missing",
      );
    }
  });

  const receptionCategories = new Map(
    content.tables.swl_receptions.map((reception) => [
      text(reception, "id"),
      text(reception, "category"),
    ]),
  );
  content.tables.swl_receptions.forEach((reception, index) => {
    if (!profileIds.has(text(reception, "stationProfileId"))) {
      issue(
        "swl_receptions",
        index,
        "stationProfileId",
        "swl.station-profile-missing",
      );
    }
  });
  const detailsOf = new Set<string>();
  content.tables.reception_details.forEach((details, index) => {
    const receptionId = text(details, "receptionId");
    const category = receptionCategories.get(receptionId);
    if (category === undefined) {
      issue(
        "reception_details",
        index,
        "receptionId",
        "reception-details.reception-missing",
      );
    } else if (category !== text(details, "category")) {
      issue(
        "reception_details",
        index,
        "category",
        "reception-details.category-mismatch",
      );
    }
    if (detailsOf.has(receptionId)) {
      issue(
        "reception_details",
        index,
        "receptionId",
        "reception-details.duplicate",
      );
    }
    detailsOf.add(receptionId);
  });

  const subjects: Record<string, Set<string>> = {
    qso_logs: keySet(content, "qso_logs"),
    swl_receptions: keySet(content, "swl_receptions"),
  };
  const channels = new Set<string>();
  content.tables.qsl_records.forEach((qsl, index) => {
    const subjectTable = SUBJECT_TABLES[text(qsl, "subjectType")];
    if (!subjectTable || !subjects[subjectTable]?.has(text(qsl, "subjectId"))) {
      issue("qsl_records", index, "subjectId", "qsl-record.subject-missing");
    }
    const unique = `${text(qsl, "subjectType")}|${text(qsl, "subjectId")}|${text(qsl, "channel")}`;
    if (channels.has(unique)) {
      issue("qsl_records", index, "channel", "qsl-record.channel-taken");
    }
    channels.add(unique);
  });

  const owners: Record<string, Set<string>> = {
    ...subjects,
    qsl_records: keySet(content, "qsl_records"),
  };
  const contents = new Set<string>();
  content.tables.attachments.forEach((attachment, index) => {
    const ownerType = text(attachment, "ownerType");
    const ownerTable = OWNER_TABLES[ownerType];
    if (!ownerTable) {
      issue(
        "attachments",
        index,
        "ownerType",
        "attachment.owner-type-unavailable",
      );
    } else if (!owners[ownerTable]?.has(text(attachment, "ownerId"))) {
      issue("attachments", index, "ownerId", "attachment.owner-missing");
    }
    const unique = `${ownerType}|${text(attachment, "ownerId")}|${text(attachment, "sha256")}`;
    if (contents.has(unique)) {
      issue("attachments", index, "sha256", "attachment.same-content");
    }
    contents.add(unique);
  });

  return errors;
}

type MutableEffects = { -readonly [K in keyof TableEffects]: TableEffects[K] };

function emptyPlanParts() {
  const effects = {} as Record<TableName, MutableEffects>;
  const puts = {} as Record<TableName, StoredRecord[]>;
  const deletes = {} as Record<TableName, string[]>;
  for (const table of TABLE_NAMES) {
    effects[table] = {
      inserted: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      skipped: 0,
    };
    puts[table] = [];
    deletes[table] = [];
  }
  return { effects, puts, deletes };
}

function expectedCounts(
  local: LocalDataState,
  effects: Readonly<Record<TableName, TableEffects>>,
  cleared: ReadonlySet<TableName>,
): TableCounts {
  const counts = {} as Record<TableName, number>;
  for (const table of TABLE_NAMES) {
    const { inserted, deleted } = effects[table];
    counts[table] = cleared.has(table)
      ? inserted
      : local.counts[table] + inserted - deleted;
  }
  return counts;
}

function nonEmpty<T>(
  entries: Record<TableName, readonly T[]>,
): Partial<Record<TableName, readonly T[]>> {
  return Object.fromEntries(
    Object.entries(entries).filter(([, values]) => values.length > 0),
  );
}

/**
 * `replace`: the tables of the backup are emptied and refilled in the same
 * transaction. Without attachments in the backup, the local attachments
 * whose owner still exists after the restore are kept; the others would be
 * orphans and are deleted.
 */
function planReplace(
  content: BackupContent,
  local: LocalDataState,
): RestorePlan {
  const { effects, puts, deletes } = emptyPlanParts();
  const clear = TABLE_NAMES.filter(
    (table) => table !== "attachments" || content.includesAttachments,
  );
  for (const table of clear) {
    puts[table] = [...content.tables[table]];
    effects[table].inserted = content.tables[table].length;
    effects[table].deleted = local.counts[table];
  }
  if (!content.includesAttachments) {
    const owners: Record<string, Set<string>> = {
      qso_logs: keySet(content, "qso_logs"),
      swl_receptions: keySet(content, "swl_receptions"),
      qsl_records: keySet(content, "qsl_records"),
    };
    for (const attachment of local.attachments) {
      const ownerTable = OWNER_TABLES[attachment.ownerType];
      if (ownerTable && owners[ownerTable]?.has(attachment.ownerId)) {
        effects.attachments.unchanged++;
      } else {
        deletes.attachments.push(attachment.id);
        effects.attachments.deleted++;
      }
    }
  }
  return {
    mode: "replace",
    writes: { clear, deletes: nonEmpty(deletes), puts: nonEmpty(puts) },
    effects,
    conflicts: [],
    expectedCounts: expectedCounts(local, effects, new Set(clear)),
  };
}

/**
 * `merge`: upsert by key, nothing local is deleted except the details of a
 * reception taken from the backup (reception and details are one aggregate).
 * A backup record replaces the local one only if its `updatedAt` is more
 * recent; tables without `updatedAt` keep the local record. Records that
 * would break a unique rule are skipped and reported.
 */
function planMerge(content: BackupContent, local: LocalDataState): RestorePlan {
  const { effects, puts, deletes } = emptyPlanParts();
  const conflicts: RestoreConflict[] = [];

  const decide = (table: TableName, record: StoredRecord) => {
    const key = primaryKeyOf(table, record);
    const versions = local.versions[table];
    if (!versions.has(key)) return "insert" as const;
    const localUpdated = versions.get(key);
    const updatedAt = record["updatedAt"];
    return typeof updatedAt === "string" &&
      localUpdated !== undefined &&
      updatedAt > localUpdated
      ? ("update" as const)
      : ("unchanged" as const);
  };
  const apply = (
    table: TableName,
    record: StoredRecord,
    decision: "insert" | "update" | "unchanged",
  ) => {
    if (decision === "unchanged") {
      effects[table].unchanged++;
      return false;
    }
    puts[table].push(record);
    effects[table][decision === "insert" ? "inserted" : "updated"]++;
    return true;
  };
  const conflict = (table: TableName, key: string, code: string) => {
    effects[table].skipped++;
    conflicts.push({ table, key, code });
  };

  // Profiles: the local default stays the default.
  const hasLocalProfiles = local.counts.station_profiles > 0;
  for (const profile of content.tables.station_profiles) {
    const decision = decide("station_profiles", profile);
    const id = text(profile, "id");
    const isDefault =
      decision === "insert"
        ? hasLocalProfiles
          ? 0
          : profile["isDefault"]
        : local.defaultStationProfileId === id
          ? 1
          : 0;
    apply("station_profiles", { ...profile, isDefault }, decision);
  }

  for (const table of ["qso_logs", "settings"] as const) {
    for (const record of content.tables[table]) {
      apply(table, record, decide(table, record));
    }
  }

  // Receptions with their details.
  const backupDetails = new Map(
    content.tables.reception_details.map((details) => [
      text(details, "receptionId"),
      details,
    ]),
  );
  const localDetails = new Map<string, string[]>();
  for (const details of local.receptionDetails) {
    const ids = localDetails.get(details.receptionId) ?? [];
    ids.push(details.id);
    localDetails.set(details.receptionId, ids);
  }
  const takenReceptions = new Set<string>();
  for (const reception of content.tables.swl_receptions) {
    if (
      apply("swl_receptions", reception, decide("swl_receptions", reception))
    ) {
      takenReceptions.add(text(reception, "id"));
    }
  }
  for (const details of content.tables.reception_details) {
    if (!takenReceptions.has(text(details, "receptionId"))) {
      effects.reception_details.unchanged++;
    }
  }
  for (const receptionId of takenReceptions) {
    const details = backupDetails.get(receptionId);
    const localIds = localDetails.get(receptionId) ?? [];
    for (const id of localIds) {
      if (details && id === text(details, "id")) continue;
      deletes.reception_details.push(id);
      effects.reception_details.deleted++;
    }
    if (details) {
      puts.reception_details.push(details);
      const exists = local.versions.reception_details.has(text(details, "id"));
      effects.reception_details[exists ? "updated" : "inserted"]++;
    }
  }

  // QSL: one record per subject and channel; the subject never changes.
  const localQsl = new Map(local.qslRecords.map((qsl) => [qsl.id, qsl]));
  const localChannels = new Map(
    local.qslRecords.map((qsl) => [
      `${qsl.subjectType}|${qsl.subjectId}|${qsl.channel}`,
      qsl.id,
    ]),
  );
  const skippedQsl = new Set<string>();
  for (const qsl of content.tables.qsl_records) {
    const id = text(qsl, "id");
    const unique = `${text(qsl, "subjectType")}|${text(qsl, "subjectId")}|${text(qsl, "channel")}`;
    const owner = localChannels.get(unique);
    const existing = localQsl.get(id);
    if (
      existing &&
      (existing.subjectType !== text(qsl, "subjectType") ||
        existing.subjectId !== text(qsl, "subjectId"))
    ) {
      conflict("qsl_records", id, "qsl-record.subject-changed");
      continue;
    }
    if (owner !== undefined && owner !== id) {
      conflict("qsl_records", id, "qsl-record.channel-taken");
      if (!existing) skippedQsl.add(id);
      continue;
    }
    apply("qsl_records", qsl, decide("qsl_records", qsl));
  }

  // Attachments are immutable: an existing id is kept as it is.
  if (content.includesAttachments) {
    const localContents = new Set(
      local.attachments.map(
        (attachment) =>
          `${attachment.ownerType}|${attachment.ownerId}|${attachment.sha256}`,
      ),
    );
    for (const attachment of content.tables.attachments) {
      const id = text(attachment, "id");
      if (local.versions.attachments.has(id)) {
        effects.attachments.unchanged++;
      } else if (
        text(attachment, "ownerType") === "qsl" &&
        skippedQsl.has(text(attachment, "ownerId"))
      ) {
        conflict("attachments", id, "attachment.owner-skipped");
      } else if (
        localContents.has(
          `${text(attachment, "ownerType")}|${text(attachment, "ownerId")}|${text(attachment, "sha256")}`,
        )
      ) {
        conflict("attachments", id, "attachment.same-content");
      } else {
        apply("attachments", attachment, "insert");
      }
    }
  }

  // Runtime state of the sources and job history: local records win.
  for (const table of ["data_sources", "import_jobs"] as const) {
    for (const record of content.tables[table]) {
      const exists = local.versions[table].has(primaryKeyOf(table, record));
      apply(table, record, exists ? "unchanged" : "insert");
    }
  }

  return {
    mode: "merge",
    writes: { clear: [], deletes: nonEmpty(deletes), puts: nonEmpty(puts) },
    effects,
    conflicts,
    expectedCounts: expectedCounts(local, effects, new Set()),
  };
}

/** Writes and effects of restoring `content` over `local` in `mode`. */
export function planRestore(
  content: BackupContent,
  local: LocalDataState,
  mode: RestoreMode,
): RestorePlan {
  return mode === "replace"
    ? planReplace(content, local)
    : planMerge(content, local);
}

/** Whether two plans have the same effects (preview still valid). */
export function sameEffects(a: RestorePlan, b: RestorePlan): boolean {
  const summary = (plan: RestorePlan) =>
    JSON.stringify([
      plan.mode,
      plan.effects,
      plan.conflicts,
      plan.expectedCounts,
    ]);
  return summary(a) === summary(b);
}
