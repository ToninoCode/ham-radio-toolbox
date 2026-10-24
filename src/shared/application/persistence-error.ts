import type { z } from "zod";
import { issueCode } from "@/core/validation";
import type { DomainError } from "@/shared/types";
import type { TableName } from "./tables";

/** One invalid field: dotted path (`data.callsignHeard`) and stable code. */
export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
}

/**
 * Why a write conflicts with the stored data:
 * - `duplicate`: a record with the same key or unique value exists;
 * - `missing-reference`: a referenced record does not exist;
 * - `referenced`: the record is still referenced and cannot be deleted;
 * - `invariant`: a cross-record rule would break (`rule` names it).
 */
export type ConflictReason =
  "duplicate" | "missing-reference" | "referenced" | "invariant";

/**
 * Why the database cannot be used:
 * - `missing-api`: no IndexedDB (very old browser, some private modes);
 * - `open-failed`: the browser refused or failed to open it;
 * - `newer-version`: the stored schema is newer than this app (downgrade);
 * - `upgrade-failed`: a schema migration failed (rolled back);
 * - `closed`: the connection was closed (e.g. upgrade from another tab).
 */
export type UnavailableReason =
  "missing-api" | "open-failed" | "newer-version" | "upgrade-failed" | "closed";

/**
 * Expected failures of persistence operations, returned as `Result` errors
 * (ARCHITECTURE.md § 5.5). Codes are stable and translated by presentation;
 * `cause` is the technical error name, for diagnostics only. Programming
 * errors are not mapped: they are thrown.
 */
export type PersistenceError =
  | (DomainError<"persistence.not-found"> & {
      readonly table: TableName;
      readonly key: string;
    })
  | (DomainError<"persistence.invalid-input"> & {
      readonly table: TableName;
      readonly issues: readonly ValidationIssue[];
    })
  | (DomainError<"persistence.conflict"> & {
      readonly table: TableName;
      readonly reason: ConflictReason;
      /** Stable rule code, e.g. `station-profile.referenced`. */
      readonly rule: string;
      /** Key of the conflicting or missing record, when known. */
      readonly key?: string;
      /** Table of the referenced or referencing records. */
      readonly related?: TableName;
    })
  | (DomainError<"persistence.transaction-failed"> & {
      readonly cause: string;
    })
  | DomainError<"persistence.quota-exceeded">
  | (DomainError<"persistence.unavailable"> & {
      readonly reason: UnavailableReason;
      readonly cause?: string;
    });

export type PersistenceErrorCode = PersistenceError["code"];

export function notFound(table: TableName, key: string): PersistenceError {
  return { code: "persistence.not-found", table, key };
}

export function invalidInput(
  table: TableName,
  issues: readonly ValidationIssue[],
): PersistenceError {
  return { code: "persistence.invalid-input", table, issues };
}

export function conflict(
  table: TableName,
  reason: ConflictReason,
  rule: string,
  details: { key?: string; related?: TableName } = {},
): PersistenceError {
  return { code: "persistence.conflict", table, reason, rule, ...details };
}

/** Issues of a failed Zod parse, with the codes of `issueCode()`. */
export function validationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issueCode(issue),
  }));
}
