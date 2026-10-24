import type { ContentHasher } from "@/shared/application";

/**
 * SHA-256 with `crypto.subtle.digest` (ADR-0009). The whole file is read in
 * memory: acceptable within the attachment limit (20 MB by default).
 */
export const webCryptoContentHasher: ContentHasher = {
  async sha256(content) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await content.arrayBuffer(),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  },
};
