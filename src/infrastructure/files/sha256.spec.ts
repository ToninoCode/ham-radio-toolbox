// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Sha256, sha256Hex } from "./sha256";

/*
 * Reference values: FIPS 180-4 examples (NIST CSRC "SHA256.pdf") and the
 * long message of the NIST test vectors (one million "a"). Random data is
 * cross-checked against the Web Crypto API of Node.
 */

const ascii = (text: string) => new TextEncoder().encode(text);

describe("Sha256", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ])("hashes %j as in FIPS 180-4", (message, expected) => {
    expect(sha256Hex(ascii(message))).toBe(expected);
  });

  it("hashes one million 'a' fed in uneven chunks", () => {
    const hash = new Sha256();
    const chunk = new Uint8Array(997).fill(0x61);
    let remaining = 1_000_000;
    while (remaining > 0) {
      const size = Math.min(chunk.length, remaining);
      hash.update(chunk.subarray(0, size));
      remaining -= size;
    }
    expect(hash.hex()).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });

  it("matches Web Crypto on random data split at every block boundary", async () => {
    const data = crypto.getRandomValues(new Uint8Array(4099));
    const expected = Buffer.from(
      await crypto.subtle.digest("SHA-256", data),
    ).toString("hex");
    for (const split of [0, 1, 55, 56, 63, 64, 65, 128, 4098]) {
      const hash = new Sha256()
        .update(data.subarray(0, split))
        .update(data.subarray(split));
      expect(hash.hex(), `split at ${split}`).toBe(expected);
    }
  });

  it("refuses updates after the digest", () => {
    const hash = new Sha256();
    hash.hex();
    expect(() => hash.update(ascii("x"))).toThrow("already finalised");
  });
});
