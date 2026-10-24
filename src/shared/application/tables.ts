/**
 * Logical names of the persisted collections of schema v1 (DATABASE.md
 * § 3). They identify records in errors and are the keys of the backup
 * format; adapters map them to their storage (Dexie tables of the same
 * name). New collections are added with the schema version that creates
 * them.
 */
export const TABLE_NAMES = [
  "station_profiles",
  "qso_logs",
  "swl_receptions",
  "reception_details",
  "qsl_records",
  "attachments",
  "settings",
  "data_sources",
  "import_jobs",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
