/**
 * Generates the PWA icons in public/ from the antenna glyph of
 * src/shared/ui/icons.ts, rasterised with the Chromium bundled with
 * Playwright (no image dependency needed).
 *
 * Usage: npm run icons  — then commit the files in public/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

// Dark theme tokens (src/shared/ui/styles/main.css): --hrt-canvas, --hrt-accent.
const BACKGROUND = "#0b1120";
const GLYPH = "#8fb8ff";

// Antenna glyph on a 24×24 grid (same as ICONS.antenna).
const ANTENNA_PATHS = [
  "M10.5 8.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0",
  "M8.5 5a5 5 0 0 0 0 7",
  "M15.5 5a5 5 0 0 1 0 7",
  "M5.5 2.5a9 9 0 0 0 0 12",
  "M18.5 2.5a9 9 0 0 1 0 12",
  "M12 10v11",
  "M9 21h6",
];

/**
 * @param {object} options
 * @param {number} options.glyphRatio  glyph size relative to the icon
 * @param {number} options.cornerRatio corner radius relative to the icon (0 = full bleed)
 */
function iconSvg({ glyphRatio, cornerRatio }) {
  const size = 512;
  const glyph = size * glyphRatio;
  const offset = (size - glyph) / 2;
  const scale = glyph / 24;
  const paths = ANTENNA_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" rx="${size * cornerRatio}" fill="${BACKGROUND}"/>
<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${GLYPH}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>
`;
}

/** Rounded icon for `purpose: any`, favicon and Apple touch icon. */
const ANY = iconSvg({ glyphRatio: 0.64, cornerRatio: 0.1875 });
/**
 * Full-bleed icon for `purpose: maskable`: the glyph stays inside the
 * central safe zone (circle of radius 40 %), here within 50 % of the side.
 */
const MASKABLE = iconSvg({ glyphRatio: 0.5, cornerRatio: 0 });
const APPLE = iconSvg({ glyphRatio: 0.64, cornerRatio: 0 });

const OUTPUTS = [
  { file: "icons/icon-192.png", svg: ANY, size: 192 },
  { file: "icons/icon-512.png", svg: ANY, size: 512 },
  { file: "icons/icon-maskable-512.png", svg: MASKABLE, size: 512 },
  { file: "icons/apple-touch-icon-180.png", svg: APPLE, size: 180 },
];

await mkdir(new URL("icons/", `file://${PUBLIC_DIR}`), { recursive: true });
await writeFile(`${PUBLIC_DIR}favicon.svg`, ANY);

const browser = await chromium.launch();
try {
  for (const { file, svg, size } of OUTPUTS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const html = `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
    await page.setContent(html);
    await page.screenshot({
      path: `${PUBLIC_DIR}${file}`,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`public/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
console.log("public/favicon.svg");
