import {
  guard,
  parseRecord,
  stripUndefined,
  type AppDatabase,
  type RepositoryDeps,
} from "@/infrastructure/db";
import {
  invalidInput,
  validationIssues,
  type DeletionReport,
  type PersistenceError,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type { SettingsRepository } from "../application/ports";
import { settingRecordSchema, type SettingDefinition } from "../domain/setting";

const TABLE = "settings";

/** Dexie adapter of SettingsRepository: one row per preference key. */
export class DexieSettingsRepository implements SettingsRepository {
  readonly #db: AppDatabase;
  readonly #deps: Pick<RepositoryDeps, "clock">;

  constructor(db: AppDatabase, deps: Pick<RepositoryDeps, "clock">) {
    this.#db = db;
    this.#deps = deps;
  }

  read<T>(setting: SettingDefinition<T>): Promise<Result<T, PersistenceError>> {
    return guard(TABLE, async () => {
      const record = await this.#db.settings.get(setting.key);
      if (!record) return ok(setting.defaultValue);
      const parsed = setting.schema.safeParse(record.value);
      return parsed.success
        ? ok(parsed.data)
        : err(invalidInput(TABLE, validationIssues(parsed.error)));
    });
  }

  write<T>(
    setting: SettingDefinition<T>,
    value: unknown,
  ): Promise<Result<T, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = setting.schema.safeParse(value);
      if (!parsed.success) {
        return err(invalidInput(TABLE, validationIssues(parsed.error)));
      }
      const record = parseRecord(TABLE, settingRecordSchema, {
        key: setting.key,
        value: stripUndefined(parsed.data),
        updatedAt: this.#deps.clock.now(),
      });
      if (!record.ok) return record;
      await this.#db.settings.put(record.value);
      return ok(parsed.data);
    });
  }

  remove(key: string): Promise<Result<DeletionReport, PersistenceError>> {
    return guard(TABLE, async () => {
      const removed = await this.#db.settings.where(":id").equals(key).delete();
      return ok({ [TABLE]: removed });
    });
  }
}
