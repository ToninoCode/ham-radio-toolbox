import type {
  DeletionReport,
  Draft,
  Patch,
  PersistenceError,
} from "@/shared/application";
import type { Result } from "@/shared/types";
import type {
  ReceptionDetails,
  ReceptionDetailsData,
} from "../domain/reception-details";
import type { SwlReception, SwlReceptionInput } from "../domain/swl-reception";

export type SwlReceptionDraft = Draft<SwlReceptionInput>;
export type SwlReceptionPatch = Patch<SwlReceptionInput>;

/** A reception with its category-specific details, if any. */
export interface SwlReceptionAggregate {
  readonly reception: SwlReception;
  readonly details?: ReceptionDetails;
}

export interface NewSwlReception {
  readonly reception: SwlReceptionDraft;
  readonly details?: ReceptionDetailsData;
}

/**
 * `details`: new category and data (they replace the stored ones), `null`
 * to remove them, absent to keep them.
 */
export interface SwlReceptionChanges {
  readonly reception?: SwlReceptionPatch;
  readonly details?: ReceptionDetailsData | null;
}

/**
 * Persistence of SWL receptions as an aggregate of `swl_receptions` and
 * `reception_details` (1:1), always written together.
 *
 * Rules: the station profile must exist (`conflict/missing-reference`); the
 * details' category equals the reception's (`conflict/invariant`, rule
 * `reception-details.category-mismatch`), so changing the category of a
 * reception that has details requires new details (or `null`) in the same
 * update. `delete` cascades to the details, the QSL records of the reception
 * with their attachments and the reception's attachments (DATABASE.md § 6).
 *
 * TODO(M4): queries for list, filters, statistics and export.
 */
export interface SwlReceptionRepository {
  get(id: string): Promise<Result<SwlReceptionAggregate, PersistenceError>>;
  count(): Promise<Result<number, PersistenceError>>;
  create(
    input: NewSwlReception,
  ): Promise<Result<SwlReceptionAggregate, PersistenceError>>;
  update(
    id: string,
    changes: SwlReceptionChanges,
  ): Promise<Result<SwlReceptionAggregate, PersistenceError>>;
  delete(id: string): Promise<Result<DeletionReport, PersistenceError>>;
}
