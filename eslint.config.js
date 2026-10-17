// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import architecture from "./eslint/no-cross-boundary-relative-import.js";

/*
 * Layer dependency rules (ADR-0004, ARCHITECTURE.md § 3).
 *
 * Implemented with the core `no-restricted-imports` / `no-restricted-globals`
 * rules, matched by file path. ESLint does not merge the options of the same
 * rule across config objects (the last matching object wins), so every layer
 * lists the complete set of restrictions it needs.
 *
 * Verified by tests/integration/eslint-layer-rules.spec.ts.
 */

/** @typedef {{ regex: string; message: string }} RestrictedPattern */

/** @type {Record<string, RestrictedPattern>} */
const forbid = {
  dexie: {
    regex: "^dexie(/.*)?$",
    message:
      "Dexie may only be used in infrastructure layers (ADR-0004): depend on a repository port instead.",
  },
  vue: {
    regex: "^(vue|vue-router|pinia|@vue/.*)$",
    message:
      "Domain and application layers must not depend on Vue, Vue Router or Pinia (ADR-0004).",
  },
  application: {
    regex: "(^|/)application(/|$)",
    message:
      "The domain layer must not depend on the application layer (dependencies point inwards).",
  },
  infrastructure: {
    regex: "(^|/)infrastructure(/|$)",
    message:
      "This layer must not import infrastructure adapters: depend on a port, wired in src/app (ADR-0004).",
  },
  providers: {
    regex: "(^|/)providers(/|$)",
    message:
      "This layer must not import provider adapters: depend on a port, wired in src/app (ADR-0004).",
  },
  presentation: {
    regex: "(^|/)presentation(/|$)",
    message:
      "Inner layers must not depend on the presentation layer (dependencies point inwards).",
  },
  appRoot: {
    regex: "^@/app(/|$)",
    message:
      "Only the composition root may know src/app; inner layers receive dependencies through ports.",
  },
  sharedPresentation: {
    regex: "^@/shared/(ui|i18n|composables)(/|$)",
    message:
      "Pure domain code must not depend on UI components, i18n or composables (ADR-0004).",
  },
  modules: {
    regex: "^@/modules(/|$)",
    message: "Shared code (core, shared) must not depend on feature modules.",
  },
  moduleInternals: {
    regex: "^@/modules/[^/]+/.+",
    message:
      "Use another module only through its public index.ts (@/modules/<name>); inside a module use relative imports.",
  },
};

/** @param {RestrictedPattern[]} patterns */
const restrictImports = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const BROWSER_GLOBALS_MESSAGE =
  "Domain and application code must stay free of browser APIs: inject a port (Clock, IdGenerator, StorageInfo, DataProvider…).";

const restrictBrowserGlobals = {
  "no-restricted-globals": [
    "error",
    ...[
      "window",
      "document",
      "navigator",
      "location",
      "fetch",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "caches",
    ].map((name) => ({ name, message: BROWSER_GLOBALS_MESSAGE })),
  ],
};

const UI_TEXT_PROPERTIES =
  "/^(label|title|description|placeholder|ariaLabel|legend|message|text|tooltip|heading|caption)$/";
const HAS_WORD = "/[A-Za-zÀ-ÿ]{2,}/";
const UI_TEXT_MESSAGE =
  "UI text must come from the typed i18n catalog: use t('…') (NFR-I18N-01, ADR-0008).";

const DOMAIN_FILES = ["src/core/**", "src/modules/*/domain/**"];
const APPLICATION_FILES = ["src/modules/*/application/**"];
const PRESENTATION_FILES = ["src/modules/*/presentation/**"];
const INFRASTRUCTURE_FILES = [
  "src/infrastructure/**",
  "src/modules/*/infrastructure/**",
];
const PROVIDER_FILES = ["src/infrastructure/providers/**"];

export default defineConfig(
  globalIgnores([
    "dist/",
    "dist-ssr/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    "blob-report/",
    "docs/references/",
    ".wrangler/",
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs["flat/recommended"],

  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },

  {
    files: ["src/**"],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ["*.{js,ts}", "eslint/**", "scripts/**", "tests/**"],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      "vue/multi-word-component-names": ["error", { ignores: ["App"] }],
      // UI text comes from the typed i18n catalog only (NFR-I18N-01, ADR-0008).
      "vue/no-bare-strings-in-template": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // UI text in scripts (NFR-I18N-01): literal text assigned to the
    // properties that carry user-facing text (labels of options, titles…).
    // Deliberately narrow, to avoid false positives on identifiers, CSS
    // classes or event names. Template text is covered by
    // vue/no-bare-strings-in-template.
    name: "i18n/script-strings",
    files: ["src/**/*.vue", "src/**/presentation/**/*.ts", "src/app/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Property[key.name=${UI_TEXT_PROPERTIES}] > Literal[value=${HAS_WORD}]`,
          message: UI_TEXT_MESSAGE,
        },
        {
          selector: `AssignmentExpression[left.property.name=/^(title|textContent|innerText)$/] > Literal.right[value=${HAS_WORD}]`,
          message: UI_TEXT_MESSAGE,
        },
      ],
    },
  },

  // --- Layer rules (order matters: later objects override earlier ones) ---

  {
    name: "layers/relative-imports",
    files: ["src/**"],
    plugins: { hrt: architecture },
    rules: { "hrt/no-cross-boundary-relative-import": "error" },
  },

  {
    name: "layers/default",
    files: ["src/**"],
    rules: restrictImports(forbid.dexie, forbid.moduleInternals),
  },
  {
    name: "layers/composition-root",
    files: ["src/app/**"],
    rules: restrictImports(forbid.dexie),
  },
  {
    name: "layers/shared",
    files: ["src/shared/**"],
    rules: restrictImports(
      forbid.dexie,
      forbid.modules,
      forbid.appRoot,
      forbid.infrastructure,
      forbid.providers,
    ),
  },
  {
    name: "layers/domain",
    files: DOMAIN_FILES,
    rules: {
      ...restrictImports(
        forbid.dexie,
        forbid.vue,
        forbid.application,
        forbid.infrastructure,
        forbid.providers,
        forbid.presentation,
        forbid.appRoot,
        forbid.sharedPresentation,
        forbid.moduleInternals,
      ),
      ...restrictBrowserGlobals,
    },
  },
  {
    name: "layers/core",
    files: ["src/core/**"],
    rules: {
      ...restrictImports(
        forbid.dexie,
        forbid.vue,
        forbid.application,
        forbid.infrastructure,
        forbid.providers,
        forbid.presentation,
        forbid.appRoot,
        forbid.sharedPresentation,
        forbid.modules,
      ),
      ...restrictBrowserGlobals,
    },
  },
  {
    name: "layers/application",
    files: APPLICATION_FILES,
    rules: {
      ...restrictImports(
        forbid.dexie,
        forbid.vue,
        forbid.infrastructure,
        forbid.providers,
        forbid.presentation,
        forbid.appRoot,
        forbid.moduleInternals,
      ),
      ...restrictBrowserGlobals,
    },
  },
  {
    name: "layers/presentation",
    files: PRESENTATION_FILES,
    rules: restrictImports(
      forbid.dexie,
      forbid.infrastructure,
      forbid.providers,
      forbid.moduleInternals,
    ),
  },
  {
    name: "layers/infrastructure",
    files: INFRASTRUCTURE_FILES,
    rules: restrictImports(
      forbid.presentation,
      forbid.appRoot,
      forbid.moduleInternals,
    ),
  },
  {
    name: "layers/providers",
    files: PROVIDER_FILES,
    rules: restrictImports(
      forbid.dexie,
      forbid.presentation,
      forbid.appRoot,
      forbid.moduleInternals,
    ),
  },

  prettier,
);
