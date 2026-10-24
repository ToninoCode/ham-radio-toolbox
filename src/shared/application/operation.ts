import type { DomainError } from "@/shared/types";

/**
 * A long operation (import, backup, restore) stopped because its
 * `AbortSignal` fired. Nothing was written: interruptions are honoured only
 * outside transactions.
 */
export type AbortedError = DomainError<"operation.aborted">;

export const ABORTED: AbortedError = Object.freeze({
  code: "operation.aborted",
});

/** Whether the optional signal has fired. */
export function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}
