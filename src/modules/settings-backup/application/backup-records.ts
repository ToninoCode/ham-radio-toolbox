import type { z } from "zod";
import { attachmentSchema } from "@/core/attachment";
import { dataSourceSchema } from "@/core/data-source";
import { importJobSchema } from "@/core/import-job";
import { issueCode } from "@/core/validation";
import { qsoLogSchema } from "@/modules/ham-logbook";
import { qslRecordSchema } from "@/modules/qsl-manager";
import {
  receptionDetailsSchema,
  swlReceptionSchema,
} from "@/modules/swl-logbook";
import type {
  StoredRecord,
  TableName,
  ValidationIssue,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import { stripUndefined } from "@/shared/utils";
import { settingRecordSchema } from "../domain/setting";
import { stationProfileSchema } from "../domain/station-profile";

/*
 * Entity schemas of every table of schema v1, used to validate records
 * before export and after reading a backup (ADR-0013: the same schema serves
 * forms, imports and restore). Schemas are strict: a field that DATABASE.md
 * does not document is rejected.
 */

const RECORD_SCHEMAS: Readonly<Record<TableName, z.ZodType>> = {
  station_profiles: stationProfileSchema,
  qso_logs: qsoLogSchema,
  swl_receptions: swlReceptionSchema,
  reception_details: receptionDetailsSchema,
  qsl_records: qslRecordSchema,
  attachments: attachmentSchema,
  settings: settingRecordSchema,
  data_sources: dataSourceSchema,
  import_jobs: importJobSchema,
};

/** Primary key field of each table (DATABASE.md § 1). */
export const PRIMARY_KEY_FIELD: Readonly<Record<TableName, "id" | "key">> = {
  station_profiles: "id",
  qso_logs: "id",
  swl_receptions: "id",
  reception_details: "id",
  qsl_records: "id",
  attachments: "id",
  settings: "key",
  data_sources: "key",
  import_jobs: "id",
};

/** Primary key of a validated record. */
export function primaryKeyOf(table: TableName, record: StoredRecord): string {
  return String(record[PRIMARY_KEY_FIELD[table]]);
}

/** Plain JSON object (not an array, not a class instance). */
export function isPlainRecord(value: unknown): value is StoredRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Validates and normalises one record of a table: the canonical record
 * without `undefined` fields, or the issues with their stable codes.
 */
export function validateRecord(
  table: TableName,
  value: unknown,
): Result<StoredRecord, ValidationIssue[]> {
  const parsed = RECORD_SCHEMAS[table].safeParse(value);
  if (!parsed.success) {
    return err(
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        code: issueCode(issue),
      })),
    );
  }
  return ok(stripUndefined(parsed.data) as StoredRecord);
}
