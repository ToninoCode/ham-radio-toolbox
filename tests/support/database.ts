import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { UtcDateTime } from "@/core/time";
import { addSeconds } from "@/core/time";
import { createContainer, type AppContainer } from "@/app/container";
import { AppDatabase } from "@/infrastructure/db";
import { cryptoIdGenerator } from "@/infrastructure/system/crypto-id-generator";
import { silentDataChangeNotifier, type Clock } from "@/shared/application";

/*
 * Isolated databases for integration tests: every call gets its own
 * in-memory IndexedDB (a new fake-indexeddb factory) and a unique name, so
 * tests never share state. Use `reopen()` to check what survives closing
 * the connection in the same IndexedDB environment.
 */

/** Deterministic clock: starts at a fixed instant, `tick` seconds per call. */
export class FakeClock implements Clock {
  #current: UtcDateTime;
  readonly #tick: number;

  constructor(start = "2026-10-24T10:00:00Z", tick = 1) {
    this.#current = start as UtcDateTime;
    this.#tick = tick;
  }

  now(): UtcDateTime {
    const value = this.#current;
    this.#current = addSeconds(this.#current, this.#tick);
    return value;
  }

  set(instant: string): void {
    this.#current = instant as UtcDateTime;
  }
}

export interface TestDatabase {
  readonly indexedDB: IDBFactory;
  readonly name: string;
  readonly clock: FakeClock;
  readonly container: AppContainer;
  /** Raw database of the container, for assertions on the stored data. */
  readonly db: AppDatabase;
  /** New connection (and container) on the same IndexedDB and name. */
  reopen(): TestDatabase;
}

function open(indexedDB: IDBFactory, name: string): TestDatabase {
  const clock = new FakeClock();
  const options = { name, indexedDB, IDBKeyRange };
  const container = createContainer({
    database: options,
    clock,
    ids: cryptoIdGenerator,
    // Tests of one process must not notify each other through BroadcastChannel.
    dataChanges: silentDataChangeNotifier,
  });
  const db = new AppDatabase(options);
  return {
    indexedDB,
    name,
    clock,
    container,
    db,
    reopen() {
      container.dispose();
      db.close();
      return open(indexedDB, name);
    },
  };
}

export function createTestDatabase(): TestDatabase {
  return open(new IDBFactory(), `hrt-test-${crypto.randomUUID()}`);
}

/** Options to build further Dexie instances on the same fake database. */
export function databaseOptions(test: TestDatabase) {
  return { name: test.name, indexedDB: test.indexedDB, IDBKeyRange };
}
