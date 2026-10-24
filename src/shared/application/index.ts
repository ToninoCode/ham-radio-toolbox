/*
 * Application ports shared by the feature modules (ARCHITECTURE.md § 5.2):
 * persistence vocabulary and errors, unit of work, system ports, the
 * repositories of shared entities and the contracts of import, backup and
 * storage. No implementation lives here: adapters are in src/infrastructure
 * and are wired in src/app/container.ts.
 */
export type {
  AttachmentRepository,
  NewAttachment,
} from "./attachment-repository";
export { BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from "./backup";
export type {
  BackupEnvelope,
  BackupGateway,
  MigrationError,
  RestoreMode,
  TableRecords,
} from "./backup";
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
export type { ImportCandidate, ImportPreview } from "./import-pipeline";
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
