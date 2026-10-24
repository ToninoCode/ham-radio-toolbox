import type { AttachmentOwnerType } from "@/core/attachment";
import type { QslSubjectType } from "@/modules/qsl-manager";
import type { TableName } from "@/shared/application";
import type { AppDatabase } from "./app-database";

/*
 * Referential integrity of schema v1 (DATABASE.md § 2.1, § 6), enforced by
 * the repositories because IndexedDB has no foreign keys. The helpers run
 * inside the caller's transaction, whose scope must include the tables
 * listed in SCOPES for the operation.
 */

/** Tables read or written by each repository operation (transaction scope). */
export const SCOPES = {
  stationProfileWrite: ["station_profiles"],
  stationProfileDelete: ["station_profiles", "qso_logs", "swl_receptions"],
  qsoWrite: ["qso_logs", "station_profiles"],
  qsoDelete: ["qso_logs", "qsl_records", "attachments"],
  swlWrite: ["swl_receptions", "reception_details", "station_profiles"],
  swlDelete: [
    "swl_receptions",
    "reception_details",
    "qsl_records",
    "attachments",
  ],
  qslWrite: ["qsl_records", "qso_logs", "swl_receptions"],
  qslDelete: ["qsl_records", "attachments"],
  attachmentWrite: ["attachments", "qso_logs", "swl_receptions", "qsl_records"],
} as const satisfies Record<string, readonly TableName[]>;

/**
 * Table of each attachment owner type. `resource` has no table in schema
 * v1: attachments to resources are rejected until v5 (M9).
 */
export const ATTACHMENT_OWNER_TABLES: Readonly<
  Record<AttachmentOwnerType, TableName | undefined>
> = {
  qso: "qso_logs",
  swl_reception: "swl_receptions",
  qsl: "qsl_records",
  resource: undefined,
};

/** Table of each QSL subject type. */
export const QSL_SUBJECT_TABLES: Readonly<Record<QslSubjectType, TableName>> = {
  qso: "qso_logs",
  swl: "swl_receptions",
};

/** Whether a record with the given primary key exists. */
export async function recordExists(
  db: AppDatabase,
  table: TableName,
  key: string,
): Promise<boolean> {
  return (await db.table(table).where(":id").equals(key).count()) > 0;
}

/** Deletes the attachments of the given owners; returns how many. */
export async function deleteAttachmentsOf(
  db: AppDatabase,
  ownerType: AttachmentOwnerType,
  ownerIds: readonly string[],
): Promise<number> {
  if (ownerIds.length === 0) return 0;
  return db.attachments
    .where("[ownerType+ownerId]")
    .anyOf(ownerIds.map((ownerId) => [ownerType, ownerId]))
    .delete();
}

/** Deletes the QSL records of a subject and their attachments. */
export async function deleteQslRecordsOf(
  db: AppDatabase,
  subjectType: QslSubjectType,
  subjectId: string,
): Promise<{ qslRecords: number; attachments: number }> {
  const ids = await db.qsl_records
    .where("[subjectType+subjectId]")
    .equals([subjectType, subjectId])
    .primaryKeys();
  const attachments = await deleteAttachmentsOf(db, "qsl", ids);
  await db.qsl_records.bulkDelete(ids);
  return { qslRecords: ids.length, attachments };
}

/** QSO and receptions that reference a station profile. */
export async function stationProfileReferences(
  db: AppDatabase,
  stationProfileId: string,
): Promise<{ qsoLogs: number; swlReceptions: number }> {
  const [qsoLogs, swlReceptions] = await Promise.all([
    db.qso_logs.where("stationProfileId").equals(stationProfileId).count(),
    db.swl_receptions
      .where("stationProfileId")
      .equals(stationProfileId)
      .count(),
  ]);
  return { qsoLogs, swlReceptions };
}
