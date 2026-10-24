import type {
  ImportCounts,
  ImportErrorEntry,
  ImportJobKind,
} from "@/core/import-job";

/*
 * Contract of the generic import flow (FR-GEN-03, DATABASE.md § 8):
 * parse → validate → detect duplicates → preview → commit.
 *
 * - Everything up to the preview runs outside any transaction (file reads,
 *   parsing in a worker, hashing) and writes nothing.
 * - The commit is one `UnitOfWork.run` that writes the records through the
 *   module repositories and the `import_jobs` row (`committed`); if it fails
 *   the unit is rolled back and a `failed` job is written on its own.
 * - Cancelling writes only a `cancelled` job.
 *
 * TODO(M2): Block C — pipeline use case, duplicate policies, tests with a
 * failing commit; format-specific parsers from M3 (ADIF) on.
 */

/** A record ready to be committed, with its position in the source. */
export interface ImportCandidate<T> {
  readonly location: string;
  readonly value: T;
  /** Id of the stored record it duplicates, if any. */
  readonly duplicateOfId?: string;
}

/** Result of the preview: what the commit would write. */
export interface ImportPreview<T> {
  readonly kind: ImportJobKind;
  readonly fileName?: string;
  readonly fileSha256?: string;
  readonly sourceKey?: string;
  readonly datasetVersion?: string;
  readonly candidates: readonly ImportCandidate<T>[];
  readonly errors: readonly ImportErrorEntry[];
  readonly counts: ImportCounts;
}
