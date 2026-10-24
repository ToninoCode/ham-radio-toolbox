import type { z } from "zod";
import type { DataSource, dataSourceSchema } from "@/core/data-source";
import type { Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";

export type DataSourceInput = z.input<typeof dataSourceSchema>;

/** Runtime state of the external sources, keyed by catalog key. */
export interface DataSourceRepository {
  get(key: string): Promise<Result<DataSource, PersistenceError>>;
  list(): Promise<Result<DataSource[], PersistenceError>>;
  /** Creates or replaces the state of one source. */
  save(state: DataSourceInput): Promise<Result<DataSource, PersistenceError>>;
}
