import { z } from "zod";
import {
  catalogKeySchema,
  optionalTextSchema,
  utcDateTimeSchema,
} from "@/core/validation";

/*
 * Local state of an external data source (DATABASE.md `data_sources`,
 * FR-SET-08, FR-DSH-05). Static metadata (name, licence, URL) stays in the
 * provider descriptor in code (ARCHITECTURE.md § 7); this record holds only
 * what changes at runtime. The key is a catalog key, not a UUID (ADR-0005).
 */

export const ACCESS_MODES = ["native", "manual-import", "link"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const dataSourceSchema = z.strictObject({
  key: catalogKeySchema,
  accessMode: z.enum(ACCESS_MODES),
  lastAttemptAt: utcDateTimeSchema.optional(),
  lastSuccessAt: utcDateTimeSchema.optional(),
  lastError: optionalTextSchema,
  datasetVersion: optionalTextSchema,
  nextAllowedFetchAt: utcDateTimeSchema.optional(),
});

export type DataSource = z.infer<typeof dataSourceSchema>;
