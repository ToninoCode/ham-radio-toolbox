import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  PersistenceRequestOutcome,
  PersistenceState,
} from "../application/storage-service";
import { useSettingsServices } from "./services";

/**
 * Persistence of the storage (FR-SET-03, ADR-0016): the state is read at
 * startup with `navigator.storage.persisted()`; `persist()` is called only
 * when the user asks for it in Settings, never automatically.
 */
export const useStorageStatusStore = defineStore("storage-status", () => {
  const services = useSettingsServices();
  /** `undefined` until read. */
  const persistence = ref<PersistenceState>();

  async function readPersistence(): Promise<void> {
    persistence.value = await services.storage.persistenceState();
  }

  async function requestPersistence(): Promise<PersistenceRequestOutcome> {
    const outcome = await services.storage.requestPersistence();
    await readPersistence();
    return outcome;
  }

  return { persistence, readPersistence, requestPersistence };
});
