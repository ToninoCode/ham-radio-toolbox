/**
 * Deterministic JSON text of a stored record (ADR-0015): object keys sorted
 * by UTF-16 code units at every depth, no whitespace, `undefined` object
 * fields omitted as `JSON.stringify` does. Two records with the same
 * content give the same text whatever the order in which their fields were
 * written, so exporting the same data twice produces identical tables.
 *
 * Only JSON values are accepted: anything else (Blob, Date, `undefined` in
 * an array, non-finite numbers, bigint) is a programming error.
 */
export function canonicalJson(value: unknown): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`Non-finite number in a record: ${value}`);
      }
      return JSON.stringify(value);
    case "object": {
      if (value === null) return "null";
      if (Array.isArray(value)) {
        return `[${value.map((item: unknown) => canonicalJson(item)).join(",")}]`;
      }
      const prototype: unknown = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("Only plain objects can be serialised");
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, field]) => field !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries
        .map(([key, field]) => `${JSON.stringify(key)}:${canonicalJson(field)}`)
        .join(",")}}`;
    }
    default:
      throw new TypeError(`Value of type ${typeof value} is not JSON`);
  }
}
