import type { z } from "zod";
import type { ImportJob, importJobSchema } from "@/core/import-job";
import type { Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";

export type ImportJobDraft = Omit<z.input<typeof importJobSchema>, "id">;

/**
 * History of import attempts (FR-SET-07). Inside a unit of work the job is
 * committed together with the imported data (DATABASE.md § 8). Jobs are not
 * deleted in schema v1.
 *
 * TODO(M5): deleting a schedule dataset (job with its `broadcast_schedules`).
 */
export interface ImportJobRepository {
  create(draft: ImportJobDraft): Promise<Result<ImportJob, PersistenceError>>;
  get(id: string): Promise<Result<ImportJob, PersistenceError>>;
  /** Most recent jobs first (by `startedAt`). */
  listRecent(limit: number): Promise<Result<ImportJob[], PersistenceError>>;
  /**
   * Committed jobs of a file with this SHA-256, most recent first: warns
   * about importing the same file again (DATABASE.md `import_jobs`).
   */
  findCommittedByFileSha256(
    sha256: string,
  ): Promise<Result<ImportJob[], PersistenceError>>;
}
