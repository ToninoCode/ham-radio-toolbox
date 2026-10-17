// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SINPO_FIELDS, formatSinpo, isSinpoCode, parseSinpo, sinpo } from ".";

describe("parseSinpo", () => {
  it("maps the five digits to independent fields, in S-I-N-P-O order", () => {
    expect(parseSinpo("45434")).toEqual({
      ok: true,
      value: {
        signal: 4,
        interference: 5,
        noise: 4,
        propagation: 3,
        overall: 4,
      },
    });
  });

  it("accepts the limits 11111 and 55555", () => {
    expect(parseSinpo("11111").ok).toBe(true);
    expect(parseSinpo(" 55555 ").ok).toBe(true);
  });

  it("does not derive overall from the other ratings", () => {
    // A strong but unusable signal (e.g. heavy splatter) is legitimate.
    expect(parseSinpo("51115")).toEqual({
      ok: true,
      value: {
        signal: 5,
        interference: 1,
        noise: 1,
        propagation: 1,
        overall: 5,
      },
    });
    expect(parseSinpo("55551").ok).toBe(true);
  });

  it.each([
    ["05555", "signal"],
    ["50555", "interference"],
    ["55055", "noise"],
    ["55505", "propagation"],
    ["55550", "overall"],
    ["65555", "signal"],
    ["55559", "overall"],
  ])("reports %s as out of range on %s", (text, field) => {
    expect(parseSinpo(text)).toEqual({
      ok: false,
      error: { code: "sinpo.out-of-range", field },
    });
  });

  it.each(["4543", "454344", "4543a", "4-5-4-3-4", "45 434", "+4543"])(
    "rejects %j as malformed",
    (text) => {
      expect(parseSinpo(text)).toEqual({
        ok: false,
        error: { code: "sinpo.invalid-format" },
      });
    },
  );

  it("rejects empty input", () => {
    expect(parseSinpo("")).toEqual({
      ok: false,
      error: { code: "sinpo.empty" },
    });
  });
});

describe("sinpo (from separate selectors, UC SWL)", () => {
  const valid = {
    signal: 3,
    interference: 4,
    noise: 5,
    propagation: 2,
    overall: 3,
  };

  it("accepts independent values 1–5", () => {
    expect(sinpo(valid)).toEqual({ ok: true, value: valid });
  });

  it.each(SINPO_FIELDS)("validates %s on its own", (field) => {
    for (const bad of [0, 6, 2.5, Number.NaN, null, undefined, "3"]) {
      expect(sinpo({ ...valid, [field]: bad })).toEqual({
        ok: false,
        error: { code: "sinpo.out-of-range", field },
      });
    }
  });
});

describe("formatSinpo / isSinpoCode", () => {
  it("round-trips through the persisted five-digit code", () => {
    for (const code of ["11111", "45434", "55555", "32143"]) {
      const parsed = parseSinpo(code);
      expect(parsed.ok && formatSinpo(parsed.value)).toBe(code);
      expect(isSinpoCode(code)).toBe(true);
    }
  });

  it("rejects invalid codes", () => {
    for (const code of ["01234", "4543", "45436", 45434, null]) {
      expect(isSinpoCode(code)).toBe(false);
    }
  });
});
