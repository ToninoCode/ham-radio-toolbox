import { importJobSchema, type ImportJob } from "@/core/import-job";
import {
  notFound,
  type ImportJobDraft,
  type ImportJobRepository,
  type PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type { AppDatabase } from "../app-database";
import { guard } from "../errors";
import { parseRecord, type RepositoryDeps } from "../repository-support";

const TABLE = "import_jobs";

/** Dexie adapter of ImportJobRepository. */
export class DexieImportJobRepository implements ImportJobRepository {
  readonly #db: AppDatabase;
  readonly #deps: Pick<RepositoryDeps, "ids">;

  constructor(db: AppDatabase, deps: Pick<RepositoryDeps, "ids">) {
    this.#db = db;
    this.#deps = deps;
  }

  create(draft: ImportJobDraft): Promise<Result<ImportJob, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = parseRecord(TABLE, importJobSchema, {
        ...draft,
        id: this.#deps.ids.newId(),
      });
      if (!parsed.ok) return parsed;
      await this.#db.import_jobs.add(parsed.value);
      return ok(parsed.value);
    });
  }

  get(id: string): Promise<Result<ImportJob, PersistenceError>> {
    return guard(TABLE, async () => {
      const job = await this.#db.import_jobs.get(id);
      return job ? ok(job) : err(notFound(TABLE, id));
    });
  }

  listRecent(limit: number): Promise<Result<ImportJob[], PersistenceError>> {
    return guard(TABLE, async () =>
      ok(
        await this.#db.import_jobs
          .orderBy("startedAt")
          .reverse()
          .limit(Math.max(0, Math.trunc(limit)))
          .toArray(),
      ),
    );
  }
}
