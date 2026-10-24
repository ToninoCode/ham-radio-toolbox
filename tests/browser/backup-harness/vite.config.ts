import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/*
 * Build of the backup harness (tests/e2e/backup-browser.spec.ts): the real
 * backup code bundled for production and served by `vite preview` with the
 * Content-Security-Policy of public/_headers, so the browser enforces the
 * same policy as Cloudflare Pages.
 */

const headers = readFileSync(
  new URL("../../../public/_headers", import.meta.url),
  "utf8",
);
const csp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1]?.trim();
if (!csp) throw new Error("No Content-Security-Policy in public/_headers");

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  // The container imports the modules' public API, whose manifests reference
  // lazy .vue views (never loaded by the harness, but bundled).
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("../../../src", import.meta.url)) },
  },
  define: { __APP_VERSION__: JSON.stringify("0.0.0-harness") },
  build: {
    outDir: fileURLToPath(
      new URL("../../../node_modules/.tmp/e2e-backup-harness", import.meta.url),
    ),
    emptyOutDir: true,
  },
  preview: { headers: { "Content-Security-Policy": csp } },
  logLevel: "error",
});
