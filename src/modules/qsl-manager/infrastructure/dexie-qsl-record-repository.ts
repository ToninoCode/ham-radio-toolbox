import {
  QSL_SUBJECT_TABLES,
  SCOPES,
  byCreation,
  changedEntity,
  deleteAttachmentsOf,
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
  QslRecordDraft,
  QslRecordPatch,
  QslRecordRepository,
} from "../application/ports";
import {
  qslRecordSchema,
  type QslRecord,
  type QslSubjectType,
} from "../domain/qsl-record";

const TABLE = "qsl_records";

/** Dexie adapter of QslRecordRepository (rules in the port). */
export class DexieQslRecordRepository implements QslRecordRepository {
  readonly #db: AppDatabase;
  readonly #deps: RepositoryDeps;

  constructor(db: AppDatabase, deps: RepositoryDeps) {
    this.#db = db;
    this.#deps = deps;
  }

  get(id: string): Promise<Result<QslRecord, PersistenceError>> {
    return guard(TABLE, async () => {
      const record = await this.#db.qsl_records.get(id);
      return record ? ok(record) : err(notFound(TABLE, id));
    });
  }

  listBySubject(
    subjectType: QslSubjectType,
    subjectId: string,
  ): Promise<Result<QslRecord[], PersistenceError>> {
    return guard(TABLE, async () =>
      ok((await this.#ofSubject(subjectType, subjectId)).sort(byCreation)),
    );
  }

  create(draft: QslRecordDraft): Promise<Result<QslRecord, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = newEntity(TABLE, qslRecordSchema, draft, this.#deps);
      if (!parsed.ok) return parsed;
      const record = parsed.value;
      return this.#db.transaction("rw", SCOPES.qslWrite, async () => {
        const subjectTable = QSL_SUBJECT_TABLES[record.subjectType];
        if (!(await recordExists(this.#db, subjectTable, record.subjectId))) {
          return err(
            conflict(TABLE, "missing-reference", "qsl-record.subject-missing", {
              key: record.subjectId,
              related: subjectTable,
            }),
          );
        }
        const taken = await this.#channelTaken(record);
        if (taken) return err(taken);
        await this.#db.qsl_records.add(record);
        return ok(record);
      });
    });
  }

  update(
    id: string,
    patch: QslRecordPatch,
  ): Promise<Result<QslRecord, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.qslWrite, async () => {
        const existing = await this.#db.qsl_records.get(id);
        if (!existing) return err(notFound(TABLE, id));
        const parsed = changedEntity(
          TABLE,
          qslRecordSchema,
          existing,
          patch,
          this.#deps,
          { subjectType: existing.subjectType, subjectId: existing.subjectId },
        );
        if (!parsed.ok) return parsed;
        const record = parsed.value;
        if (record.channel !== existing.channel) {
          const taken = await this.#channelTaken(record);
          if (taken) return err(taken);
        }
        await this.#db.qsl_records.put(record);
        return ok(record);
      }),
    );
  }

  delete(id: string): Promise<Result<DeletionReport, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.qslDelete, async () => {
        if (!(await this.#db.qsl_records.get(id))) {
          return err(notFound(TABLE, id));
        }
        const attachments = await deleteAttachmentsOf(this.#db, "qsl", [id]);
        await this.#db.qsl_records.delete(id);
        return ok({ qsl_records: 1, attachments });
      }),
    );
  }

  #ofSubject(
    subjectType: QslSubjectType,
    subjectId: string,
  ): Promise<QslRecord[]> {
    return this.#db.qsl_records
      .where("[subjectType+subjectId]")
      .equals([subjectType, subjectId])
      .toArray();
  }

  /** Another record of the same subject on the same channel, as an error. */
  async #channelTaken(
    record: QslRecord,
  ): Promise<PersistenceError | undefined> {
    const other = (
      await this.#ofSubject(record.subjectType, record.subjectId)
    ).find(
      (candidate) =>
        candidate.channel === record.channel && candidate.id !== record.id,
    );
    return other
      ? conflict(TABLE, "duplicate", "qsl-record.channel-taken", {
          key: other.id,
        })
      : undefined;
  }
}
