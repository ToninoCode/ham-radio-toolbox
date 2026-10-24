import type { TableName } from "./tables";

/** Fields set by repositories, never by callers (DATABASE.md § 1). */
export type GeneratedField = "id" | "createdAt" | "updatedAt";

/**
 * Input to create an entity: the schema input (raw values, normalised by
 * the repository) without the generated fields.
 */
export type Draft<Input> = Omit<Input, GeneratedField>;

/** Input to update an entity: any subset of the draft fields. */
export type Patch<Input> = Partial<Draft<Input>>;

/**
 * Records removed by a delete, per table, including the cascade
 * (DATABASE.md § 6), e.g. `{ qso_logs: 1, qsl_records: 2, attachments: 3 }`.
 */
export type DeletionReport = Readonly<Partial<Record<TableName, number>>>;
