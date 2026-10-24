// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64, encodeBase64Bytes } from "./base64";

/* Reference values: RFC 4648 § 10 test vectors. */

const ascii = (text: string) => new TextEncoder().encode(text);

describe("base64", () => {
  it.each([
    ["", ""],
    ["f", "Zg=="],
    ["fo", "Zm8="],
    ["foo", "Zm9v"],
    ["foob", "Zm9vYg=="],
    ["fooba", "Zm9vYmE="],
    ["foobar", "Zm9vYmFy"],
  ])("encodes and decodes %j as RFC 4648", (plain, encoded) => {
    expect(encodeBase64(ascii(plain))).toBe(encoded);
    const decoded = decodeBase64(encoded);
    expect(decoded.ok && new TextDecoder().decode(decoded.value)).toBe(plain);
  });

  it("round-trips random binary data and matches Node's encoder", () => {
    for (const size of [1, 2, 3, 255, 256, 4097]) {
      const data = crypto.getRandomValues(new Uint8Array(size));
      const encoded = encodeBase64(data);
      expect(encoded).toBe(Buffer.from(data).toString("base64"));
      expect(decodeBase64(encoded)).toEqual({ ok: true, value: data });
    }
  });

  it("produces ASCII bytes", () => {
    expect(Array.from(encodeBase64Bytes(ascii("fo")))).toEqual(
      Array.from(ascii("Zm8=")),
    );
  });

  it.each([
    ["length not a multiple of 4", "Zm9"],
    ["character outside the alphabet", "Zm9*"],
    ["URL-safe alphabet", "-_8="],
    ["whitespace", "Zm9v\nYmFy"],
    ["padding in the middle", "Zg==Zm9v"],
    ["non-zero unused bits", "Zh=="],
    ["non-ASCII character", "Zm9é"],
  ])("rejects %s", (_label, text) => {
    expect(decodeBase64(text)).toEqual({
      ok: false,
      error: { code: "base64.invalid" },
    });
  });
});
