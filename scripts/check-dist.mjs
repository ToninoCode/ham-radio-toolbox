/**
 * Post-build checks on dist/ (ADR-0011, ARCHITECTURE.md § 11–12):
 * - no top-level 404.html (it would disable the Cloudflare Pages SPA fallback);
 * - _headers, service worker and manifest present;
 * - no secret-looking strings in the published files (CON-04).
 *
 * Usage: npm run check:dist [-- <dir>]   (default: dist)
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? "dist");

/** Patterns of credentials that must never reach the bundle. */
const SECRET_PATTERNS = [
  { name: "private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  {
    name: "Cloudflare credential variable",
    regex: /CLOUDFLARE_(API_TOKEN|ACCOUNT_ID)/,
  },
  {
    name: "assigned secret",
    regex:
      /\b(api[_-]?key|secret|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i,
  },
];

const TEXT_FILE =
  /\.(html|js|mjs|css|json|webmanifest|txt|svg|map)$|^_headers$/;

async function* walk(current) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const problems = [];

if (!existsSync(dir)) {
  console.error(`check-dist: ${dir} does not exist, run the build first`);
  process.exit(1);
}
if (existsSync(path.join(dir, "404.html"))) {
  problems.push("404.html in the output disables the Pages SPA fallback");
}
for (const required of [
  "index.html",
  "_headers",
  "sw.js",
  "manifest.webmanifest",
]) {
  if (!existsSync(path.join(dir, required)))
    problems.push(`missing ${required}`);
}

let scanned = 0;
for await (const file of walk(dir)) {
  if (!TEXT_FILE.test(path.basename(file))) continue;
  scanned++;
  const content = await readFile(file, "utf8");
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) {
      problems.push(`${name} in ${path.relative(dir, file)}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`check-dist: ${problems.length} problem(s) in ${dir}`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`check-dist: OK (${scanned} text files scanned in ${dir})`);
