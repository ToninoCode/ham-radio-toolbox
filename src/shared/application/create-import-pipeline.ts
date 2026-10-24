import {
  MAX_IMPORT_ERRORS,
  truncateImportErrors,
  type ImportCounts,
  type ImportErrorEntry,
  type ImportJob,
} from "@/core/import-job";
import { err, ok, type Result } from "@/shared/types";
import type { ImportJobRepository } from "./import-job-repository";
import type {
  ConflictPolicy,
  ImportCandidate,
  ImportCommitOptions,
  ImportError,
  ImportFileReader,
  ImportMatch,
  ImportNotice,
  ImportOutcome,
  ImportPipeline,
  ImportPreview,
  ImportTarget,
  ImportWriteDecision,
} from "./import-pipeline";
import { ABORTED, isAborted } from "./operation";
import type { Clock, ContentHasher } from "./system-ports";
import type { UnitOfWork } from "./unit-of-work";

/*
 * Generic import use cases (BL-M2-07, FR-GEN-03): see the contract in
 * import-pipeline.ts. Only reads happen before the commit; the commit is a
 * single unit of work containing the job and the records.
 */

export interface ImportPipelineDeps {
  readonly unitOfWork: UnitOfWork;
  readonly importJobs: ImportJobRepository;
  readonly clock: Clock;
  readonly hasher: ContentHasher;
  readonly files: ImportFileReader;
  /** Hard limit for any format, below the format's own (configurable). */
  readonly maxBytes?: number;
}

/** Characters read to identify the format. */
const HEAD_BYTES = 4096;
/** Records validated between two abort checks and progress reports. */
const BATCH = 500;

const DUPLICATE_IN_FILE = "import.duplicate-in-file";

/** Location of a commit failure in the job's error list. */
const COMMIT_LOCATION = "commit";

interface Decision<T> {
  readonly candidate: ImportCandidate<T>;
  readonly decision: ImportWriteDecision;
}

function decide<T>(
  candidates: readonly ImportCandidate<T>[],
  conflicts: ConflictPolicy,
): Decision<T>[] {
  const decisions: Decision<T>[] = [];
  for (const candidate of candidates) {
    if (candidate.status === "new") {
      decisions.push({ candidate, decision: "insert" });
    } else if (candidate.status === "conflict" && conflicts === "replace") {
      decisions.push({ candidate, decision: "replace" });
    }
  }
  return decisions;
}

/**
 * Job counts (DATABASE.md `import_jobs.counts`, fixed by schema v1):
 * `duplicates` = repeated in the file + equal to stored + conflicting;
 * `skipped` = everything valid or ignored that was not written, so that
 * `inserted + updated + skipped = valid + ignored`.
 */
function committedCounts<T>(
  preview: ImportPreview<T>,
  decisions: readonly Decision<T>[],
): ImportCounts {
  const { summary } = preview;
  const inserted = decisions.filter((d) => d.decision === "insert").length;
  const updated = decisions.length - inserted;
  return {
    total: summary.total,
    valid: summary.valid,
    invalid: summary.invalid,
    duplicates:
      summary.inFileDuplicates + summary.duplicates + summary.conflicts,
    inserted,
    updated,
    skipped: summary.valid + summary.ignored - inserted - updated,
  };
}

/** Counts of a job that wrote nothing (failed or cancelled). */
function unwrittenCounts<T>(preview: ImportPreview<T>): ImportCounts {
  const { summary } = preview;
  return {
    total: summary.total,
    valid: summary.valid,
    invalid: summary.invalid,
    duplicates:
      summary.inFileDuplicates + summary.duplicates + summary.conflicts,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };
}

function sameMatches<T>(
  matches: readonly ImportMatch[],
  candidates: readonly ImportCandidate<T>[],
): boolean {
  return (
    matches.length === candidates.length &&
    matches.every((match, i) => {
      const candidate = candidates[i]!;
      return (
        match.status === candidate.status &&
        (match.status === "new" ? undefined : match.existingId) ===
          candidate.existingId
      );
    })
  );
}

/** Stable code of a commit error (domain errors carry one). */
function codeOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    if (typeof code === "string" && code !== "") return code;
  }
  return "import.commit-failed";
}

/** Technical description of a failure, for the job's diagnostics. */
function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "object" && error !== null && "code" in error) {
    return JSON.stringify(error);
  }
  return String(error);
}

export function createImportPipeline(deps: ImportPipelineDeps): ImportPipeline {
  const { unitOfWork, importJobs, clock, hasher, files } = deps;

  function jobDraft<T>(
    preview: ImportPreview<T>,
    status: "committed" | "failed" | "cancelled",
    counts: ImportCounts,
    errors: readonly ImportErrorEntry[],
    options: Record<string, string>,
  ) {
    const truncated = truncateImportErrors(errors);
    return {
      kind: preview.kind,
      sourceKey: preview.sourceKey,
      fileName: preview.fileName,
      fileSha256: preview.fileSha256,
      datasetVersion: preview.datasetVersion,
      status,
      startedAt: preview.startedAt,
      finishedAt: clock.now(),
      counts,
      errors: truncated.errors,
      ...(truncated.errorsTruncated || preview.errorsTruncated
        ? { errorsTruncated: true as const }
        : {}),
      options: { format: preview.formatId, ...options },
    };
  }

  /** Records a failed attempt; a failure to record it is not reported. */
  async function recordFailure<T>(
    preview: ImportPreview<T>,
    failure: ImportErrorEntry,
    conflicts: ConflictPolicy,
  ): Promise<void> {
    try {
      await importJobs.create(
        jobDraft(
          preview,
          "failed",
          unwrittenCounts(preview),
          [failure, ...preview.errors],
          { conflicts },
        ),
      );
    } catch {
      // The database itself is failing: the caller still gets the
      // original error, which is the useful one.
    }
  }

  return {
    async preview(file, formats, target, options = {}) {
      const { signal, onProgress } = options;
      const startedAt = clock.now();
      const sizeBytes = file.content.size;
      if (sizeBytes === 0) return err({ code: "import.file-empty" });
      if (isAborted(signal)) return err(ABORTED);

      const head = await files.readHead(file.content, HEAD_BYTES);
      if (!head.ok) return head;
      const format = formats.find((candidate) =>
        candidate.matches({ name: file.name, sizeBytes }, head.value),
      );
      if (!format) return err({ code: "import.format-unknown" });
      const limitBytes = Math.min(
        format.maxBytes,
        deps.maxBytes ?? Number.POSITIVE_INFINITY,
      );
      if (sizeBytes > limitBytes) {
        return err({ code: "import.file-too-large", sizeBytes, limitBytes });
      }

      // Hashing and reading are asynchronous I/O: never inside a unit.
      let fileSha256: string;
      try {
        fileSha256 = await hasher.sha256(file.content);
      } catch (error) {
        return err({ code: "import.file-unreadable", cause: describe(error) });
      }
      if (isAborted(signal)) return err(ABORTED);
      onProgress?.({ phase: "read", processed: 0, total: sizeBytes });
      const text = await files.readText(file.content, format.encoding);
      if (!text.ok) return text;
      if (isAborted(signal)) return err(ABORTED);

      onProgress?.({ phase: "parse", processed: 0, total: sizeBytes });
      const parsed = await format.parse(text.value, { signal });
      if (isAborted(signal)) return err(ABORTED);
      if (!parsed.ok) {
        return err({ code: "import.format-invalid", failure: parsed.error });
      }

      const { records } = parsed.value;
      const errors: ImportErrorEntry[] = [];
      const notices: ImportNotice[] = [];
      const valid: { location: string; value: unknown }[] = [];
      let invalid = 0;
      let ignored = 0;
      for (const [index, record] of records.entries()) {
        if (index % BATCH === 0) {
          if (isAborted(signal)) return err(ABORTED);
          onProgress?.({
            phase: "validate",
            processed: index,
            total: records.length,
          });
        }
        if (record.kind === "ignored") {
          ignored++;
          notices.push({ location: record.location, code: record.code });
          continue;
        }
        const normalized = format.normalize(record.data);
        if (!normalized.ok) {
          invalid++;
          // Keep only what the job can store; the rest is counted.
          for (const issue of normalized.error) {
            if (errors.length > MAX_IMPORT_ERRORS) break;
            errors.push({
              location: record.location,
              ...(issue.field ? { field: issue.field } : {}),
              code: issue.code,
              message: issue.message ?? "",
            });
          }
          continue;
        }
        valid.push({ location: record.location, value: normalized.value });
      }

      const seen = new Set<string>();
      const unique: typeof valid = [];
      for (const candidate of valid) {
        const identity = target.identity(candidate.value as never);
        if (seen.has(identity)) {
          notices.push({
            location: candidate.location,
            code: DUPLICATE_IN_FILE,
          });
          continue;
        }
        seen.add(identity);
        unique.push(candidate);
      }

      if (isAborted(signal)) return err(ABORTED);
      onProgress?.({ phase: "match", processed: 0, total: unique.length });
      const matches = await target.match(
        unique.map((candidate) => candidate.value as never),
      );
      if (!matches.ok) return matches;
      if (matches.value.length !== unique.length) {
        throw new Error("ImportTarget.match must return one match per value");
      }
      const candidates = unique.map((candidate, i) => {
        const match = matches.value[i]!;
        return {
          location: candidate.location,
          value: candidate.value,
          status: match.status,
          ...(match.status === "new" ? {} : { existingId: match.existingId }),
        };
      });

      const previous = await importJobs.findCommittedByFileSha256(fileSha256);
      if (!previous.ok) return previous;
      if (isAborted(signal)) return err(ABORTED);

      const truncated = truncateImportErrors(errors);
      const count = (status: ImportMatch["status"]) =>
        candidates.filter((candidate) => candidate.status === status).length;
      return ok({
        formatId: format.id,
        kind: format.kind,
        fileName: file.name,
        fileSha256,
        ...(format.sourceKey ? { sourceKey: format.sourceKey } : {}),
        ...(parsed.value.datasetVersion
          ? { datasetVersion: parsed.value.datasetVersion }
          : {}),
        startedAt,
        candidates: candidates as ImportCandidate<never>[],
        errors: truncated.errors,
        ...(truncated.errorsTruncated
          ? { errorsTruncated: true as const }
          : {}),
        notices,
        summary: {
          total: records.length,
          valid: valid.length,
          invalid,
          ignored,
          inFileDuplicates: valid.length - unique.length,
          new: count("new"),
          duplicates: count("duplicate"),
          conflicts: count("conflict"),
        },
        previousImports: previous.value,
      });
    },

    async commit<T, E>(
      preview: ImportPreview<T>,
      target: ImportTarget<T, E>,
      { conflicts, signal }: ImportCommitOptions,
    ): Promise<Result<ImportOutcome, ImportError | E>> {
      if (isAborted(signal)) return err(ABORTED);
      const values = preview.candidates.map((candidate) => candidate.value);
      let result: Result<ImportJob, ImportError | E>;
      try {
        result = await unitOfWork.run(
          async (): Promise<Result<ImportJob, ImportError | E>> => {
            // Same reads as the preview, now inside the transaction: the
            // decisions shown to the user must still hold.
            const matches = await target.match(values);
            if (!matches.ok) return matches;
            if (!sameMatches(matches.value, preview.candidates)) {
              return err({ code: "import.preview-stale" });
            }
            const decisions = decide(preview.candidates, conflicts);
            const job = await importJobs.create(
              jobDraft(
                preview,
                "committed",
                committedCounts(preview, decisions),
                preview.errors,
                { conflicts },
              ),
            );
            if (!job.ok) return job;
            for (const { candidate, decision } of decisions) {
              const written = await target.write(candidate.value, decision, {
                importJobId: job.value.id,
                ...(candidate.existingId
                  ? { existingId: candidate.existingId }
                  : {}),
              });
              if (!written.ok) return written;
            }
            return ok(job.value);
          },
        );
      } catch (error) {
        // Rolled back by the unit of work; the exception is a bug.
        await recordFailure(
          preview,
          {
            location: COMMIT_LOCATION,
            code: "import.unexpected-error",
            message: describe(error),
          },
          conflicts,
        );
        throw error;
      }
      if (result.ok)
        return ok({ job: result.value, counts: result.value.counts });
      await recordFailure(
        preview,
        {
          location: COMMIT_LOCATION,
          code: codeOf(result.error),
          message: describe(result.error),
        },
        conflicts,
      );
      return result;
    },

    cancel(preview) {
      return importJobs.create(
        jobDraft(
          preview,
          "cancelled",
          unwrittenCounts(preview),
          preview.errors,
          {},
        ),
      );
    },
  };
}
