import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { it as messages } from "./src/shared/i18n/messages/it.ts";

/** Dark theme canvas (`--hrt-canvas`, THEME_COLORS.dark): icon and splash background. */
const THEME_COLOR = "#0b1120";

/**
 * Identifies the build in `<meta name="build-id">` for diagnostics. CI sets
 * HRT_BUILD_ID (e.g. the commit SHA); local builds use "local". Different ids
 * produce a different precache manifest, hence a service worker update.
 */
function buildId(): Plugin {
  const id = process.env["HRT_BUILD_ID"] ?? "local";
  return {
    name: "hrt-build-id",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { name: "build-id", content: id },
        injectTo: "head",
      },
    ],
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    buildId(),
    // PWA: ARCHITECTURE.md § 8, BL-M1-11.
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      // Registration through `virtual:pwa-register/vue` (src/app/pwa).
      injectRegister: false,
      // Static assets are precached by `workbox.globPatterns` only, so each
      // URL appears once in the precache manifest.
      includeManifestIcons: false,
      manifest: {
        id: "/",
        name: messages.app.name,
        short_name: messages.app.shortName,
        description: messages.app.tagline,
        lang: "it",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        categories: ["utilities", "education"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App shell, lazy module chunks, styles and icons: everything the
        // build produces is precached with a revision (cache versioning).
        // The plugin adds manifest.webmanifest itself.
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        // Offline deep links: every navigation is served by index.html.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // First install controls the page at once; an update instead waits
        // for the user's confirmation (no skipWaiting).
        clientsClaim: true,
        skipWaiting: false,
        // No runtimeCaching: no external source is used in M1. OSM tiles and
        // the HamQSL banner get their own bounded rules in M8/M12.
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
