import type Dexie from "dexie";
import type { PersistenceError, UnitOfWork } from "@/shared/application";
import { err, type Result } from "@/shared/types";
import { toPersistenceError } from "./errors";

/** Thrown inside the transaction to abort it when `work` returns `err`. */
class RollbackSignal extends Error {
  constructor() {
    super("Unit of work rolled back");
    this.name = "RollbackSignal";
  }
}

/**
 * UnitOfWork over one Dexie read-write transaction on **every** table
 * (ADR-0014): repository calls inside `work` join it, whatever tables they
 * touch, and concurrent units are serialised by IndexedDB. The cost is that
 * a long unit delays other writes; units are meant to contain only the
 * database operations of one commit.
 */
export class DexieUnitOfWork implements UnitOfWork {
  readonly #db: Dexie;

  constructor(db: Dexie) {
    this.#db = db;
  }

  async run<T, E>(
    work: () => Promise<Result<T, E>>,
  ): Promise<Result<T, E | PersistenceError>> {
    let failure: { readonly ok: false; readonly error: E } | undefined;
    try {
      return await this.#db.transaction("rw", this.#db.tables, async () => {
        const result = await work();
        if (!result.ok) {
          failure = result;
          throw new RollbackSignal();
        }
        return result;
      });
    } catch (error) {
      if (failure) return failure;
      const mapped = toPersistenceError(error);
      if (mapped) return err(mapped);
      throw error;
    }
  }
}
