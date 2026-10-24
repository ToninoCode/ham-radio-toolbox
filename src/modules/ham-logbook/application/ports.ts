import type {
  DeletionReport,
  Draft,
  Patch,
  PersistenceError,
} from "@/shared/application";
import type { Result } from "@/shared/types";
import type { QsoLog, QsoLogInput } from "../domain/qso-log";

export type QsoLogDraft = Draft<QsoLogInput>;
export type QsoLogPatch = Patch<QsoLogInput>;

/**
 * Persistence of QSO (DATABASE.md `qso_logs`). The station profile must
 * exist (`conflict/missing-reference`). `delete` cascades, in the same
 * transaction, to the QSL records of the QSO, their attachments and the
 * attachments of the QSO (DATABASE.md § 6).
 *
 * TODO(M3): queries for list, search, filters and statistics; bulk insert
 * for the ADIF import (Block C contract).
 */
export interface QsoLogRepository {
  get(id: string): Promise<Result<QsoLog, PersistenceError>>;
  count(): Promise<Result<number, PersistenceError>>;
  create(draft: QsoLogDraft): Promise<Result<QsoLog, PersistenceError>>;
  update(
    id: string,
    patch: QsoLogPatch,
  ): Promise<Result<QsoLog, PersistenceError>>;
  delete(id: string): Promise<Result<DeletionReport, PersistenceError>>;
}
