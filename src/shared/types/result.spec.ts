// @vitest-environment node
import { describe, expect, it } from "vitest";
import { err, ok, unwrap, type Result } from ".";

describe("Result", () => {
  it("builds success and failure values", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err({ code: "x.y" })).toEqual({ ok: false, error: { code: "x.y" } });
  });

  it("unwrap returns the value or throws with the domain code", () => {
    const success: Result<number, { code: string }> = ok(42);
    const failure: Result<number, { code: string }> = err({
      code: "frequency.negative",
    });
    expect(unwrap(success)).toBe(42);
    expect(() => unwrap(failure)).toThrow(
      "Unexpected domain error: frequency.negative",
    );
  });
});
