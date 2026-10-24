import { describe, expect, it } from "vitest";
import type { BackupError } from "@/modules/settings-backup";
import type {
  FileSaveError,
  ImportError,
  PersistenceErrorCode,
  UnavailableReason,
} from "@/shared/application";
import {
  errorKey,
  errorMessage,
  hasErrorMessage,
  hasIssueMessage,
  hasRuleMessage,
  issueMessage,
  persistenceMessage,
  reportMessage,
  technicalDetail,
} from "@/shared/i18n";

/*
 * Every stable code the use cases can return has an Italian message
 * (Q-M2-09, Q-M2-12). The `satisfies` clauses make the lists complete at
 * compile time: a new code in a union breaks the typecheck until it is
 * listed here, and the test then requires its message.
 */

const BACKUP_CODES = Object.keys({
  "backup.empty": true,
  "backup.too-large": true,
  "backup.read-failed": true,
  "backup.encoding-invalid": true,
  "backup.not-a-backup": true,
  "backup.json-invalid": true,
  "backup.unknown-field": true,
  "backup.layout-invalid": true,
  "backup.truncated": true,
  "backup.format-version-unsupported": true,
  "backup.manifest-invalid": true,
  "backup.table-duplicate": true,
  "backup.record-too-large": true,
  "backup.integrity-missing": true,
  "backup.integrity-invalid": true,
  "backup.checksum-mismatch": true,
  "operation.aborted": true,
  "backup.schema-newer": true,
  "backup.migration-unavailable": true,
  "backup.unknown-table": true,
  "backup.table-missing": true,
  "backup.attachments-mismatch": true,
  "backup.count-mismatch": true,
  "backup.has-errors": true,
  "backup.preview-stale": true,
  "backup.verification-failed": true,
  "backup.export-too-large": true,
  "backup.source-invalid": true,
  "backup.export-unverified": true,
  "backup.unexpected-error": true,
  "persistence.not-found": true,
  "persistence.invalid-input": true,
  "persistence.conflict": true,
  "persistence.transaction-failed": true,
  "persistence.quota-exceeded": true,
  "persistence.unavailable": true,
} satisfies Record<BackupError["code"], true>);

const IMPORT_CODES = Object.keys({
  "import.file-empty": true,
  "import.file-too-large": true,
  "import.format-unknown": true,
  "import.format-invalid": true,
  "import.preview-stale": true,
  "import.file-unreadable": true,
  "import.encoding-invalid": true,
  "operation.aborted": true,
  "persistence.not-found": true,
  "persistence.invalid-input": true,
  "persistence.conflict": true,
  "persistence.transaction-failed": true,
  "persistence.quota-exceeded": true,
  "persistence.unavailable": true,
} satisfies Record<ImportError["code"], true>);

/** Codes written in import_jobs.errors by the pipeline and the restore. */
const JOB_ERROR_CODES = [
  "import.duplicate-in-file",
  "import.commit-failed",
  "import.unexpected-error",
  "backup.restore-failed",
];

const OTHER_CODES = Object.keys({
  "file.save-failed": true,
} satisfies Record<FileSaveError["code"], true>);

const PERSISTENCE_CODES = Object.keys({
  "persistence.not-found": true,
  "persistence.invalid-input": true,
  "persistence.conflict": true,
  "persistence.transaction-failed": true,
  "persistence.quota-exceeded": true,
  "persistence.unavailable": true,
} satisfies Record<PersistenceErrorCode, true>);

const UNAVAILABLE_REASONS = Object.keys({
  "missing-api": true,
  "open-failed": true,
  "newer-version": true,
  "upgrade-failed": true,
  closed: true,
} satisfies Record<UnavailableReason, true>) as UnavailableReason[];

/** Conflict rules of the repositories (DATABASE.md § 6). */
const RULES = [
  "unique-key",
  "station-profile.referenced",
  "station-profile.last",
  "qso.station-profile-missing",
  "swl.station-profile-missing",
  "reception-details.category-mismatch",
  "qsl-record.subject-missing",
  "qsl-record.channel-taken",
  "attachment.owner-missing",
  "attachment.owner-type-unavailable",
  "attachment.same-content",
];

/** Issue codes of the schemas and of the backup analysis. */
const ISSUES = [
  "text.empty",
  "number.invalid",
  "callsign.empty",
  "callsign.invalid-characters",
  "callsign.too-long",
  "callsign.invalid-format",
  "locator.invalid-format",
  "station-profile.callsign-required",
  "station-profile.default-invalid",
  "fields.incomplete-group",
  "timestamps.updated-before-created",
  "catalog-key.invalid",
  "sha256.invalid",
  "frequency.negative",
  "frequency.not-integer",
  "frequency.too-large",
  "time.missing-offset",
  "time.invalid-format",
  "coordinates.latitude-out-of-range",
  "dashboard.favorite-repeated",
  "attachment.content-invalid",
  "attachment.content-missing",
  "attachment.sha256-mismatch",
  "attachment.size-mismatch",
  "attachment.too-large",
  "attachment.owner-missing",
  "attachment.owner-skipped",
  "attachment.same-content",
  "backup.table-name",
  "backup.record-not-object",
  "backup.duplicate-id",
  "qso.station-profile-missing",
  "qso.frequency-zero",
  "qso.off-before-on",
  "swl.station-profile-missing",
  "swl.frequency-zero",
  "swl.end-before-start",
  "reception-details.category-mismatch",
  "reception-details.duplicate",
  "reception-details.reception-missing",
  "qsl-record.subject-missing",
  "qsl-record.channel-taken",
  "qsl-record.subject-changed",
  "import-job.finished-before-started",
  "zod.invalid_type",
  "zod.too_small",
  "zod.too_big",
  "zod.invalid_value",
  "zod.invalid_format",
  "zod.unrecognized_keys",
];

describe("messages of the stable codes", () => {
  it.each([
    ...BACKUP_CODES,
    ...IMPORT_CODES,
    ...JOB_ERROR_CODES,
    ...OTHER_CODES,
  ])("error %s has a message", (code) => {
    expect(hasErrorMessage(code), errorKey(code)).toBe(true);
    expect(errorMessage(code)).not.toContain(code);
  });

  it.each(UNAVAILABLE_REASONS)(
    "unavailable reason %s has a message",
    (reason) => {
      const message = persistenceMessage({
        code: "persistence.unavailable",
        reason,
      });
      expect(message).not.toBe(errorMessage("persistence.unavailable"));
    },
  );

  it.each(RULES)("rule %s has a message", (rule) => {
    expect(hasRuleMessage(rule)).toBe(true);
  });

  it.each(ISSUES)("issue %s has a message", (code) => {
    expect(hasIssueMessage(code)).toBe(true);
  });

  it("falls back to generic messages for unknown codes", () => {
    expect(errorMessage("backup.from-the-future")).toBe(
      "Si è verificato un errore imprevisto.",
    );
    expect(issueMessage("nothing.known")).toBe("Valore non valido.");
    expect(reportMessage("nothing.known")).toBe("Valore non valido.");
  });

  it("keeps the code as a secondary technical detail only", () => {
    expect(
      technicalDetail({
        code: "persistence.conflict",
        rule: "station-profile.last",
      }),
    ).toBe("Dettaglio tecnico: persistence.conflict (station-profile.last)");
    expect(PERSISTENCE_CODES.every((code) => hasErrorMessage(code))).toBe(true);
  });
});
