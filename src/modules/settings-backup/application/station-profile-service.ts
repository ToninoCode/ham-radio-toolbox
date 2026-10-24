import type {
  DataChangeNotifier,
  DeletionReport,
  PersistenceError,
} from "@/shared/application";
import type { Result } from "@/shared/types";
import type { StationProfile } from "../domain/station-profile";
import type {
  StationProfileDraft,
  StationProfilePatch,
  StationProfileRepository,
} from "./ports";

/**
 * Use cases of the station profiles (FR-SET-01). The invariants are the
 * repository's (one default when profiles exist, the first profile becomes
 * the default, referenced and last profiles cannot be deleted: DATABASE.md
 * § 6); the service adds the notification of committed changes to the
 * other tabs. A database without profiles is valid.
 */
export interface StationProfileService {
  /** All profiles, oldest first. */
  list(): Promise<Result<StationProfile[], PersistenceError>>;
  create(
    draft: StationProfileDraft,
  ): Promise<Result<StationProfile, PersistenceError>>;
  update(
    id: string,
    patch: StationProfilePatch,
  ): Promise<Result<StationProfile, PersistenceError>>;
  setDefault(id: string): Promise<Result<StationProfile, PersistenceError>>;
  remove(id: string): Promise<Result<DeletionReport, PersistenceError>>;
}

export interface StationProfileServiceDeps {
  readonly profiles: StationProfileRepository;
  readonly notifier: DataChangeNotifier;
}

export function createStationProfileService(
  deps: StationProfileServiceDeps,
): StationProfileService {
  const { profiles, notifier } = deps;

  async function notifying<T>(
    operation: Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> {
    const result = await operation;
    if (result.ok) notifier.publish({ scope: "station-profiles" });
    return result;
  }

  return {
    list: () => profiles.list(),
    create: (draft) => notifying(profiles.create(draft)),
    update: (id, patch) => notifying(profiles.update(id, patch)),
    setDefault: (id) => notifying(profiles.setDefault(id)),
    remove: (id) => notifying(profiles.delete(id)),
  };
}
