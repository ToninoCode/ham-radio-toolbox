import type { StorageEstimate, StorageInfo } from "@/shared/application";

/** The part of `navigator.storage` (StorageManager) used by the adapter. */
export type StorageManagerLike = Partial<
  Pick<StorageManager, "estimate" | "persisted" | "persist">
>;

/**
 * StorageInfo on `navigator.storage` (FR-SET-03). Missing methods, and
 * methods that throw (some embedded or private contexts reject them), are
 * reported as `undefined`: "the browser does not tell".
 */
export function createNavigatorStorageInfo(
  storage: StorageManagerLike | undefined = globalThis.navigator?.storage,
): StorageInfo {
  async function attempt<T>(
    call: (() => Promise<T>) | undefined,
  ): Promise<T | undefined> {
    if (!call) return undefined;
    try {
      return await call();
    } catch {
      return undefined;
    }
  }

  return {
    async estimate(): Promise<StorageEstimate | undefined> {
      const estimate = await attempt(storage?.estimate?.bind(storage));
      const usage = estimate?.usage;
      const quota = estimate?.quota;
      if (
        typeof usage !== "number" ||
        typeof quota !== "number" ||
        !Number.isFinite(usage) ||
        !Number.isFinite(quota) ||
        quota <= 0
      ) {
        return undefined;
      }
      return { usageBytes: usage, quotaBytes: quota };
    },
    isPersisted: () => attempt(storage?.persisted?.bind(storage)),
    requestPersistence: () => attempt(storage?.persist?.bind(storage)),
  };
}
