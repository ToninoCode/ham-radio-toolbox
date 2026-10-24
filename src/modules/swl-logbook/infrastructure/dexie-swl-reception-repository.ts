import {
  SCOPES,
  changedEntity,
  deleteAttachmentsOf,
  deleteQslRecordsOf,
  guard,
  laterOf,
  newEntity,
  parseRecord,
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
  NewSwlReception,
  SwlReceptionAggregate,
  SwlReceptionChanges,
  SwlReceptionRepository,
} from "../application/ports";
import {
  receptionDetailsSchema,
  type ReceptionDetails,
  type ReceptionDetailsData,
} from "../domain/reception-details";
import { swlReceptionSchema, type SwlReception } from "../domain/swl-reception";

const TABLE = "swl_receptions";
const DETAILS_TABLE = "reception_details";
const CATEGORY_MISMATCH = "reception-details.category-mismatch";

/**
 * Dexie adapter of SwlReceptionRepository: a reception and its details are
 * validated together and written in one transaction.
 */
export class DexieSwlReceptionRepository implements SwlReceptionRepository {
  readonly #db: AppDatabase;
  readonly #deps: RepositoryDeps;

  constructor(db: AppDatabase, deps: RepositoryDeps) {
    this.#db = db;
    this.#deps = deps;
  }

  get(id: string): Promise<Result<SwlReceptionAggregate, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction(
        "r",
        [this.#db.swl_receptions, this.#db.reception_details],
        async () => {
          const reception = await this.#db.swl_receptions.get(id);
          if (!reception) return err(notFound(TABLE, id));
          return ok(aggregate(reception, await this.#detailsOf(id)));
        },
      ),
    );
  }

  count(): Promise<Result<number, PersistenceError>> {
    return guard(TABLE, async () => ok(await this.#db.swl_receptions.count()));
  }

  create(
    input: NewSwlReception,
  ): Promise<Result<SwlReceptionAggregate, PersistenceError>> {
    return guard(TABLE, async () => {
      const parsed = newEntity(
        TABLE,
        swlReceptionSchema,
        input.reception,
        this.#deps,
      );
      if (!parsed.ok) return parsed;
      const reception = parsed.value;

      let details: ReceptionDetails | undefined;
      if (input.details) {
        const built = this.#buildDetails(reception, input.details);
        if (!built.ok) return built;
        details = built.value;
      }

      return this.#db.transaction("rw", SCOPES.swlWrite, async () => {
        const missing = await this.#missingProfile(reception.stationProfileId);
        if (missing) return err(missing);
        await this.#db.swl_receptions.add(reception);
        if (details) await this.#db.reception_details.add(details);
        return ok(aggregate(reception, details));
      });
    });
  }

  update(
    id: string,
    changes: SwlReceptionChanges,
  ): Promise<Result<SwlReceptionAggregate, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.swlWrite, async () => {
        const existing = await this.#db.swl_receptions.get(id);
        if (!existing) return err(notFound(TABLE, id));
        const parsed = changedEntity(
          TABLE,
          swlReceptionSchema,
          existing,
          changes.reception ?? {},
          this.#deps,
        );
        if (!parsed.ok) return parsed;
        const reception = parsed.value;
        const storedDetails = await this.#detailsOf(id);

        let details: ReceptionDetails | undefined = storedDetails;
        if (changes.details === null) {
          details = undefined;
        } else if (changes.details) {
          const built = this.#buildDetails(
            reception,
            changes.details,
            storedDetails,
          );
          if (!built.ok) return built;
          details = built.value;
        } else if (
          storedDetails &&
          storedDetails.category !== reception.category
        ) {
          return err(
            conflict(DETAILS_TABLE, "invariant", CATEGORY_MISMATCH, {
              key: storedDetails.id,
              related: TABLE,
            }),
          );
        }

        if (reception.stationProfileId !== existing.stationProfileId) {
          const missing = await this.#missingProfile(
            reception.stationProfileId,
          );
          if (missing) return err(missing);
        }

        await this.#db.swl_receptions.put(reception);
        if (storedDetails && !details) {
          await this.#db.reception_details.delete(storedDetails.id);
        } else if (details && details !== storedDetails) {
          await this.#db.reception_details.put(details);
        }
        return ok(aggregate(reception, details));
      }),
    );
  }

  delete(id: string): Promise<Result<DeletionReport, PersistenceError>> {
    return guard(TABLE, () =>
      this.#db.transaction("rw", SCOPES.swlDelete, async () => {
        if (!(await this.#db.swl_receptions.get(id))) {
          return err(notFound(TABLE, id));
        }
        const details = await this.#db.reception_details
          .where("receptionId")
          .equals(id)
          .delete();
        const qsl = await deleteQslRecordsOf(this.#db, "swl", id);
        const attachments = await deleteAttachmentsOf(
          this.#db,
          "swl_reception",
          [id],
        );
        await this.#db.swl_receptions.delete(id);
        return ok({
          swl_receptions: 1,
          reception_details: details,
          qsl_records: qsl.qslRecords,
          attachments: qsl.attachments + attachments,
        });
      }),
    );
  }

  #detailsOf(receptionId: string): Promise<ReceptionDetails | undefined> {
    return this.#db.reception_details
      .where("receptionId")
      .equals(receptionId)
      .first();
  }

  /**
   * Details record for a reception: same category required; an existing
   * record keeps its id and creation time.
   */
  #buildDetails(
    reception: SwlReception,
    input: ReceptionDetailsData,
    stored?: ReceptionDetails,
  ): Result<ReceptionDetails, PersistenceError> {
    if (input.category !== reception.category) {
      return err(
        conflict(DETAILS_TABLE, "invariant", CATEGORY_MISMATCH, {
          key: reception.id,
          related: TABLE,
        }),
      );
    }
    const now = this.#deps.clock.now();
    return parseRecord(DETAILS_TABLE, receptionDetailsSchema, {
      category: input.category,
      data: input.data,
      id: stored?.id ?? this.#deps.ids.newId(),
      receptionId: reception.id,
      createdAt: stored?.createdAt ?? now,
      updatedAt: stored ? laterOf(now, stored.createdAt) : now,
    });
  }

  async #missingProfile(
    stationProfileId: string,
  ): Promise<PersistenceError | undefined> {
    if (await recordExists(this.#db, "station_profiles", stationProfileId)) {
      return undefined;
    }
    return conflict(TABLE, "missing-reference", "swl.station-profile-missing", {
      key: stationProfileId,
      related: "station_profiles",
    });
  }
}

function aggregate(
  reception: SwlReception,
  details: ReceptionDetails | undefined,
): SwlReceptionAggregate {
  return details ? { reception, details } : { reception };
}
