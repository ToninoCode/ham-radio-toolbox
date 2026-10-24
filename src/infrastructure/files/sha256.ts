/*
 * Incremental SHA-256 (FIPS 180-4). The Web Crypto API only hashes a whole
 * buffer at once; backups are written and read progressively, so their
 * checksums are computed chunk by chunk with this implementation
 * (ADR-0015). Attachments and import files, which fit in memory, keep using
 * `crypto.subtle.digest` (ContentHasher).
 */

// prettier-ignore
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// prettier-ignore
const INITIAL_STATE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const BLOCK_BYTES = 64;

/** Streaming SHA-256: `update` any number of times, then `hex()` once. */
export class Sha256 {
  readonly #state = new Uint32Array(INITIAL_STATE);
  readonly #words = new Uint32Array(64);
  readonly #block = new Uint8Array(BLOCK_BYTES);
  #blockLength = 0;
  #totalBytes = 0;
  #finished = false;

  update(data: Uint8Array): this {
    if (this.#finished) throw new Error("SHA-256 already finalised");
    this.#totalBytes += data.length;
    let offset = 0;
    if (this.#blockLength > 0) {
      const take = Math.min(BLOCK_BYTES - this.#blockLength, data.length);
      this.#block.set(data.subarray(0, take), this.#blockLength);
      this.#blockLength += take;
      offset = take;
      if (this.#blockLength < BLOCK_BYTES) return this;
      this.#compress(this.#block, 0);
      this.#blockLength = 0;
    }
    while (offset + BLOCK_BYTES <= data.length) {
      this.#compress(data, offset);
      offset += BLOCK_BYTES;
    }
    if (offset < data.length) {
      this.#block.set(data.subarray(offset));
      this.#blockLength = data.length - offset;
    }
    return this;
  }

  /** Final digest (32 bytes). The hash cannot be updated afterwards. */
  digest(): Uint8Array {
    if (this.#finished) throw new Error("SHA-256 already finalised");
    const bitsHigh = Math.floor((this.#totalBytes * 8) / 0x1_0000_0000);
    const bitsLow = (this.#totalBytes * 8) >>> 0;
    const padding = new Uint8Array(
      (this.#blockLength < 56 ? 56 : 120) - this.#blockLength + 8,
    );
    padding[0] = 0x80;
    const view = new DataView(padding.buffer);
    view.setUint32(padding.length - 8, bitsHigh);
    view.setUint32(padding.length - 4, bitsLow);
    this.update(padding);
    this.#finished = true;

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    this.#state.forEach((word, i) => outView.setUint32(i * 4, word));
    return out;
  }

  /** Final digest as lower-case hex. */
  hex(): string {
    return Array.from(this.digest(), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  #compress(data: Uint8Array, offset: number): void {
    const w = this.#words;
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] =
        ((data[j]! << 24) |
          (data[j + 1]! << 16) |
          (data[j + 2]! << 8) |
          data[j + 3]!) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]!;
      const y = w[i - 2]!;
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 =
        ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    const s = this.#state;
    let a = s[0]!;
    let b = s[1]!;
    let c = s[2]!;
    let d = s[3]!;
    let e = s[4]!;
    let f = s[5]!;
    let g = s[6]!;
    let h = s[7]!;
    for (let i = 0; i < 64; i++) {
      const s1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + K[i]! + w[i]!) >>> 0;
      const s0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    s[0] = (s[0]! + a) >>> 0;
    s[1] = (s[1]! + b) >>> 0;
    s[2] = (s[2]! + c) >>> 0;
    s[3] = (s[3]! + d) >>> 0;
    s[4] = (s[4]! + e) >>> 0;
    s[5] = (s[5]! + f) >>> 0;
    s[6] = (s[6]! + g) >>> 0;
    s[7] = (s[7]! + h) >>> 0;
  }
}

/** SHA-256 of a byte array, lower-case hex. */
export function sha256Hex(data: Uint8Array): string {
  return new Sha256().update(data).hex();
}
