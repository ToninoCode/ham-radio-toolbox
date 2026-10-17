// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isCallsign, normalizeCallsign, parseCallsign } from ".";

const parts = (text: string) => {
  const result = parseCallsign(text);
  if (!result.ok) throw new Error(`${text}: ${result.error.code}`);
  return result.value;
};
const codeOf = (text: string) => {
  const result = parseCallsign(text);
  return result.ok ? undefined : result.error.code;
};

/*
 * Real stations: W1AW (ARRL HQ), 4U1ITU (ITU HQ, Geneva), 4U1UN (UN HQ,
 * New York), 1A0KM (Sovereign Military Order of Malta). The other callsigns
 * are syntax examples built on the ITU structure (RR Art. 19.68): they are
 * not claimed to be issued.
 */
describe("parseCallsign — base callsigns", () => {
  it.each([
    "W1AW",
    "4U1ITU",
    "4U1UN",
    "1A0KM",
    "K1A", // one-letter prefix, one-letter suffix
    "I0ABC", // one-letter prefix (Italy)
    "IZ0ABC",
    "IU8ABC",
    "2E0ABC", // digit-letter prefix (UK)
    "9A1AA", // digit-letter prefix
    "3DA0AB", // three-character prefix
    "VP2EAB", // prefix VP2E read as VP + 2
    "T88AB", // letter prefix followed by digit, suffix starting with a digit
    "OL100TT", // special event, digits in the suffix (RR 19.68A)
    "II2ABCDE", // special event, long suffix
  ])("accepts %s", (callsign) => {
    expect(parts(callsign)).toEqual({ callsign, base: callsign });
    expect(isCallsign(callsign)).toBe(true);
  });

  it.each([
    ["ABC", "no digit"],
    ["1234A", "no letter in the prefix"],
    ["W1", "no suffix"],
    ["W1A1", "suffix ending with a digit"],
    ["1ABC", "digit with nothing before it"],
    ["IZ0ABCDEFGH", "suffix longer than seven characters"],
    ["ABCD1AB", "prefix longer than three characters"],
  ])("rejects %s (%s)", (callsign) => {
    expect(codeOf(callsign)).toBe("callsign.invalid-format");
  });
});

describe("parseCallsign — normalisation and characters", () => {
  it("upper-cases, trims and removes inner spaces", () => {
    expect(parts(" iz0abc ").callsign).toBe("IZ0ABC");
    expect(parts("iz0 abc / p").callsign).toBe("IZ0ABC/P");
    expect(normalizeCallsign("\tw1aw\n")).toBe("W1AW");
  });

  it("maps the slashed zero Ø to 0", () => {
    expect(parts("IZØABC").callsign).toBe("IZ0ABC");
    expect(parts("izøabc").callsign).toBe("IZ0ABC");
  });

  it.each([
    ["", "callsign.empty"],
    ["   ", "callsign.empty"],
    ["IZ0-ABC", "callsign.invalid-characters"],
    ["IZ0ABC.", "callsign.invalid-characters"],
    ["IZ0ÀBC", "callsign.invalid-characters"],
    ["IZ0ABCIZ0ABCIZ0ABCIZ0ABC1", "callsign.too-long"], // 25 characters
  ])("rejects %j with %s", (text, code) => {
    expect(codeOf(text)).toBe(code);
  });

  it("isCallsign rejects non-normalised strings and non-strings", () => {
    expect(isCallsign("iz0abc")).toBe(false);
    expect(isCallsign(" IZ0ABC")).toBe(false);
    expect(isCallsign(null)).toBe(false);
    expect(isCallsign(42)).toBe(false);
  });
});

describe("parseCallsign — portable prefixes and suffixes", () => {
  it.each([
    ["IZ0ABC/P", "P", "portable"],
    ["IZ0ABC/M", "M", "mobile"],
    ["IZ0ABC/MM", "MM", "maritime-mobile"],
    ["IZ0ABC/AM", "AM", "aeronautical-mobile"],
  ])("%s has condition %s → %s", (callsign, suffix, condition) => {
    expect(parts(callsign)).toEqual({
      callsign,
      base: "IZ0ABC",
      suffix,
      condition,
    });
  });

  it.each([
    ["IZ0ABC/QRP", "QRP"],
    ["IZ0ABC/A", "A"],
    ["IZ0ABC/LH", "LH"],
    ["W1AW/4", "4"], // US call area
    ["W1AW/KH6", "KH6"], // location written as a suffix
  ])("%s has suffix %s without operating condition", (callsign, suffix) => {
    expect(parts(callsign)).toEqual({
      callsign,
      base: callsign.split("/")[0],
      suffix,
    });
  });

  it.each([
    ["HB9/IZ0ABC", "HB9"],
    ["F/IZ0ABC", "F"],
    ["EA8/IZ0ABC", "EA8"],
    ["3D2/IZ0ABC", "3D2"],
  ])("%s has location prefix %s (CEPT form)", (callsign, prefix) => {
    expect(parts(callsign)).toEqual({ callsign, base: "IZ0ABC", prefix });
  });

  it("accepts the longest valid combination (21 characters)", () => {
    // 4-char prefix + 11-char callsign (3 + 1 + 7) + 4-char suffix.
    expect(parts("VP2E/3DA0ABCDEFG/QRPP").callsign).toHaveLength(21);
  });

  it("accepts prefix, callsign and suffix together", () => {
    expect(parts("HB9/IZ0ABC/P")).toEqual({
      callsign: "HB9/IZ0ABC/P",
      prefix: "HB9",
      base: "IZ0ABC",
      suffix: "P",
      condition: "portable",
    });
  });

  it("reads the first token as prefix when both could be callsigns", () => {
    // Documented limitation: only DXCC data (M10) can disambiguate.
    expect(parts("VP2E/W1AW")).toMatchObject({ prefix: "VP2E", base: "W1AW" });
  });

  it.each([
    "IZ0ABC/",
    "/IZ0ABC",
    "IZ0ABC//P",
    "HB9/F/IZ0ABC",
    "IZ0ABC/P/M/X",
    "HB9/IZ0ABC/P/M",
    "IZ0ABC/PORTABLE",
    "IZ0ABC/12",
    "HB9/W1",
    "W1AW/IZ0ABC/P/", // trailing slash
  ])("rejects %s", (text) => {
    expect(codeOf(text)).toBe("callsign.invalid-format");
  });
});
