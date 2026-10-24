import {
  SCOPES,
  changedEntity,
  deleteAttachmentsOf,
  deleteQslRecordsOf,
  guard,
  newEntity,
  recordExists,
  type AppDatabase,
  type RepositoryDeps,
} from "@/infrastructure/db";
import {
  conflict,
  notFound,
  type DeletionReport,
  type PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type {
  QsoLogDraft,
  QsoLogPatch,
  QsoLogRepository,
} from "../application/ports";
import { qsoLogSchema, type QsoLog } from "../domain/qso-log";

const TABLE = "qso_logs";

/** Dexie adapter of QsoLogRepository (rules in the port). */
export class DexieQsoLogRepository implements QsoLogRepository {
  readonly #db: AppDatabase;
  readonly #deps: RepositoryDeps;

  constructor(db: AppDatabase, deps: RepositoryDeps) {
    this.#db = db;
    this.#deps = deps;
  }

  get(id: string): Promise<Result<QsoLog, PersistenceError>> {
    return guard(TABLE, async () => {
      const qso = await this.#db.qso_logs.get(id);
      return qso ? ok(qso) : err(notFound(TABLE, id));
    });
  }

  count(): Promise<Result<number, PersistenceError>> {
    return guard(TABLE, async () => ok(await this.#db.qso_logs.count()));
  }

  create(draft: QsoLogDraft): Promise<Result<QsoLog, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = newEntity(TABLE, qsoLogSchema, draft, this.#deps);
      if (!parsed.ok) return parsed;
      const qso = parsed.value;
      return this.#db.transaction("rw", SCOPES.qsoWrite, async () => {
        const missing = await this.#missingProfile(qso.stationProfileId);
        if (missing) return err(missing);
        await this.#db.qso_logs.add(qso);
        return ok(qso);
      });
    });
  }

  update(
    id: string,
    patch: QsoLogPatch,
  ): Promise<Result<QsoLog, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.qsoWrite, async () => {
        const existing = await this.#db.qso_logs.get(id);
        if (!existing) return err(notFound(TABLE, id));
        const parsed = changedEntity(
          TABLE,
          qsoLogSchema,
          existing,
          patch,
          this.#deps,
        );
        if (!parsed.ok) return parsed;
        const qso = parsed.value;
        if (qso.stationProfileId !== existing.stationProfileId) {
          const missing = await this.#missingProfile(qso.stationProfileId);
          if (missing) return err(missing);
        }
        await this.#db.qso_logs.put(qso);
        return ok(qso);
      }),
    );
  }

  delete(id: string): Promise<Result<DeletionReport, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.qsoDelete, async () => {
        if (!(await this.#db.qso_logs.get(id))) {
          return err(notFound(TABLE, id));
        }
        const qsl = await deleteQslRecordsOf(this.#db, "qso", id);
        const attachments = await deleteAttachmentsOf(this.#db, "qso", [id]);
        await this.#db.qso_logs.delete(id);
        return ok({
          qso_logs: 1,
          qsl_records: qsl.qslRecords,
          attachments: qsl.attachments + attachments,
        });
      }),
    );
  }

  async #missingProfile(
    stationProfileId: string,
  ): Promise<PersistenceError | undefined> {
    if (await recordExists(this.#db, "station_profiles", stationProfileId)) {
      return undefined;
    }
    return conflict(TABLE, "missing-reference", "qso.station-profile-missing", {
      key: stationProfileId,
      related: "station_profiles",
    });
  }
}
