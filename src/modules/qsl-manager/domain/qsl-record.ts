import { z } from "zod";
import {
  callsignSchema,
  checkTimestamps,
  optionalTextSchema,
  timestampFields,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";

/*
 * QSL record (DATABASE.md `qsl_records`): the single source of truth on
 * QSL status (D-12), linked to a QSO or to an SWL reception. At most one
 * record per subject and channel (checked by the repository).
 *
 * TODO(M10): state transitions and their dates (FR-QSL-02); ADIF mapping
 * of the QSL fields in M3 (BL-M3-06).
 */

export const QSL_SUBJECT_TYPES = ["qso", "swl"] as const;
export type QslSubjectType = (typeof QSL_SUBJECT_TYPES)[number];

export const QSL_CHANNELS = [
  "paper",
  "eqsl",
  "lotw",
  "qrz",
  "clublog",
  "other",
] as const;
export type QslChannel = (typeof QSL_CHANNELS)[number];

export const QSL_STATUSES = [
  "pending",
  "requested",
  "sent",
  "received",
  "confirmed",
] as const;

export const qslRecordSchema = z
  .strictObject({
    id: uuidSchema,
    subjectType: z.enum(QSL_SUBJECT_TYPES),
    subjectId: uuidSchema,
    channel: z.enum(QSL_CHANNELS),
    via: z.enum(["bureau", "direct", "manager", "electronic"]).optional(),
    managerCallsign: callsignSchema.optional(),
    status: z.enum(QSL_STATUSES),
    requestedAt: utcDateTimeSchema.optional(),
    sentAt: utcDateTimeSchema.optional(),
    receivedAt: utcDateTimeSchema.optional(),
    confirmedAt: utcDateTimeSchema.optional(),
    notes: optionalTextSchema,
    origin: z.enum(["manual", "adif-import"]),
    importJobId: uuidSchema.optional(),
    ...timestampFields,
  })
  .superRefine(checkTimestamps);

export type QslRecord = z.infer<typeof qslRecordSchema>;
export type QslRecordInput = z.input<typeof qslRecordSchema>;
