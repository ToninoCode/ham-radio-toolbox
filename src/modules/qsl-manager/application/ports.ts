import type {
  DeletionReport,
  Draft,
  Patch,
  PersistenceError,
} from "@/shared/application";
import type { Result } from "@/shared/types";
import type {
  QslRecord,
  QslRecordInput,
  QslSubjectType,
} from "../domain/qsl-record";

export type QslRecordDraft = Draft<QslRecordInput>;

/** Changes to a QSL record; the subject (QSO or reception) is fixed. */
export type QslRecordPatch = Omit<
  Patch<QslRecordInput>,
  "subjectType" | "subjectId"
>;

/**
 * QSL records (DATABASE.md `qsl_records`). The subject must exist
 * (`conflict/missing-reference`); at most one record per subject and
 * channel (`conflict/duplicate`, rule `qsl-record.channel-taken`, `key` =
 * existing record). `delete` cascades to the record's attachments.
 *
 * TODO(M10): status transitions, statistics, confirmation matching.
 */
export interface QslRecordRepository {
  get(id: string): Promise<Result<QslRecord, PersistenceError>>;
  listBySubject(
    subjectType: QslSubjectType,
    subjectId: string,
  ): Promise<Result<QslRecord[], PersistenceError>>;
  create(draft: QslRecordDraft): Promise<Result<QslRecord, PersistenceError>>;
  update(
    id: string,
    patch: QslRecordPatch,
  ): Promise<Result<QslRecord, PersistenceError>>;
  delete(id: string): Promise<Result<DeletionReport, PersistenceError>>;
}
