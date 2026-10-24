import type Dexie from "dexie";
import { toDexieUpgrade } from "./migrations/dexie-upgrade";
import type { RecordMigration } from "./migrations/record-migration";

/**
 * One version of the IndexedDB schema (ADR-0006): the Dexie `stores()`
 * declaration of every table that changes and, from v2 on, the data
 * migration from the previous version. Only indexed fields appear in
 * `stores`; `null` deletes a table.
 */
export interface SchemaVersion {
  readonly version: number;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly migration?: RecordMigration;
}

/**
 * Schema v1 (M2), as DATABASE.md § 5. It becomes immutable when M2 is
 * deployed to production (ADR-0006): later changes are new versions
 * appended to SCHEMA_VERSIONS, never edits of this object.
 */
export const SCHEMA_V1: SchemaVersion = Object.freeze({
  version: 1,
  stores: Object.freeze({
    station_profiles: "id, kind, callsign, isDefault",
    qso_logs:
      "id, stationProfileId, callsign, datetimeOn, band, mode, dxcc, importJobId, " +
      "[band+mode], [callsign+datetimeOn], [stationProfileId+datetimeOn]",
    swl_receptions:
      "id, stationProfileId, category, datetimeStart, frequencyHz, stationName, country, language, " +
      "[category+datetimeStart]",
    reception_details: "id, &receptionId",
    qsl_records:
      "id, channel, status, [subjectType+subjectId], [channel+status]",
    attachments: "id, sha256, [ownerType+ownerId]",
    settings: "key",
    data_sources: "key",
    import_jobs: "id, kind, status, startedAt",
  }),
});

/**
 * Every schema version, oldest first. TODO(M5): v2 (`stations`,
 * `frequencies`, `broadcast_schedules`) is appended here with its test.
 */
export const SCHEMA_VERSIONS: readonly SchemaVersion[] = Object.freeze([
  SCHEMA_V1,
]);

/** Version of the schema declared by this build. */
export const CURRENT_SCHEMA_VERSION = 1;

/** Data migrations of the given versions, for the restore of old backups. */
export function recordMigrations(
  versions: readonly SchemaVersion[] = SCHEMA_VERSIONS,
): RecordMigration[] {
  return versions.flatMap((version) =>
    version.migration ? [version.migration] : [],
  );
}

/**
 * Declares the versions on a Dexie instance. Versions must start at 1 and
 * be consecutive, and a migration must go from the previous version: any
 * other list is a programming error.
 */
export function applySchemaVersions(
  db: Dexie,
  versions: readonly SchemaVersion[],
): void {
  versions.forEach((schema, index) => {
    if (schema.version !== index + 1) {
      throw new Error(
        `Schema versions must be consecutive from 1: found ${schema.version} at position ${index + 1}`,
      );
    }
    const { migration } = schema;
    if (
      migration &&
      (migration.from !== schema.version - 1 || migration.to !== schema.version)
    ) {
      throw new Error(
        `Migration ${migration.from}→${migration.to} does not lead to version ${schema.version}`,
      );
    }
    const declared = db.version(schema.version).stores({ ...schema.stores });
    if (migration) declared.upgrade(toDexieUpgrade(migration));
  });
}
