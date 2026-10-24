import { inject, type InjectionKey } from "vue";
import { webCryptoContentHasher } from "@/infrastructure/files/web-crypto-content-hasher";
import {
  AppDatabase,
  DexieUnitOfWork,
  type AppDatabaseOptions,
} from "@/infrastructure/db";
import {
  DexieAttachmentRepository,
  DexieDataSourceRepository,
  DexieImportJobRepository,
} from "@/infrastructure/db/repositories";
import { cryptoIdGenerator } from "@/infrastructure/system/crypto-id-generator";
import { systemClock } from "@/infrastructure/system/system-clock";
import { DexieQsoLogRepository } from "@/modules/ham-logbook/infrastructure/dexie-qso-log-repository";
import type { QsoLogRepository } from "@/modules/ham-logbook";
import { DexieQslRecordRepository } from "@/modules/qsl-manager/infrastructure/dexie-qsl-record-repository";
import type { QslRecordRepository } from "@/modules/qsl-manager";
import { DexieSettingsRepository } from "@/modules/settings-backup/infrastructure/dexie-settings-repository";
import { DexieStationProfileRepository } from "@/modules/settings-backup/infrastructure/dexie-station-profile-repository";
import type {
  SettingsRepository,
  StationProfileRepository,
} from "@/modules/settings-backup";
import { DexieSwlReceptionRepository } from "@/modules/swl-logbook/infrastructure/dexie-swl-reception-repository";
import type { SwlReceptionRepository } from "@/modules/swl-logbook";
import type {
  AttachmentRepository,
  Clock,
  ContentHasher,
  DataSourceRepository,
  DatabaseLifecycle,
  IdGenerator,
  ImportJobRepository,
  PersistenceError,
  UnitOfWork,
} from "@/shared/application";
import type { Result } from "@/shared/types";

/*
 * Composition root (ARCHITECTURE.md § 5.3, ADR-0004): the only place that
 * knows the concrete adapters. Use cases and Pinia stores receive the ports
 * from the container; tests build their own container (or a fake one).
 */

export interface AppRepositories {
  readonly stationProfiles: StationProfileRepository;
  readonly settings: SettingsRepository;
  readonly qsoLogs: QsoLogRepository;
  readonly swlReceptions: SwlReceptionRepository;
  readonly qslRecords: QslRecordRepository;
  readonly attachments: AttachmentRepository;
  readonly dataSources: DataSourceRepository;
  readonly importJobs: ImportJobRepository;
}

export interface AppContainer {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly contentHasher: ContentHasher;
  readonly unitOfWork: UnitOfWork;
  readonly databaseLifecycle: DatabaseLifecycle;
  readonly repositories: AppRepositories;
  /** Opens the database and reports why it cannot be used, if so. */
  connect(): Promise<Result<void, PersistenceError>>;
  /** Closes the database connection. */
  dispose(): void;
}

export interface ContainerOptions {
  readonly database?: AppDatabaseOptions;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly contentHasher?: ContentHasher;
}

/**
 * Creates the database adapter (not opened yet: Dexie opens it on the
 * first operation or on `connect()`) and every repository on top of it.
 */
export function createContainer(options: ContainerOptions = {}): AppContainer {
  const database = new AppDatabase(options.database);
  const clock = options.clock ?? systemClock;
  const ids = options.ids ?? cryptoIdGenerator;
  const deps = { clock, ids };

  return {
    clock,
    ids,
    contentHasher: options.contentHasher ?? webCryptoContentHasher,
    unitOfWork: new DexieUnitOfWork(database),
    databaseLifecycle: database,
    repositories: {
      stationProfiles: new DexieStationProfileRepository(database, deps),
      settings: new DexieSettingsRepository(database, deps),
      qsoLogs: new DexieQsoLogRepository(database, deps),
      swlReceptions: new DexieSwlReceptionRepository(database, deps),
      qslRecords: new DexieQslRecordRepository(database, deps),
      attachments: new DexieAttachmentRepository(database, deps),
      dataSources: new DexieDataSourceRepository(database),
      importJobs: new DexieImportJobRepository(database, deps),
    },
    connect: () => database.connect(),
    dispose: () => database.close(),
  };
}

export const APP_CONTAINER_KEY: InjectionKey<AppContainer> =
  Symbol("app-container");

/** The container provided by main.ts (or by a test). */
export function useContainer(): AppContainer {
  const container = inject(APP_CONTAINER_KEY);
  if (!container) throw new Error("App container not provided");
  return container;
}
