// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonical-json";

describe("canonicalJson", () => {
  it("sorts keys at every depth and omits undefined fields", () => {
    expect(
      canonicalJson({
        b: 1,
        a: { z: [3, { y: true, x: null }], k: "v" },
        u: undefined,
      }),
    ).toBe('{"a":{"k":"v","z":[3,{"x":null,"y":true}]},"b":1}');
  });

  it("is independent of the insertion order and parses back to the same value", () => {
    const one = { id: "1", callsign: "IZ1ABC", extra: { B: "2", A: "1" } };
    const two = { extra: { A: "1", B: "2" }, callsign: "IZ1ABC", id: "1" };
    expect(canonicalJson(one)).toBe(canonicalJson(two));
    expect(JSON.parse(canonicalJson(one))).toEqual(one);
  });

  it("escapes strings as JSON.stringify does", () => {
    const text = 'quote " backslash \\ newline \n emoji 📻  ';
    expect(canonicalJson(text)).toBe(JSON.stringify(text));
  });

  it.each([
    ["a Blob", new Blob(["x"])],
    ["a Date", new Date(0)],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a bigint", 1n],
  ])("rejects %s", (_label, value) => {
    expect(() => canonicalJson({ value })).toThrow(TypeError);
  });

  it("rejects undefined inside arrays", () => {
    expect(() => canonicalJson([undefined])).toThrow(TypeError);
  });
});
