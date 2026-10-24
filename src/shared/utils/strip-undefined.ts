function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Removes keys whose value is `undefined`, in plain objects at any depth
 * (DATABASE.md § 1: optional fields are absent). Arrays, Blobs and other
 * objects are kept as they are.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (!isPlainObject(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined) result[key] = stripUndefined(field);
  }
  return result as T;
}
