// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { it as messages } from "@/shared/i18n/messages/it";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Width and height from the IHDR chunk of a PNG file. */
async function pngSize(path: string) {
  const bytes = await readFile(`${ROOT}${path}`);
  const signature = bytes.subarray(0, 8).toString("hex");
  expect(signature, `${path} is a PNG`).toBe("89504e470d0a1a0a");
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("PWA icons in public/", () => {
  it.each([
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/icon-maskable-512.png", 512],
    ["public/icons/apple-touch-icon-180.png", 180],
  ])("%s is a %i×%i PNG", async (path, size) => {
    expect(await pngSize(path)).toEqual({ width: size, height: size });
  });

  it("has an SVG favicon", async () => {
    const svg = await readFile(`${ROOT}public/favicon.svg`, "utf8");
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 512 512"/);
  });
});

describe("index.html metadata", () => {
  it("matches the i18n catalog and the PWA settings", async () => {
    const html = await readFile(`${ROOT}index.html`, "utf8");
    expect(html).toContain('<html lang="it">');
    expect(html).toContain(`<title>${messages.app.name}</title>`);
    expect(html.replace(/\s+/g, " ")).toContain(
      `name="description" content="${messages.app.tagline}"`,
    );
    expect(html).toContain('<meta name="theme-color" content="#0b1120" />');
    expect(html).toContain('href="/icons/apple-touch-icon-180.png"');
  });
});
