import { inject, type InjectionKey } from "vue";
import { createBrowserFileSaver } from "@/infrastructure/files/browser-file-saver";
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
import { createBroadcastDataChangeNotifier } from "@/infrastructure/system/broadcast-data-change-notifier";
import { cryptoIdGenerator } from "@/infrastructure/system/crypto-id-generator";
import { createNavigatorStorageInfo } from "@/infrastructure/system/navigator-storage-info";
import { systemClock } from "@/infrastructure/system/system-clock";
import { DexieQsoLogRepository } from "@/modules/ham-logbook/infrastructure/dexie-qso-log-repository";
import type { QsoLogRepository } from "@/modules/ham-logbook";
import { DexieQslRecordRepository } from "@/modules/qsl-manager/infrastructure/dexie-qsl-record-repository";
import type { QslRecordRepository } from "@/modules/qsl-manager";
import { DexieSettingsRepository } from "@/modules/settings-backup/infrastructure/dexie-settings-repository";
import { DexieStationProfileRepository } from "@/modules/settings-backup/infrastructure/dexie-station-profile-repository";
import {
  createPreferencesService,
  createStationProfileService,
  createStorageService,
  type PreferencesService,
  type SettingsRepository,
  type SettingsServices,
  type StationProfileRepository,
  type StationProfileService,
  type StorageService,
} from "@/modules/settings-backup";
import { DexieSwlReceptionRepository } from "@/modules/swl-logbook/infrastructure/dexie-swl-reception-repository";
import type { SwlReceptionRepository } from "@/modules/swl-logbook";
import type { BackupService } from "@/modules/settings-backup";
import type { BackupLimits } from "@/modules/settings-backup/application/backup-service";
import type {
  AttachmentRepository,
  Clock,
  ContentHasher,
  DataChangeNotifier,
  DataSourceRepository,
  DatabaseConnection,
  DatabaseLifecycle,
  FileSaver,
  IdGenerator,
  ImportJobRepository,
  PersistenceError,
  StorageInfo,
  UnitOfWork,
} from "@/shared/application";
import { silentDataChangeNotifier } from "@/shared/application";
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

/** Use cases available at startup (the backup ones are loaded lazily). */
export interface AppServices {
  readonly preferences: PreferencesService;
  readonly stationProfiles: StationProfileService;
  readonly storage: StorageService;
}

export interface AppContainer {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly contentHasher: ContentHasher;
  readonly unitOfWork: UnitOfWork;
  readonly databaseLifecycle: DatabaseLifecycle;
  readonly database: DatabaseConnection;
  readonly storageInfo: StorageInfo;
  readonly dataChanges: DataChangeNotifier;
  readonly fileSaver: FileSaver;
  readonly repositories: AppRepositories;
  readonly services: AppServices;
  /**
   * Backup and restore use cases, loaded on first use (separate chunk,
   * ADR-0015); later calls return the same instance.
   */
  loadBackupService(): Promise<BackupService>;
  // TODO(M3): expose the generic import pipeline (createImportPipeline with
  // blobImportFileReader) together with the first importer (ADIF, BL-M3-04);
  // no module imports files before then.
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
  readonly storageInfo?: StorageInfo;
  /** Notifications between tabs (tests: `silentDataChangeNotifier`). */
  readonly dataChanges?: DataChangeNotifier;
  readonly fileSaver?: FileSaver;
  /** Backup limits (tests use small ones). */
  readonly backupLimits?: Partial<BackupLimits>;
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
  const contentHasher = options.contentHasher ?? webCryptoContentHasher;
  const unitOfWork = new DexieUnitOfWork(database);
  const importJobs = new DexieImportJobRepository(database, deps);
  const storageInfo = options.storageInfo ?? createNavigatorStorageInfo();
  const ownChannel = options.dataChanges
    ? undefined
    : createBroadcastDataChangeNotifier();
  const dataChanges: DataChangeNotifier =
    ownChannel ?? options.dataChanges ?? silentDataChangeNotifier;
  const fileSaver = options.fileSaver ?? createBrowserFileSaver();
  const stationProfiles = new DexieStationProfileRepository(database, deps);
  const settings = new DexieSettingsRepository(database, deps);
  let backupService: Promise<BackupService> | undefined;

  return {
    clock,
    ids,
    contentHasher,
    unitOfWork,
    databaseLifecycle: database,
    database,
    storageInfo,
    dataChanges,
    fileSaver,
    repositories: {
      stationProfiles,
      settings,
      qsoLogs: new DexieQsoLogRepository(database, deps),
      swlReceptions: new DexieSwlReceptionRepository(database, deps),
      qslRecords: new DexieQslRecordRepository(database, deps),
      attachments: new DexieAttachmentRepository(database, deps),
      dataSources: new DexieDataSourceRepository(database),
      importJobs,
    },
    services: {
      preferences: createPreferencesService({
        settings,
        notifier: dataChanges,
      }),
      stationProfiles: createStationProfileService({
        profiles: stationProfiles,
        notifier: dataChanges,
      }),
      storage: createStorageService({ storage: storageInfo, database }),
    },
    loadBackupService() {
      backupService ??= import("./backup-wiring").then((wiring) =>
        wiring.createAppBackupService({
          database,
          unitOfWork,
          importJobs,
          clock,
          ids,
          contentHasher,
          appVersion: __APP_VERSION__,
          notifier: dataChanges,
          ...(options.backupLimits ? { limits: options.backupLimits } : {}),
        }),
      );
      return backupService;
    },
    connect: () => database.connect(),
    dispose: () => {
      ownChannel?.close();
      database.close();
    },
  };
}

/** Services of the settings-backup presentation, from the container. */
export function settingsServicesOf(container: AppContainer): SettingsServices {
  return {
    ...container.services,
    dataChanges: container.dataChanges,
    fileSaver: container.fileSaver,
    loadBackupService: () => container.loadBackupService(),
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
