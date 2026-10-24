import { err, ok, type DomainError, type Result } from "@/shared/types";

/*
 * Base64 (RFC 4648 § 4, standard alphabet, with padding) for attachments in
 * backups (ADR-0009, DATABASE.md § 9.1). Encoding produces ASCII bytes that
 * the backup writer hashes and stores without building one large string;
 * decoding is strict, so that every content has exactly one representation
 * and a restored file is byte-identical to the exported one.
 */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const PAD = 0x3d; // "="

const ENCODE = Uint8Array.from(ALPHABET, (char) => char.charCodeAt(0));
const DECODE = new Int16Array(128).fill(-1);
for (let i = 0; i < ENCODE.length; i++) DECODE[ENCODE[i]!] = i;

export type Base64Error = DomainError<"base64.invalid">;

/** Base64 of `bytes` as ASCII bytes (4 output bytes per 3 input bytes). */
export function encodeBase64Bytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(Math.ceil(bytes.length / 3) * 4);
  let o = 0;
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out[o++] = ENCODE[n >>> 18]!;
    out[o++] = ENCODE[(n >>> 12) & 63]!;
    out[o++] = ENCODE[(n >>> 6) & 63]!;
    out[o++] = ENCODE[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest > 0) {
    const n = (bytes[i]! << 16) | (rest === 2 ? bytes[i + 1]! << 8 : 0);
    out[o++] = ENCODE[n >>> 18]!;
    out[o++] = ENCODE[(n >>> 12) & 63]!;
    out[o++] = rest === 2 ? ENCODE[(n >>> 6) & 63]! : PAD;
    out[o] = PAD;
  }
  return out;
}

/** Base64 of `bytes` as a string. */
export function encodeBase64(bytes: Uint8Array): string {
  return new TextDecoder().decode(encodeBase64Bytes(bytes));
}

/**
 * Decodes canonical base64: length multiple of 4, standard alphabet, no
 * whitespace, padding only at the end and unused bits set to zero.
 */
export function decodeBase64(
  text: string,
): Result<Uint8Array<ArrayBuffer>, Base64Error> {
  const invalid = err({ code: "base64.invalid" } as const);
  if (text.length % 4 !== 0) return invalid;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - padding);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const last = i + 4 === text.length;
    const c0 = sextet(text, i);
    const c1 = sextet(text, i + 1);
    const c2 = last && padding === 2 ? 0 : sextet(text, i + 2);
    const c3 = last && padding >= 1 ? 0 : sextet(text, i + 3);
    if ((c0 | c1 | c2 | c3) < 0) return invalid;
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out[o++] = n >>> 16;
    if (last && padding === 2) {
      if ((n & 0xffff) !== 0) return invalid;
      break;
    }
    out[o++] = (n >>> 8) & 0xff;
    if (last && padding === 1) {
      if ((n & 0xff) !== 0) return invalid;
      break;
    }
    out[o++] = n & 0xff;
  }
  return ok(out);
}

function sextet(text: string, index: number): number {
  const code = text.charCodeAt(index);
  return code < 128 ? DECODE[code]! : -1;
}
