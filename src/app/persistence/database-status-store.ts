import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type {
  DatabaseConnection,
  DatabaseLifecycle,
  PersistenceError,
} from "@/shared/application";

/**
 * - `connecting`: the database is opening (or waiting for another tab);
 * - `available`: it opened;
 * - `unavailable`: it cannot be used (`error` says why).
 */
export type DatabaseConnectionState =
  "connecting" | "available" | "unavailable";

/**
 * State of the local database for the app shell (DATABASE.md § 7,
 * Q-M2-03): opening outcome and lifecycle events. `version-change` means
 * another tab upgraded the schema and this tab closed its connection:
 * committed data are safe, new writes fail with `unavailable/closed` until
 * the page is reloaded. `blocked` means this tab's upgrade waits for other
 * tabs; it clears when the database opens.
 */
export const useDatabaseStatusStore = defineStore("database-status", () => {
  const connection = ref<DatabaseConnectionState>("connecting");
  const error = shallowRef<PersistenceError>();
  const versionChanged = ref(false);
  const blocked = ref(false);

  let started = false;

  function start(deps: {
    readonly lifecycle: DatabaseLifecycle;
    readonly database: DatabaseConnection;
  }): void {
    if (started) return;
    started = true;
    deps.lifecycle.subscribe((event) => {
      if (event.type === "blocked") {
        blocked.value = true;
        return;
      }
      versionChanged.value = true;
      connection.value = "unavailable";
      error.value = {
        code: "persistence.unavailable",
        reason: "closed",
        cause: "VersionChange",
      };
    });
    void deps.database.connect().then((result) => {
      blocked.value = false;
      if (versionChanged.value) return;
      if (result.ok) {
        connection.value = "available";
        error.value = undefined;
      } else {
        connection.value = "unavailable";
        error.value = result.error;
      }
    });
  }

  return { connection, error, versionChanged, blocked, start };
});
