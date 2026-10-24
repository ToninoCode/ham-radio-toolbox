import Dexie, { type EntityTable } from "dexie";
import type { Attachment } from "@/core/attachment";
import type { DataSource } from "@/core/data-source";
import type { ImportJob } from "@/core/import-job";
import type { QsoLog } from "@/modules/ham-logbook";
import type { QslRecord } from "@/modules/qsl-manager";
import type { SettingRecord, StationProfile } from "@/modules/settings-backup";
import type { ReceptionDetails, SwlReception } from "@/modules/swl-logbook";
import type {
  DatabaseLifecycle,
  DatabaseLifecycleEvent,
  PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import { toPersistenceError } from "./errors";
import { SCHEMA_VERSIONS, applySchemaVersions } from "./schema";

/** Name of the application's IndexedDB database. */
export const DATABASE_NAME = "ham-radio-toolbox";

export interface AppDatabaseOptions {
  /** Database name; tests use a unique name per case. */
  readonly name?: string;
  /** IndexedDB implementation (tests: an isolated fake-indexeddb factory). */
  readonly indexedDB?: IDBFactory;
  readonly IDBKeyRange?: typeof IDBKeyRange;
}

/**
 * The application's IndexedDB database (ARCHITECTURE.md § 9): one instance
 * per app, tables of DATABASE.md § 3 typed with the entity schemas
 * (`EntityTable`, ADR-0006). Only infrastructure code uses it.
 *
 * Lifecycle (Q-M2-03): when another tab opens a newer schema the connection
 * is closed (operations then fail with `persistence.unavailable/closed`)
 * and `version-change` is notified so that the UI asks for a reload;
 * `blocked` is notified when this tab's upgrade waits for another tab.
 */
export class AppDatabase extends Dexie implements DatabaseLifecycle {
  declare readonly station_profiles: EntityTable<StationProfile, "id">;
  declare readonly qso_logs: EntityTable<QsoLog, "id">;
  declare readonly swl_receptions: EntityTable<SwlReception, "id">;
  declare readonly reception_details: EntityTable<ReceptionDetails, "id">;
  declare readonly qsl_records: EntityTable<QslRecord, "id">;
  declare readonly attachments: EntityTable<Attachment, "id">;
  declare readonly settings: EntityTable<SettingRecord, "key">;
  declare readonly data_sources: EntityTable<DataSource, "key">;
  declare readonly import_jobs: EntityTable<ImportJob, "id">;

  readonly #listeners = new Set<(event: DatabaseLifecycleEvent) => void>();

  constructor(options: AppDatabaseOptions = {}) {
    // Dexie replaces its defaults with every key passed, even `undefined`.
    super(options.name ?? DATABASE_NAME, {
      ...(options.indexedDB ? { indexedDB: options.indexedDB } : {}),
      ...(options.IDBKeyRange ? { IDBKeyRange: options.IDBKeyRange } : {}),
    });
    applySchemaVersions(this, SCHEMA_VERSIONS);

    // Dexie 4 opens a database whose stored version is newer than the
    // declared one. This app refuses it (ADR-0014): writing records of an
    // older schema into migrated data would corrupt it. IndexedDB versions
    // are Dexie versions × 10. Sticky: checked at every (re)open.
    this.on(
      "ready",
      () => {
        const stored = Math.floor(this.backendDB().version / 10);
        if (stored > this.verno) {
          throw new Dexie.VersionError(
            `Stored schema v${stored} is newer than v${this.verno} of this app`,
          );
        }
      },
      true,
    );

    this.on("versionchange", () => {
      // Close without automatic reopening: this tab's schema is outdated.
      this.close({ disableAutoOpen: true });
      this.#emit({ type: "version-change" });
      return false;
    });
    this.on("blocked", () => this.#emit({ type: "blocked" }));
  }

  subscribe(listener: (event: DatabaseLifecycleEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Opens the database (running pending upgrades) and reports why it
   * cannot be used. Any failure while opening leaves the database at its
   * previous version; an unclassified one comes from an upgrade step.
   */
  async connect(): Promise<Result<void, PersistenceError>> {
    try {
      await this.open();
      return ok(undefined);
    } catch (error) {
      const name =
        error instanceof Error ? error.name : String(error ?? "unknown");
      return err(
        toPersistenceError(error) ?? {
          code: "persistence.unavailable",
          reason: "upgrade-failed",
          cause: name,
        },
      );
    }
  }

  #emit(event: DatabaseLifecycleEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
