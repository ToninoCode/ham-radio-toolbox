import {
  silentDataChangeNotifier,
  type DataChange,
  type DataChangeNotifier,
  type DataChangeScope,
} from "@/shared/application";

/** Channel shared by the tabs of the app (same origin only). */
export const DATA_CHANGE_CHANNEL = "ham-radio-toolbox:data-changes";

const SCOPES: readonly DataChangeScope[] = [
  "preferences",
  "station-profiles",
  "all",
];

/** Messages come from other tabs of the same origin: still checked. */
function asChange(data: unknown): DataChange | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { scope } = data as { scope?: unknown };
  return SCOPES.includes(scope as DataChangeScope)
    ? { scope: scope as DataChangeScope }
    : undefined;
}

export interface ClosableDataChangeNotifier extends DataChangeNotifier {
  /** Closes the channel (container disposal). */
  close(): void;
}

/**
 * DataChangeNotifier on BroadcastChannel: a message posted by a tab reaches
 * the other tabs of the app, never the sender. Without the API (very old
 * browsers) changes are simply not notified.
 */
export function createBroadcastDataChangeNotifier(
  Channel: typeof BroadcastChannel | undefined = globalThis.BroadcastChannel,
): ClosableDataChangeNotifier {
  if (typeof Channel !== "function") {
    return { ...silentDataChangeNotifier, close: () => undefined };
  }
  const channel = new Channel(DATA_CHANGE_CHANNEL);
  // Node's BroadcastChannel (test runs) must not keep the process alive.
  (channel as { unref?: () => void }).unref?.();
  const listeners = new Set<(change: DataChange) => void>();
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const change = asChange(event.data);
    if (!change) return;
    for (const listener of listeners) listener(change);
  });

  return {
    publish(change) {
      try {
        channel.postMessage({ scope: change.scope });
      } catch {
        // A closed channel (page being unloaded): nothing to notify.
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      listeners.clear();
      channel.close();
    },
  };
}
