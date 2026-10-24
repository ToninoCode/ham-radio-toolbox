import { dataSourceSchema, type DataSource } from "@/core/data-source";
import {
  notFound,
  type DataSourceInput,
  type DataSourceRepository,
  type PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type { AppDatabase } from "../app-database";
import { guard } from "../errors";
import { parseRecord } from "../repository-support";

const TABLE = "data_sources";

/** Dexie adapter of DataSourceRepository. */
export class DexieDataSourceRepository implements DataSourceRepository {
  readonly #db: AppDatabase;

  constructor(db: AppDatabase) {
    this.#db = db;
  }

  get(key: string): Promise<Result<DataSource, PersistenceError>> {
    return guard(TABLE, async () => {
      const state = await this.#db.data_sources.get(key);
      return state ? ok(state) : err(notFound(TABLE, key));
    });
  }

  list(): Promise<Result<DataSource[], PersistenceError>> {
    return guard(TABLE, async () =>
      ok(await this.#db.data_sources.orderBy(":id").toArray()),
    );
  }

  save(state: DataSourceInput): Promise<Result<DataSource, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = parseRecord(TABLE, dataSourceSchema, state);
      if (!parsed.ok) return parsed;
      await this.#db.data_sources.put(parsed.value);
      return ok(parsed.value);
    });
  }
}
