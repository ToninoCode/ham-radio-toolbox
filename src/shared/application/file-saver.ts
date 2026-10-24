import type { DomainError, Result } from "@/shared/types";

/** The browser refused to hand the file to the user (`cause`: diagnostics). */
export type FileSaveError = DomainError<"file.save-failed"> & {
  readonly cause: string;
};

/**
 * Hands a generated file to the user (ARCHITECTURE.md § 5.2, `FileSaver`):
 * v1 adapter = download of a Blob URL. The file never goes through the
 * service worker or the Cache Storage.
 */
export interface FileSaver {
  save(file: {
    readonly blob: Blob;
    readonly fileName: string;
  }): Result<void, FileSaveError>;
}
