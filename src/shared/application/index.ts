/*
 * Application ports shared by the feature modules (ARCHITECTURE.md § 5.2):
 * persistence vocabulary and errors, unit of work, system ports, the
 * repositories of shared entities and the contracts of import, backup and
 * storage, plus the one shared use case, the generic import pipeline
 * (BL-M2-07). Adapters are in src/infrastructure and are wired in
 * src/app/container.ts.
 */
export type {
  AttachmentRepository,
  NewAttachment,
} from "./attachment-repository";
export type {
  BackupGateway,
  BackupRecordSink,
  DatabaseSnapshotInfo,
  LocalDataState,
  MigrationError,
  RestoreMode,
  RestoreWritePlan,
  StoredRecord,
  TableCounts,
  TableRecords,
} from "./backup";
export { createImportPipeline } from "./create-import-pipeline";
export type { ImportPipelineDeps } from "./create-import-pipeline";
export type {
  DatabaseLifecycle,
  DatabaseLifecycleEvent,
} from "./database-lifecycle";
export type {
  DataSourceInput,
  DataSourceRepository,
} from "./data-source-repository";
export type {
  ImportJobDraft,
  ImportJobRepository,
} from "./import-job-repository";
export type {
  ConflictPolicy,
  ImportCandidate,
  ImportCommitOptions,
  ImportError,
  ImportFile,
  ImportFileError,
  ImportFileReader,
  ImportFormat,
  ImportFormatFailure,
  ImportIssue,
  ImportMatch,
  ImportNotice,
  ImportOutcome,
  ImportPipeline,
  ImportPreview,
  ImportPreviewOptions,
  ImportProgress,
  ImportSummary,
  ImportTarget,
  ImportWriteDecision,
  ParsedImport,
  ParsedRecord,
  TextEncodingName,
} from "./import-pipeline";
export { ABORTED, isAborted } from "./operation";
export type { AbortedError } from "./operation";
export {
  conflict,
  invalidInput,
  notFound,
  validationIssues,
} from "./persistence-error";
export type {
  ConflictReason,
  PersistenceError,
  PersistenceErrorCode,
  UnavailableReason,
  ValidationIssue,
} from "./persistence-error";
export type {
  DeletionReport,
  Draft,
  GeneratedField,
  Patch,
} from "./repository";
export type { StorageEstimate, StorageInfo } from "./storage-info";
export type { Clock, ContentHasher, IdGenerator } from "./system-ports";
export { TABLE_NAMES } from "./tables";
export type { TableName } from "./tables";
export type { UnitOfWork } from "./unit-of-work";
