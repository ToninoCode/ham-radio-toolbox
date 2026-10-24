import type { UtcDateTime } from "@/core/time";
import type { Uuid } from "@/core/validation";

/** Current instant in UTC, to the second (ARCHITECTURE.md § 5.2). */
export interface Clock {
  now(): UtcDateTime;
}

/** New entity identifiers: UUID v4 (ADR-0005). */
export interface IdGenerator {
  newId(): Uuid;
}

/**
 * SHA-256 of a file's content as lower-case hex (ADR-0009). Asynchronous:
 * compute it before opening a unit of work, never inside one.
 */
export interface ContentHasher {
  sha256(content: Blob): Promise<string>;
}
