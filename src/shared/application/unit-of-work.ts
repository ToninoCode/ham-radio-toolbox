import type { Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";

/**
 * Runs several repository operations as one atomic transaction
 * (ARCHITECTURE.md § 5.2, NFR-REL-01).
 *
 * - `work` returns `ok` → everything is committed together;
 * - `work` returns `err` → everything is rolled back and that error is
 *   returned unchanged;
 * - `work` throws → everything is rolled back and the exception propagates
 *   (programming error);
 * - the storage fails (quota, abort) → rolled back, `PersistenceError`.
 *
 * A repository error is a value, not an exception. Storage failures
 * (`quota-exceeded`, `transaction-failed`, `unavailable`) make the unit fail
 * even if `work` ignores them. Outcomes about the data (`not-found`,
 * `conflict`, `invalid-input`) can be handled by `work`: it must return them
 * to roll back, otherwise the operations that did succeed are committed.
 *
 * Rule for `work`: await **only** repository calls. Reading files, hashing,
 * `fetch`, timers or any other asynchronous work must happen before `run`
 * (or after it): while `work` waits for something that is not a database
 * request, IndexedDB commits the transaction automatically, the writes done
 * so far stay committed and the next operation fails with
 * `persistence.transaction-failed`.
 *
 * Units nested inside `work` join the outer unit; a failure of the inner one
 * rolls back the whole outer unit.
 */
export interface UnitOfWork {
  run<T, E>(
    work: () => Promise<Result<T, E>>,
  ): Promise<Result<T, E | PersistenceError>>;
}
