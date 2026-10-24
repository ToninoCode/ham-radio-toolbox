/**
 * What changed in the local data, so that other views of the same data
 * reload it instead of showing (and later overwriting) stale values:
 * - `preferences`: the `settings` table;
 * - `station-profiles`: the `station_profiles` table;
 * - `all`: any table (e.g. after a restore).
 */
export type DataChangeScope = "preferences" | "station-profiles" | "all";

export interface DataChange {
  readonly scope: DataChangeScope;
}

/**
 * Notifies the other tabs of the app that this tab committed changes
 * (BroadcastChannel adapter). It never delivers a change to the tab that
 * published it: that tab updates its own state. Best effort: a browser
 * without the API simply does not notify.
 */
export interface DataChangeNotifier {
  publish(change: DataChange): void;
  /** Changes committed by other tabs; returns the function that unsubscribes. */
  subscribe(listener: (change: DataChange) => void): () => void;
}

/** Notifier that does nothing (tests, browsers without the API). */
export const silentDataChangeNotifier: DataChangeNotifier = Object.freeze({
  publish: () => undefined,
  subscribe: () => () => undefined,
});
