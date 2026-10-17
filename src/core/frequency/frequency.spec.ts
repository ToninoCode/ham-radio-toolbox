// @vitest-environment node
import { describe, expect, it } from "vitest";
import { unwrap } from "@/shared/types";
import {
  MAX_FREQUENCY_HZ,
  frequencyFromWavelength,
  frequencyHz,
  fromUnit,
  isFrequencyHz,
  ituFrequencyRange,
  parseFrequency,
  toUnit,
  wavelengthMeters,
  type FrequencyHz,
} from ".";

const hz = (value: number) => value as FrequencyHz;
const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? undefined : result.error?.code;

describe("frequencyHz / isFrequencyHz", () => {
  it("accepts safe non-negative integers, including 0 and the safe maximum", () => {
    for (const value of [0, 1, 14_074_000, MAX_FREQUENCY_HZ]) {
      expect(isFrequencyHz(value)).toBe(true);
      expect(frequencyHz(value)).toEqual({ ok: true, value });
    }
  });

  it.each([
    [Number.NaN, "frequency.not-a-number"],
    ["14074000", "frequency.not-a-number"],
    [null, "frequency.not-a-number"],
    [undefined, "frequency.not-a-number"],
    [Number.POSITIVE_INFINITY, "frequency.not-finite"],
    [Number.NEGATIVE_INFINITY, "frequency.not-finite"],
    [-1, "frequency.negative"],
    [14_074_000.5, "frequency.not-integer"],
    [MAX_FREQUENCY_HZ + 1, "frequency.too-large"],
  ])("rejects %s with %s", (value, code) => {
    expect(isFrequencyHz(value)).toBe(false);
    expect(codeOf(frequencyHz(value))).toBe(code);
  });
});

describe("fromUnit / toUnit", () => {
  it("converts kHz, MHz and GHz to whole hertz", () => {
    expect(unwrap(fromUnit(14_074_000, "Hz"))).toBe(14_074_000);
    expect(unwrap(fromUnit(7074, "kHz"))).toBe(7_074_000);
    expect(unwrap(fromUnit(145.5, "MHz"))).toBe(145_500_000);
    expect(unwrap(fromUnit(10.368, "GHz"))).toBe(10_368_000_000);
  });

  it("absorbs binary floating-point error by rounding to the nearest hertz", () => {
    // IEEE 754 products checked in Node 22: 0.001014 × 1e6 = 1013.9999999999999
    // and 0.001007 × 1e6 = 1007.0000000000001.
    expect(0.001014 * 1e6).not.toBe(1014);
    expect(unwrap(fromUnit(0.001014, "MHz"))).toBe(1014);
    expect(0.001007 * 1e6).not.toBe(1007);
    expect(unwrap(fromUnit(0.001007, "MHz"))).toBe(1007);
    expect(unwrap(fromUnit(14.074, "MHz"))).toBe(14_074_000);
    expect(unwrap(fromUnit(0.1357, "MHz"))).toBe(135_700);
    // EiBi-style kHz with decimals (ADR-0005): 9420.5 kHz.
    expect(unwrap(fromUnit(9420.5, "kHz"))).toBe(9_420_500);
  });

  it("rounds sub-hertz values to the nearest hertz", () => {
    expect(unwrap(fromUnit(1.0004, "kHz"))).toBe(1000);
    expect(unwrap(fromUnit(1.0006, "kHz"))).toBe(1001);
    expect(unwrap(fromUnit(0.4, "Hz"))).toBe(0);
  });

  it("rejects invalid numbers and results beyond the safe range", () => {
    expect(codeOf(fromUnit(Number.NaN, "MHz"))).toBe("frequency.not-a-number");
    expect(codeOf(fromUnit(Number.POSITIVE_INFINITY, "kHz"))).toBe(
      "frequency.not-finite",
    );
    expect(codeOf(fromUnit(-0.001, "MHz"))).toBe("frequency.negative");
    expect(codeOf(fromUnit(1e7, "GHz"))).toBe("frequency.too-large");
  });

  it("converts hertz back to each unit", () => {
    const f = hz(14_074_000);
    expect(toUnit(f, "Hz")).toBe(14_074_000);
    expect(toUnit(f, "kHz")).toBe(14_074);
    expect(toUnit(f, "MHz")).toBe(14.074);
    expect(toUnit(f, "GHz")).toBe(0.014074);
  });

  it("round-trips Hz → unit → Hz for every band edge without loss", () => {
    for (const value of [135_700, 5_351_500, 10_368_000_000, 1_296_200_000]) {
      for (const unit of ["Hz", "kHz", "MHz", "GHz"] as const) {
        expect(unwrap(fromUnit(toUnit(hz(value), unit), unit))).toBe(value);
      }
    }
  });
});

describe("parseFrequency", () => {
  it("parses decimal text exactly, with dot or comma", () => {
    expect(unwrap(parseFrequency("14.074", "MHz"))).toBe(14_074_000);
    expect(unwrap(parseFrequency("7,0745", "MHz"))).toBe(7_074_500);
    expect(unwrap(parseFrequency(" 3573 ", "kHz"))).toBe(3_573_000);
    expect(unwrap(parseFrequency("10.", "MHz"))).toBe(10_000_000);
    expect(unwrap(parseFrequency("0", "Hz"))).toBe(0);
  });

  it("rounds digits beyond 1 Hz half-up", () => {
    expect(unwrap(parseFrequency("1.0000005", "MHz"))).toBe(1_000_001);
    expect(unwrap(parseFrequency("1.0000004999", "MHz"))).toBe(1_000_000);
    expect(unwrap(parseFrequency("0.5", "Hz"))).toBe(1);
  });

  it("handles values at the safe-integer limit", () => {
    expect(unwrap(parseFrequency(String(MAX_FREQUENCY_HZ), "Hz"))).toBe(
      MAX_FREQUENCY_HZ,
    );
    expect(codeOf(parseFrequency("9007199254740992", "Hz"))).toBe(
      "frequency.too-large",
    );
  });

  it.each(["", " ", "abc", "-14.074", "+7", "1e6", "14.074.1", "1 000", ".5"])(
    "rejects %j",
    (text) => {
      expect(codeOf(parseFrequency(text, "MHz"))).toBe(
        "frequency.invalid-format",
      );
    },
  );
});

describe("wavelength", () => {
  it("uses the exact speed of light: 299.792458 MHz is exactly 1 m", () => {
    expect(unwrap(wavelengthMeters(hz(299_792_458)))).toBe(1);
    expect(unwrap(frequencyFromWavelength(1))).toBe(299_792_458);
  });

  it("computes free-space wavelengths of known frequencies", () => {
    // λ = 299 792 458 / f
    expect(unwrap(wavelengthMeters(hz(1_000_000)))).toBeCloseTo(299.792458, 9);
    expect(unwrap(wavelengthMeters(hz(14_200_000)))).toBeCloseTo(21.112145, 6);
    expect(unwrap(wavelengthMeters(hz(145_000_000)))).toBeCloseTo(2.067534, 6);
    expect(unwrap(frequencyFromWavelength(2))).toBe(149_896_229);
  });

  it("rejects zero frequency and non-positive wavelengths", () => {
    expect(codeOf(wavelengthMeters(hz(0)))).toBe("wavelength.zero-frequency");
    expect(codeOf(frequencyFromWavelength(0))).toBe("wavelength.not-positive");
    expect(codeOf(frequencyFromWavelength(-1))).toBe("wavelength.not-positive");
    expect(codeOf(frequencyFromWavelength(Number.POSITIVE_INFINITY))).toBe(
      "wavelength.not-positive",
    );
    expect(codeOf(frequencyFromWavelength(Number.NaN))).toBe(
      "frequency.not-a-number",
    );
  });

  it("rejects wavelengths so short that the frequency is not a safe integer", () => {
    expect(codeOf(frequencyFromWavelength(1e-12))).toBe("frequency.too-large");
  });
});

describe("ituFrequencyRange (ITU RR Art. 2: lower edge excluded, upper included)", () => {
  it.each([
    [137_000, "LF"],
    [300_000, "LF"],
    [300_001, "MF"],
    [1_810_000, "MF"],
    [3_000_000, "MF"],
    [3_500_000, "HF"],
    [30_000_000, "HF"],
    [50_000_000, "VHF"],
    [432_000_000, "UHF"],
    [10_368_000_000, "SHF"],
  ])("%d Hz is %s", (value, range) => {
    expect(ituFrequencyRange(hz(value))).toBe(range);
  });

  it("is undefined outside 3 Hz – 3000 GHz", () => {
    expect(ituFrequencyRange(hz(0))).toBeUndefined();
    expect(ituFrequencyRange(hz(3))).toBeUndefined();
    expect(ituFrequencyRange(hz(3_000_000_000_001))).toBeUndefined();
  });
});
