/*
 * Storage quota and persistence (FR-SET-03, NFR-REL-03, ADR-0009). The
 * adapter is on `navigator.storage` (src/infrastructure/system); the use
 * cases that read it are in the settings-backup module.
 */

/**
 * Browser estimate of the space used by this origin and of the space it may
 * use. Both are estimates: the quota is not a guarantee that the space is
 * really free on the device (the browser may evict data, the disk may fill
 * up for other reasons).
 */
export interface StorageEstimate {
  readonly usageBytes: number;
  readonly quotaBytes: number;
}

/** `undefined` results mean that the browser does not offer the API. */
export interface StorageInfo {
  estimate(): Promise<StorageEstimate | undefined>;
  isPersisted(): Promise<boolean | undefined>;
  /**
   * Asks the browser not to evict the data; returns the outcome. Browsers
   * decide on their own (Chromium from engagement and installation, without
   * a prompt; Firefox asks the user).
   */
  requestPersistence(): Promise<boolean | undefined>;
}
