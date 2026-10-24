import type {
  DeletionReport,
  Draft,
  Patch,
  PersistenceError,
} from "@/shared/application";
import type { Result } from "@/shared/types";
import type { SettingDefinition } from "../domain/setting";
import type {
  StationProfile,
  StationProfileInput,
} from "../domain/station-profile";

/** New profile; `isDefault: 1` makes it the default. */
export type StationProfileDraft = Omit<
  Draft<StationProfileInput>,
  "isDefault"
> & {
  readonly isDefault?: 0 | 1;
};

/** Changes to a profile; the default is changed with `setDefault`. */
export type StationProfilePatch = Omit<Patch<StationProfileInput>, "isDefault">;

/**
 * Station profiles (FR-SET-01, FR-HAM-14). Invariants (DATABASE.md
 * `station_profiles`, § 6):
 * - when at least one profile exists, exactly one has `isDefault: 1`: the
 *   first profile becomes the default, a new default replaces the old one,
 *   deleting the default promotes the oldest remaining profile;
 * - a profile referenced by QSO or receptions cannot be deleted
 *   (`conflict/referenced`, rule `station-profile.referenced`);
 * - the last profile cannot be deleted (`conflict/invariant`, rule
 *   `station-profile.last`).
 */
export interface StationProfileRepository {
  get(id: string): Promise<Result<StationProfile, PersistenceError>>;
  /** All profiles, oldest first. */
  list(): Promise<Result<StationProfile[], PersistenceError>>;
  /** The default profile, `undefined` when there are no profiles. */
  getDefault(): Promise<Result<StationProfile | undefined, PersistenceError>>;
  create(
    draft: StationProfileDraft,
  ): Promise<Result<StationProfile, PersistenceError>>;
  update(
    id: string,
    patch: StationProfilePatch,
  ): Promise<Result<StationProfile, PersistenceError>>;
  setDefault(id: string): Promise<Result<StationProfile, PersistenceError>>;
  delete(id: string): Promise<Result<DeletionReport, PersistenceError>>;
}

/**
 * Preferences (DATABASE.md `settings`). `read` returns the default when
 * the key is absent and `invalid-input` when the stored value no longer
 * satisfies the key's schema (never a silent fallback). `remove` is
 * idempotent.
 */
export interface SettingsRepository {
  read<T>(setting: SettingDefinition<T>): Promise<Result<T, PersistenceError>>;
  write<T>(
    setting: SettingDefinition<T>,
    value: unknown,
  ): Promise<Result<T, PersistenceError>>;
  remove(key: string): Promise<Result<DeletionReport, PersistenceError>>;
}
