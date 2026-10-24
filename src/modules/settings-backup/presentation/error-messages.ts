import type { FileSaveError } from "@/shared/application";
import {
  errorMessage,
  formatBytes,
  persistenceMessage,
  technicalDetail,
} from "@/shared/i18n";
import type { BackupError } from "../application/backup-ports";

/** Text of an error: main message and a secondary technical detail. */
export interface ErrorText {
  readonly message: string;
  readonly detail: string;
}

/**
 * Message of a backup, restore, persistence or download error. Messages
 * needing figures receive them formatted (sizes in MiB, ADR-0015).
 */
export function describeError(error: BackupError | FileSaveError): ErrorText {
  const detail = technicalDetail(error);
  switch (error.code) {
    case "backup.too-large":
      return {
        message: errorMessage(error.code, {
          size: formatBytes(error.sizeBytes),
          limit: formatBytes(error.limitBytes),
        }),
        detail,
      };
    case "backup.export-too-large":
      return {
        message: errorMessage(error.code, {
          limit: formatBytes(error.limitBytes),
        }),
        detail,
      };
    case "backup.source-invalid":
      return {
        message: errorMessage(error.code, { count: error.invalidCount }),
        detail,
      };
    case "persistence.not-found":
    case "persistence.invalid-input":
    case "persistence.conflict":
    case "persistence.transaction-failed":
    case "persistence.quota-exceeded":
    case "persistence.unavailable":
      return { message: persistenceMessage(error), detail };
    default:
      return { message: errorMessage(error.code), detail };
  }
}
