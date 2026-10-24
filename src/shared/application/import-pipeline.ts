import type {
  ImportCounts,
  ImportErrorEntry,
  ImportJob,
  ImportJobKind,
} from "@/core/import-job";
import type { UtcDateTime } from "@/core/time";
import type { DomainError, Result } from "@/shared/types";
import type { AbortedError } from "./operation";
import type { PersistenceError } from "./persistence-error";

/*
 * Contract of the generic import flow (FR-GEN-03, DATABASE.md § 8):
 * read → identify the format → parse → normalise and validate → detect
 * duplicates and conflicts → preview → explicit commit (or cancel).
 *
 * - Everything up to the preview runs outside any transaction and writes
 *   nothing (file reads, hashing, parsing, possibly in a worker).
 * - The commit is one `UnitOfWork.run`: it checks that the stored data still
 *   matches the preview, writes the `import_jobs` row (`committed`) and the
 *   records through the module repositories. If it fails, everything is
 *   rolled back and a `failed` job is written on its own.
 * - Cancelling writes only a `cancelled` job.
 *
 * Format-specific parsers and targets arrive with their milestones (ADIF in
 * M3, EiBi/HFCC in M5, …); this file only defines what they implement.
 */

/** A file chosen by the user. */
export interface ImportFile {
  readonly name: string;
  readonly content: Blob;
}

/** Text encodings of the supported formats (EiBi's is checked in M5). */
export type TextEncodingName = "utf-8" | "windows-1252";

export type ImportFileError =
  | (DomainError<"import.file-unreadable"> & { readonly cause: string })
  | DomainError<"import.encoding-invalid">;

/** Reading of import files (adapter on the Blob/File API). */
export interface ImportFileReader {
  /** First `maxBytes` bytes, decoded leniently, to identify the format. */
  readHead(
    file: Blob,
    maxBytes: number,
  ): Promise<Result<string, ImportFileError>>;
  /** Whole content; invalid UTF-8 is an error, never replaced silently. */
  readText(
    file: Blob,
    encoding: TextEncodingName,
  ): Promise<Result<string, ImportFileError>>;
}

/** Problem in one field of one record (normalisation or validation). */
export interface ImportIssue {
  readonly field?: string;
  /** Stable code: domain code or `zod.<code>` (`issueCode()`). */
  readonly code: string;
  /** Technical detail for diagnostics, never UI text. */
  readonly message?: string;
}

/** One unit found by the parser, with its position in the file. */
export type ParsedRecord =
  | {
      readonly kind: "record";
      /** `record 12`, `line 340`… */
      readonly location: string;
      readonly data: unknown;
    }
  | {
      /** Not an error: e.g. a comment or a record type the format skips. */
      readonly kind: "ignored";
      readonly location: string;
      readonly code: string;
    };

export interface ParsedImport {
  readonly records: readonly ParsedRecord[];
  /** Dataset version found in the file (e.g. season `A26`). */
  readonly datasetVersion?: string;
}

/** The file as a whole cannot be read by the format (stable `code`). */
export type ImportFormatFailure = DomainError<string> & {
  readonly location?: string;
  readonly message?: string;
};

/** A file format: identification, parsing and per-record validation. */
export interface ImportFormat<T> {
  /** Stable identifier, recorded in the job options (`adif`, `eibi-csv`…). */
  readonly id: string;
  readonly kind: ImportJobKind;
  readonly sourceKey?: string;
  /** Size limit of the format (DATABASE.md § 8). */
  readonly maxBytes: number;
  readonly encoding: TextEncodingName;
  /** Whether this format reads the file, from its name and first characters. */
  matches(
    file: { readonly name: string; readonly sizeBytes: number },
    head: string,
  ): boolean;
  /** Splits the text into records. Pure: no writes, no network. */
  parse(
    text: string,
    context: { readonly signal?: AbortSignal },
  ):
    | Result<ParsedImport, ImportFormatFailure>
    | Promise<Result<ParsedImport, ImportFormatFailure>>;
  /** Normalises one record with the core domain and its Zod schema. */
  normalize(data: unknown): Result<T, readonly ImportIssue[]>;
}

/** How a valid record relates to the stored data. */
export type ImportMatch =
  | { readonly status: "new" }
  /** Same identity and same content: nothing to write. */
  | { readonly status: "duplicate"; readonly existingId: string }
  /** Same identity, different content: the commit policy decides. */
  | { readonly status: "conflict"; readonly existingId: string };

export type ImportWriteDecision = "insert" | "replace";

/**
 * Persistence side of an import, implemented by the module that owns the
 * records with its repositories. `match` only reads; at commit time it runs
 * again inside the unit of work, so it must await repository calls only.
 */
export interface ImportTarget<T, E = never> {
  /** Identity used for duplicates within the file and against the database. */
  identity(value: T): string;
  /** One match per value, in the same order. */
  match(
    values: readonly T[],
  ): Promise<Result<readonly ImportMatch[], PersistenceError>>;
  /** Writes one record inside the commit's unit of work. */
  write(
    value: T,
    decision: ImportWriteDecision,
    context: { readonly importJobId: string; readonly existingId?: string },
  ): Promise<Result<void, PersistenceError | E>>;
}

/** A valid record of the preview. */
export interface ImportCandidate<T> {
  readonly location: string;
  readonly value: T;
  readonly status: ImportMatch["status"];
  /** Stored record it duplicates or conflicts with. */
  readonly existingId?: string;
}

/** Record that will not be written although it is not an error. */
export interface ImportNotice {
  readonly location: string;
  /** Format code, or `import.duplicate-in-file` for repeated records. */
  readonly code: string;
}

/**
 * Counts of the preview. `total = valid + invalid + ignored`;
 * `valid = new + duplicates + conflicts + inFileDuplicates`.
 */
export interface ImportSummary {
  readonly total: number;
  readonly valid: number;
  readonly invalid: number;
  readonly ignored: number;
  readonly inFileDuplicates: number;
  readonly new: number;
  readonly duplicates: number;
  readonly conflicts: number;
}

/** Result of the preview: what the commit would write. */
export interface ImportPreview<T> {
  readonly formatId: string;
  readonly kind: ImportJobKind;
  readonly fileName: string;
  readonly fileSha256: string;
  readonly sourceKey?: string;
  readonly datasetVersion?: string;
  readonly startedAt: UtcDateTime;
  readonly candidates: readonly ImportCandidate<T>[];
  /** Issues of the invalid records, the first 500 (`MAX_IMPORT_ERRORS`). */
  readonly errors: readonly ImportErrorEntry[];
  readonly errorsTruncated?: true;
  readonly notices: readonly ImportNotice[];
  readonly summary: ImportSummary;
  /** Committed jobs of a file with the same SHA-256 (re-import warning). */
  readonly previousImports: readonly ImportJob[];
}

/** What to do with records that conflict with stored ones. */
export type ConflictPolicy = "skip" | "replace";

export interface ImportProgress {
  readonly phase: "read" | "parse" | "validate" | "match";
  readonly processed: number;
  readonly total: number;
}

export interface ImportPreviewOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ImportProgress) => void;
}

export interface ImportCommitOptions {
  readonly conflicts: ConflictPolicy;
  readonly signal?: AbortSignal;
}

export interface ImportOutcome {
  readonly job: ImportJob;
  readonly counts: ImportCounts;
}

export type ImportError =
  | DomainError<"import.file-empty">
  | (DomainError<"import.file-too-large"> & {
      readonly sizeBytes: number;
      readonly limitBytes: number;
    })
  | DomainError<"import.format-unknown">
  | (DomainError<"import.format-invalid"> & {
      readonly failure: ImportFormatFailure;
    })
  /** The stored data changed after the preview: preview again. */
  | DomainError<"import.preview-stale">
  | ImportFileError
  | AbortedError
  | PersistenceError;

/** Use cases of the generic import (implemented by `createImportPipeline`). */
export interface ImportPipeline {
  preview<T>(
    file: ImportFile,
    formats: readonly ImportFormat<T>[],
    target: ImportTarget<T, unknown>,
    options?: ImportPreviewOptions,
  ): Promise<Result<ImportPreview<T>, ImportError>>;
  commit<T, E>(
    preview: ImportPreview<T>,
    target: ImportTarget<T, E>,
    options: ImportCommitOptions,
  ): Promise<Result<ImportOutcome, ImportError | E>>;
  cancel<T>(
    preview: ImportPreview<T>,
  ): Promise<Result<ImportJob, PersistenceError>>;
}
