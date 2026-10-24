import type {
  DatabaseConnection,
  PersistenceError,
  StorageEstimate,
  StorageInfo,
} from "@/shared/application";
import type { Result } from "@/shared/types";

/*
 * Storage status (FR-SET-03, NFR-REL-03, ADR-0009): availability of the
 * local database, the browser's estimate of usage and quota, persistence.
 * Every figure comes from the browser and is an estimate.
 */

/** Usage share of the quota above which Settings warns (ADR-0009). */
export const QUOTA_WARNING_RATIO = 0.8;

/**
 * - `persisted`: the browser will not evict the data under storage pressure;
 * - `best-effort`: it may evict them (the default for web apps);
 * - `unsupported`: the browser does not say.
 */
export type PersistenceState = "persisted" | "best-effort" | "unsupported";

export interface StorageUsage extends StorageEstimate {
  /** `usageBytes / quotaBytes`, between 0 and 1. */
  readonly usageRatio: number;
  /** Usage above {@link QUOTA_WARNING_RATIO} of the quota. */
  readonly nearQuota: boolean;
}

export interface StorageStatus {
  /** Whether the database opens (`err` says why not). */
  readonly database: Result<void, PersistenceError>;
  /** Absent when the browser gives no estimate. */
  readonly usage?: StorageUsage;
  readonly persistence: PersistenceState;
}

/**
 * - `granted`: the data are now persisted;
 * - `denied`: the browser refused (it may grant later, e.g. once the app is
 *   installed or used more often);
 * - `unsupported`: no API.
 */
export type PersistenceRequestOutcome = "granted" | "denied" | "unsupported";

export interface StorageService {
  status(): Promise<StorageStatus>;
  /** Explicit request from Settings. */
  requestPersistence(): Promise<PersistenceRequestOutcome>;
  /**
   * Request at startup (NFR-REL-03), only when the data are not persisted
   * yet; Chromium answers without prompting.
   */
  ensurePersistence(): Promise<PersistenceRequestOutcome>;
}

export interface StorageServiceDeps {
  readonly storage: StorageInfo;
  readonly database: DatabaseConnection;
}

function toState(persisted: boolean | undefined): PersistenceState {
  if (persisted === undefined) return "unsupported";
  return persisted ? "persisted" : "best-effort";
}

function toOutcome(granted: boolean | undefined): PersistenceRequestOutcome {
  if (granted === undefined) return "unsupported";
  return granted ? "granted" : "denied";
}

export function usageOf(estimate: StorageEstimate): StorageUsage {
  const usageRatio = Math.min(
    1,
    Math.max(0, estimate.usageBytes / estimate.quotaBytes),
  );
  return {
    ...estimate,
    usageRatio,
    nearQuota: usageRatio > QUOTA_WARNING_RATIO,
  };
}

export function createStorageService(deps: StorageServiceDeps): StorageService {
  const { storage, database } = deps;

  async function requestPersistence(): Promise<PersistenceRequestOutcome> {
    return toOutcome(await storage.requestPersistence());
  }

  return {
    async status() {
      const [connection, estimate, persisted] = await Promise.all([
        database.connect(),
        storage.estimate(),
        storage.isPersisted(),
      ]);
      return {
        database: connection,
        ...(estimate ? { usage: usageOf(estimate) } : {}),
        persistence: toState(persisted),
      };
    },
    requestPersistence,
    async ensurePersistence() {
      const persisted = await storage.isPersisted();
      if (persisted === undefined) return "unsupported";
      if (persisted) return "granted";
      return requestPersistence();
    },
  };
}
