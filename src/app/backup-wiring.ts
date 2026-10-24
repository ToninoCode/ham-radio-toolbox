import type { AppDatabase } from "@/infrastructure/db";
import { DexieBackupGateway } from "@/infrastructure/db/dexie-backup-gateway";
import { createBackupService } from "@/modules/settings-backup/application/backup-service";
import type { BackupLimits } from "@/modules/settings-backup/application/backup-service";
import { jsonBackupCodec } from "@/modules/settings-backup/infrastructure/json-backup-codec";
import type { BackupService } from "@/modules/settings-backup";
import type {
  Clock,
  ContentHasher,
  DataChangeNotifier,
  IdGenerator,
  ImportJobRepository,
  UnitOfWork,
} from "@/shared/application";

/*
 * Wiring of backup and restore, loaded with a dynamic import by the
 * container: the codec, the gateway and the use cases stay out of the
 * initial chunk (NFR-PERF-01, ADR-0015).
 */

export interface BackupWiringDeps {
  readonly database: AppDatabase;
  readonly unitOfWork: UnitOfWork;
  readonly importJobs: ImportJobRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly contentHasher: ContentHasher;
  readonly appVersion: string;
  readonly limits?: Partial<BackupLimits>;
  readonly notifier?: DataChangeNotifier;
}

export function createAppBackupService(deps: BackupWiringDeps): BackupService {
  return createBackupService({
    gateway: new DexieBackupGateway(deps.database),
    codec: jsonBackupCodec,
    unitOfWork: deps.unitOfWork,
    importJobs: deps.importJobs,
    clock: deps.clock,
    ids: deps.ids,
    hasher: deps.contentHasher,
    appVersion: deps.appVersion,
    ...(deps.limits ? { limits: deps.limits } : {}),
    ...(deps.notifier ? { notifier: deps.notifier } : {}),
  });
}
