/*
 * Storage quota and persistence (FR-SET-03, NFR-REL-03, ADR-0009).
 *
 * TODO(M2): Block D — adapter on navigator.storage, request of persistence
 * and status in Settings, warning above 80 % of the quota.
 */

export interface StorageEstimate {
  readonly usageBytes: number;
  readonly quotaBytes: number;
}

/** `undefined` results mean that the browser does not offer the API. */
export interface StorageInfo {
  estimate(): Promise<StorageEstimate | undefined>;
  isPersisted(): Promise<boolean | undefined>;
  /** Asks the browser not to evict the data; returns the outcome. */
  requestPersistence(): Promise<boolean | undefined>;
}
