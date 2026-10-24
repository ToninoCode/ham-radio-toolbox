// @vitest-environment node
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { toPersistenceError } from "./errors";

/*
 * Classification of storage failures (ARCHITECTURE.md § 5.5): storage and
 * environment failures become PersistenceError, everything else propagates.
 */

const domException = (name: string) => new DOMException("test", name);

describe("toPersistenceError", () => {
  it.each([
    ["QuotaExceededError", { code: "persistence.quota-exceeded" }],
    [
      "AbortError",
      { code: "persistence.transaction-failed", cause: "AbortError" },
    ],
    [
      "TransactionInactiveError",
      {
        code: "persistence.transaction-failed",
        cause: "TransactionInactiveError",
      },
    ],
    [
      "InvalidStateError",
      {
        code: "persistence.unavailable",
        reason: "open-failed",
        cause: "InvalidStateError",
      },
    ],
    [
      "UnknownError",
      {
        code: "persistence.unavailable",
        reason: "open-failed",
        cause: "UnknownError",
      },
    ],
    [
      "VersionError",
      {
        code: "persistence.unavailable",
        reason: "newer-version",
        cause: "VersionError",
      },
    ],
  ])("maps the DOMException %s", (name, expected) => {
    expect(toPersistenceError(domException(name))).toEqual(expected);
  });

  it("maps Dexie errors, preferring the innermost known cause", () => {
    expect(toPersistenceError(new Dexie.MissingAPIError())).toMatchObject({
      reason: "missing-api",
    });
    expect(toPersistenceError(new Dexie.DatabaseClosedError())).toMatchObject({
      reason: "closed",
    });
    expect(
      toPersistenceError(
        new Dexie.DatabaseClosedError(new Dexie.VersionError("newer")),
      ),
    ).toMatchObject({ reason: "newer-version", cause: "VersionError" });
    expect(
      toPersistenceError(
        new Dexie.AbortError("x", domException("QuotaExceededError")),
      ),
    ).toEqual({ code: "persistence.quota-exceeded" });
    expect(toPersistenceError(new Dexie.PrematureCommitError())).toMatchObject({
      code: "persistence.transaction-failed",
    });
  });

  it("qualifies constraint violations with the table", () => {
    expect(
      toPersistenceError(domException("ConstraintError"), "qso_logs"),
    ).toEqual({
      code: "persistence.conflict",
      table: "qso_logs",
      reason: "duplicate",
      rule: "unique-key",
    });
    expect(toPersistenceError(domException("ConstraintError"))).toEqual({
      code: "persistence.transaction-failed",
      cause: "ConstraintError",
    });
  });

  it("looks into the failures of bulk operations", () => {
    const bulk = new Dexie.BulkError("bulk", [domException("ConstraintError")]);
    expect(toPersistenceError(bulk, "attachments")).toMatchObject({
      code: "persistence.conflict",
      reason: "duplicate",
    });
  });

  it.each([
    ["TypeError", new TypeError("bug")],
    ["DataError (invalid key: programming error)", domException("DataError")],
    ["a plain string", "boom"],
    ["null", null],
  ])("does not map %s", (_label, error) => {
    expect(toPersistenceError(error)).toBeUndefined();
  });
});
