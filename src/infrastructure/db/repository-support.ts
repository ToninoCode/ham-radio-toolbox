import type { z } from "zod";
import type { UtcDateTime } from "@/core/time";
import {
  invalidInput,
  validationIssues,
  type Clock,
  type IdGenerator,
  type PersistenceError,
  type TableName,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";

/** Dependencies of every Dexie repository. */
export interface RepositoryDeps {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Removes keys whose value is `undefined`, in plain objects at any depth
 * (DATABASE.md § 1: optional fields are absent). Arrays, Blobs and other
 * objects are kept as they are.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (!isPlainObject(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined) result[key] = stripUndefined(field);
  }
  return result as T;
}

/**
 * Validates and normalises a record with its entity schema: the gate in
 * front of every write (ARCHITECTURE.md § 9). Returns the canonical record
 * without `undefined` fields, or `invalid-input` with all the issues.
 */
export function parseRecord<S extends z.ZodType>(
  table: TableName,
  schema: S,
  input: unknown,
): Result<z.output<S>, PersistenceError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err(invalidInput(table, validationIssues(parsed.error)));
  }
  return ok(stripUndefined(parsed.data));
}

/** The later of two instants (UTC strings compare chronologically). */
export function laterOf(a: UtcDateTime, b: UtcDateTime): UtcDateTime {
  return a < b ? b : a;
}

/** A new entity from a draft: fresh id, `createdAt = updatedAt = now`. */
export function newEntity<S extends z.ZodType>(
  table: TableName,
  schema: S,
  draft: object,
  deps: RepositoryDeps,
): Result<z.output<S>, PersistenceError> {
  const now = deps.clock.now();
  return parseRecord(table, schema, {
    ...draft,
    id: deps.ids.newId(),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * An existing entity with a patch applied: fields set to `undefined` in
 * the patch are removed; `fixed` fields win over the patch; `id` and
 * `createdAt` never change; `updatedAt` is now (never before `createdAt`,
 * even if the clock went back).
 */
export function changedEntity<S extends z.ZodType>(
  table: TableName,
  schema: S,
  existing: {
    readonly id: string;
    readonly createdAt: UtcDateTime;
  },
  patch: object,
  deps: RepositoryDeps,
  fixed: object = {},
): Result<z.output<S>, PersistenceError> {
  return parseRecord(table, schema, {
    ...existing,
    ...patch,
    ...fixed,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: laterOf(deps.clock.now(), existing.createdAt),
  });
}

/** Oldest first, by `createdAt` then `id` (stable order for lists). */
export function byCreation(
  a: { readonly createdAt: string; readonly id: string },
  b: { readonly createdAt: string; readonly id: string },
): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
