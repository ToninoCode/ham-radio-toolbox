import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import type { DeletionReport, PersistenceError } from "@/shared/application";
import type { Result } from "@/shared/types";
import type {
  StationProfileDraft,
  StationProfilePatch,
} from "../application/ports";
import type { StationProfile } from "../domain/station-profile";
import { useSettingsServices } from "./services";

export type ProfilesStatus = "idle" | "loading" | "ready" | "error";

/**
 * Station profiles shown by Settings (FR-SET-01). After every successful
 * change the list is read again, so that the default profile (which the
 * repository may move) is always the stored one. Changes committed by
 * other tabs reload the list.
 */
export const useStationProfilesStore = defineStore("station-profiles", () => {
  const services = useSettingsServices();

  const profiles = ref<StationProfile[]>([]);
  const status = ref<ProfilesStatus>("idle");
  const loadError = shallowRef<PersistenceError>();
  const defaultProfile = computed(() =>
    profiles.value.find((profile) => profile.isDefault === 1),
  );

  async function load(): Promise<void> {
    if (status.value !== "ready") status.value = "loading";
    const result = await services.stationProfiles.list();
    if (result.ok) {
      profiles.value = result.value;
      loadError.value = undefined;
      status.value = "ready";
    } else {
      loadError.value = result.error;
      status.value = "error";
    }
  }

  async function reloading<T>(
    operation: Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> {
    const result = await operation;
    if (result.ok) await load();
    return result;
  }

  const create = (draft: StationProfileDraft) =>
    reloading(services.stationProfiles.create(draft));
  const update = (id: string, patch: StationProfilePatch) =>
    reloading(services.stationProfiles.update(id, patch));
  const setDefault = (id: string) =>
    reloading(services.stationProfiles.setDefault(id));
  const remove = (
    id: string,
  ): Promise<Result<DeletionReport, PersistenceError>> =>
    reloading(services.stationProfiles.remove(id));

  services.dataChanges.subscribe((change) => {
    if (
      (change.scope === "station-profiles" || change.scope === "all") &&
      status.value !== "idle"
    ) {
      void load();
    }
  });

  return {
    profiles,
    status,
    loadError,
    defaultProfile,
    load,
    create,
    update,
    setDefault,
    remove,
  };
});
