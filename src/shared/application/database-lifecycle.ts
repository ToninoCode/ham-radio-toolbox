import type { Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";

/**
 * Events of the local database that the user must act on (DATABASE.md § 7,
 * Q-M2-03):
 * - `version-change`: another tab opened a newer schema; this connection has
 *   been closed and the page must be reloaded;
 * - `blocked`: this tab needs to upgrade the schema but another tab keeps
 *   the old version open; the upgrade waits until that tab is closed.
 */
export type DatabaseLifecycleEvent =
  { readonly type: "version-change" } | { readonly type: "blocked" };

export interface DatabaseLifecycle {
  /** Registers a listener; returns the function that removes it. */
  subscribe(listener: (event: DatabaseLifecycleEvent) => void): () => void;
}

/**
 * Opening of the local database (pending upgrades included). Resolves only
 * when the database is usable or definitely not: while another tab blocks
 * an upgrade it stays pending (`blocked` is notified meanwhile).
 */
export interface DatabaseConnection {
  connect(): Promise<Result<void, PersistenceError>>;
}
