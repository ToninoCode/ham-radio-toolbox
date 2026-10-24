import Dexie from "dexie";
import type {
  PersistenceError,
  TableName,
  UnavailableReason,
} from "@/shared/application";
import { conflict } from "@/shared/application";
import { err, type Result } from "@/shared/types";

/*
 * Mapping of IndexedDB/Dexie failures to PersistenceError (ARCHITECTURE.md
 * § 5.5). Only failures caused by the storage or the environment are
 * mapped; any other exception (TypeError, DataError on an invalid key…) is
 * a programming error and keeps propagating.
 */

const TRANSACTION_ERRORS = new Set([
  "AbortError",
  "TransactionInactiveError",
  "PrematureCommitError",
  "ReadOnlyError",
  "SubTransactionError",
  "TimeoutError",
]);

const UNAVAILABLE_ERRORS: ReadonlyMap<string, UnavailableReason> = new Map([
  ["MissingAPIError", "missing-api"],
  ["OpenFailedError", "open-failed"],
  ["InvalidStateError", "open-failed"],
  ["InvalidAccessError", "open-failed"],
  ["UnknownError", "open-failed"],
  ["NoSuchDatabaseError", "open-failed"],
  ["VersionError", "newer-version"],
  ["UpgradeError", "upgrade-failed"],
  ["DatabaseClosedError", "closed"],
]);

interface NamedError {
  readonly name: string;
  readonly inner?: unknown;
  readonly failures?: readonly unknown[];
}

function asNamedError(error: unknown): NamedError | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { name } = error as { name?: unknown };
  return typeof name === "string" ? (error as NamedError) : undefined;
}

/** Names of the error, of its inner errors and of bulk failures. */
function errorNames(error: unknown, depth = 0): string[] {
  const named = asNamedError(error);
  if (!named || depth > 4) return [];
  return [
    named.name,
    ...errorNames(named.inner, depth + 1),
    ...(named.failures ?? []).flatMap((failure) =>
      errorNames(failure, depth + 1),
    ),
  ];
}

/**
 * PersistenceError for a storage failure, or `undefined` for errors that
 * must propagate. `table` qualifies constraint violations (unique keys).
 */
export function toPersistenceError(
  error: unknown,
  table?: TableName,
): PersistenceError | undefined {
  const names = errorNames(error);
  const [name] = names;
  if (name === undefined) return undefined;

  if (names.includes("QuotaExceededError")) {
    return { code: "persistence.quota-exceeded" };
  }
  // The innermost known cause is the most specific one (Dexie wraps the
  // original failure, e.g. DatabaseClosedError → VersionError).
  const unavailable = [...names]
    .reverse()
    .find((candidate) => UNAVAILABLE_ERRORS.has(candidate));
  if (unavailable) {
    return {
      code: "persistence.unavailable",
      reason: UNAVAILABLE_ERRORS.get(unavailable) ?? "open-failed",
      cause: unavailable,
    };
  }
  if (names.includes("ConstraintError")) {
    return table
      ? conflict(table, "duplicate", "unique-key")
      : { code: "persistence.transaction-failed", cause: "ConstraintError" };
  }
  if (names.some((candidate) => TRANSACTION_ERRORS.has(candidate))) {
    return { code: "persistence.transaction-failed", cause: name };
  }
  return undefined;
}

/** Failures of the storage itself, as opposed to outcomes about the data. */
function isStorageFailure(error: PersistenceError): boolean {
  return (
    error.code === "persistence.quota-exceeded" ||
    error.code === "persistence.transaction-failed" ||
    error.code === "persistence.unavailable"
  );
}

/**
 * Inside a unit of work, a storage failure must make the whole unit fail
 * even if the caller ignores the returned error: the ambient transaction is
 * aborted, so it can no longer commit a partial result.
 */
function abortAmbientTransaction(): void {
  const transaction = Dexie.currentTransaction;
  if (!transaction?.active) return;
  try {
    transaction.abort();
  } catch {
    // Already finishing: IndexedDB reports the outcome on the transaction.
  }
}

/**
 * Runs a repository operation, turning storage failures into `err`
 * results. Expected outcomes (not found, conflicts, invalid input) are
 * already results and leave the ambient transaction usable; storage
 * failures abort it; unexpected exceptions are rethrown.
 */
export async function guard<T>(
  table: TableName,
  operation: () => Promise<Result<T, PersistenceError>>,
): Promise<Result<T, PersistenceError>> {
  try {
    return await operation();
  } catch (error) {
    const mapped = toPersistenceError(error, table);
    if (!mapped) throw error;
    if (isStorageFailure(mapped)) abortAmbientTransaction();
    return err(mapped);
  }
}
