/**
 * Outcome of an operation that can fail in an expected way (validation,
 * invalid input). Unexpected failures still throw (ARCHITECTURE.md § 5.5).
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

/**
 * Typed domain error with a stable `code`; presentation maps the code to an
 * i18n message (ARCHITECTURE.md § 5.5). Domain code never carries UI text.
 */
export interface DomainError<C extends string> {
  readonly code: C;
}

/** Value of a successful result, or an exception for programming errors. */
export function unwrap<T, E extends DomainError<string>>(
  result: Result<T, E>,
): T {
  if (result.ok) return result.value;
  throw new Error(`Unexpected domain error: ${result.error.code}`);
}
