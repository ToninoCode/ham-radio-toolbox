import type { UtcDateTime } from "@/core/time";
import {
  SCOPES,
  byCreation,
  changedEntity,
  guard,
  laterOf,
  newEntity,
  stationProfileReferences,
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
  StationProfileDraft,
  StationProfilePatch,
  StationProfileRepository,
} from "../application/ports";
import {
  stationProfileSchema,
  type StationProfile,
} from "../domain/station-profile";

const TABLE = "station_profiles";

/** Dexie adapter of StationProfileRepository (invariants in the port). */
export class DexieStationProfileRepository implements StationProfileRepository {
  readonly #db: AppDatabase;
  readonly #deps: RepositoryDeps;

  constructor(db: AppDatabase, deps: RepositoryDeps) {
    this.#db = db;
    this.#deps = deps;
  }

  get(id: string): Promise<Result<StationProfile, PersistenceError>> {
    return guard(TABLE, async () => {
      const profile = await this.#db.station_profiles.get(id);
      return profile ? ok(profile) : err(notFound(TABLE, id));
    });
  }

  list(): Promise<Result<StationProfile[], PersistenceError>> {
    return guard(TABLE, async () =>
      ok((await this.#db.station_profiles.toArray()).sort(byCreation)),
    );
  }

  getDefault(): Promise<Result<StationProfile | undefined, PersistenceError>> {
    return guard(TABLE, async () =>
      ok(await this.#db.station_profiles.where("isDefault").equals(1).first()),
    );
  }

  create(
    draft: StationProfileDraft,
  ): Promise<Result<StationProfile, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.stationProfileWrite, async () => {
        const isFirst = (await this.#db.station_profiles.count()) === 0;
        const isDefault = draft.isDefault === 1 || isFirst ? 1 : 0;
        const parsed = newEntity(
          TABLE,
          stationProfileSchema,
          { ...draft, isDefault },
          this.#deps,
        );
        if (!parsed.ok) return parsed;
        if (isDefault === 1) await this.#clearDefault(parsed.value.createdAt);
        await this.#db.station_profiles.add(parsed.value);
        return ok(parsed.value);
      }),
    );
  }

  update(
    id: string,
    patch: StationProfilePatch,
  ): Promise<Result<StationProfile, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.stationProfileWrite, async () => {
        const existing = await this.#db.station_profiles.get(id);
        if (!existing) return err(notFound(TABLE, id));
        const parsed = changedEntity(
          TABLE,
          stationProfileSchema,
          existing,
          patch,
          this.#deps,
          { isDefault: existing.isDefault },
        );
        if (!parsed.ok) return parsed;
        await this.#db.station_profiles.put(parsed.value);
        return ok(parsed.value);
      }),
    );
  }

  setDefault(id: string): Promise<Result<StationProfile, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.stationProfileWrite, async () => {
        const existing = await this.#db.station_profiles.get(id);
        if (!existing) return err(notFound(TABLE, id));
        if (existing.isDefault === 1) return ok(existing);
        const now = this.#deps.clock.now();
        await this.#clearDefault(now);
        const updated: StationProfile = {
          ...existing,
          isDefault: 1,
          updatedAt: laterOf(now, existing.createdAt),
        };
        await this.#db.station_profiles.put(updated);
        return ok(updated);
      }),
    );
  }

  delete(id: string): Promise<Result<DeletionReport, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.stationProfileDelete, async () => {
        const existing = await this.#db.station_profiles.get(id);
        if (!existing) return err(notFound(TABLE, id));

        const references = await stationProfileReferences(this.#db, id);
        if (references.qsoLogs > 0 || references.swlReceptions > 0) {
          return err(
            conflict(TABLE, "referenced", "station-profile.referenced", {
              key: id,
              related: references.qsoLogs > 0 ? "qso_logs" : "swl_receptions",
            }),
          );
        }
        if ((await this.#db.station_profiles.count()) <= 1) {
          return err(
            conflict(TABLE, "invariant", "station-profile.last", { key: id }),
          );
        }

        await this.#db.station_profiles.delete(id);
        if (existing.isDefault === 1) await this.#promoteOldest();
        return ok({ [TABLE]: 1 });
      }),
    );
  }

  /** Resets the current default, if any (inside the caller's transaction). */
  async #clearDefault(now: UtcDateTime): Promise<void> {
    await this.#db.station_profiles
      .where("isDefault")
      .equals(1)
      .modify((profile) => {
        profile.isDefault = 0;
        profile.updatedAt = laterOf(now, profile.createdAt);
      });
  }

  /** Makes the oldest remaining profile the default. */
  async #promoteOldest(): Promise<void> {
    const [oldest] = (await this.#db.station_profiles.toArray()).sort(
      byCreation,
    );
    if (!oldest) return;
    await this.#db.station_profiles.put({
      ...oldest,
      isDefault: 1,
      updatedAt: laterOf(this.#deps.clock.now(), oldest.createdAt),
    });
  }
}
