// @vitest-environment node
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Negative tests for the layer dependency rules defined in eslint.config.js
 * (ADR-0004, ARCHITECTURE.md § 3, M1 acceptance criterion "Regole ESLint di
 * layer attive e verificate da un test negativo").
 *
 * The code is linted in memory with a virtual file path: no file is written
 * to src/, so the cases do not depend on modules that will exist later.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: ROOT });
});

async function layerViolations(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`No lint result for ${filePath}`);
  const fatal = result.messages.filter((m) => m.fatal);
  expect(fatal, "the snippet must parse").toEqual([]);
  return result.messages
    .filter(
      (m) =>
        m.ruleId === "no-restricted-imports" ||
        m.ruleId === "no-restricted-globals",
    )
    .map((m) => m.ruleId);
}

describe("layer rules: forbidden dependencies are reported", () => {
  it.each([
    [
      "domain → dexie",
      "src/modules/ham-logbook/domain/qso.ts",
      'import Dexie from "dexie";\nexport const db = Dexie;\n',
    ],
    [
      "domain → vue",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { ref } from "vue";\nexport const value = ref(0);\n',
    ],
    [
      "domain → application",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { createQso } from "../application/create-qso";\nexport const useCase = createQso;\n',
    ],
    [
      "domain → infrastructure",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { repo } from "../infrastructure/dexie-qso-repository";\nexport const r = repo;\n',
    ],
    [
      "domain → shared/ui",
      "src/modules/ham-logbook/domain/qso.ts",
      'import Button from "@/shared/ui/AppButton.vue";\nexport const b = Button;\n',
    ],
    [
      "core → feature module",
      "src/core/frequency/band.ts",
      'import { routes } from "@/modules/ham-logbook";\nexport const r = routes;\n',
    ],
    [
      "core → vue",
      "src/core/locator/maidenhead.ts",
      'import { ref } from "vue";\nexport const value = ref(0);\n',
    ],
    [
      "core → dexie",
      "src/core/validation/schemas.ts",
      'import Dexie from "dexie";\nexport const d = Dexie;\n',
    ],
    [
      "core → shared/i18n",
      "src/core/reports/sinpo.ts",
      'import { t } from "@/shared/i18n";\nexport const label = t;\n',
    ],
    [
      "core → browser global (fetch)",
      "src/core/frequency/band-plan.ts",
      'export const load = () => fetch("https://example.org");\n',
    ],
    [
      "application → dexie",
      "src/modules/swl-logbook/application/create-reception.ts",
      'import { liveQuery } from "dexie";\nexport const q = liveQuery;\n',
    ],
    [
      "application → pinia",
      "src/modules/swl-logbook/application/create-reception.ts",
      'import { defineStore } from "pinia";\nexport const s = defineStore;\n',
    ],
    [
      "application → infrastructure",
      "src/modules/swl-logbook/application/create-reception.ts",
      'import { db } from "@/infrastructure/db/app-database";\nexport const d = db;\n',
    ],
    [
      "application → presentation",
      "src/modules/swl-logbook/application/create-reception.ts",
      'import { useStore } from "../presentation/store";\nexport const s = useStore;\n',
    ],
    [
      "presentation → dexie",
      "src/modules/ham-logbook/presentation/store.ts",
      'import Dexie from "dexie";\nexport const d = Dexie;\n',
    ],
    [
      "presentation → infrastructure",
      "src/modules/ham-logbook/presentation/store.ts",
      'import { repo } from "../infrastructure/dexie-qso-repository";\nexport const r = repo;\n',
    ],
    [
      "presentation → providers",
      "src/modules/frequency-explorer/presentation/store.ts",
      'import { eibi } from "@/infrastructure/providers/eibi";\nexport const p = eibi;\n',
    ],
    [
      "presentation (.vue) → dexie",
      "src/modules/ham-logbook/presentation/views/QsoListView.vue",
      '<script setup lang="ts">\nimport Dexie from "dexie";\nconst d = Dexie;\n</script>\n\n<template>\n  <div :data-d="String(d)"></div>\n</template>\n',
    ],
    [
      "infrastructure → presentation",
      "src/modules/ham-logbook/infrastructure/dexie-qso-repository.ts",
      'import { useStore } from "../presentation/store";\nexport const s = useStore;\n',
    ],
    [
      "provider → dexie",
      "src/infrastructure/providers/celestrak.ts",
      'import Dexie from "dexie";\nexport const d = Dexie;\n',
    ],
    [
      "shared → feature module",
      "src/shared/utils/format.ts",
      'import { routes } from "@/modules/dashboard";\nexport const r = routes;\n',
    ],
    [
      "composition root → dexie",
      "src/app/container.ts",
      'import Dexie from "dexie";\nexport const d = Dexie;\n',
    ],
    [
      "module → internals of another module",
      "src/modules/swl-logbook/presentation/store.ts",
      'import { x } from "@/modules/frequency-explorer/application/find-scheduled-at";\nexport const f = x;\n',
    ],
    [
      "domain → browser global (navigator)",
      "src/core/time/now.ts",
      "export const online = () => navigator.onLine;\n",
    ],
    [
      "application → browser global (fetch)",
      "src/modules/satellite-explorer/application/refresh.ts",
      'export const load = () => fetch("https://example.org");\n',
    ],
    [
      "shared/application → dexie",
      "src/shared/application/unit-of-work.ts",
      'import Dexie from "dexie";\nexport const d = Dexie;\n',
    ],
    [
      "shared/application → infrastructure",
      "src/shared/application/unit-of-work.ts",
      'import { AppDatabase } from "@/infrastructure/db";\nexport const d = AppDatabase;\n',
    ],
    [
      "shared/application → feature module",
      "src/shared/application/backup.ts",
      'import { qsoLogSchema } from "@/modules/ham-logbook";\nexport const s = qsoLogSchema;\n',
    ],
    [
      "shared/application → browser global (indexedDB)",
      "src/shared/application/storage-info.ts",
      "export const factory = () => indexedDB;\n",
    ],
    [
      "domain → shared/application",
      "src/modules/ham-logbook/domain/qso-log.ts",
      'import { notFound } from "@/shared/application";\nexport const n = notFound;\n',
    ],
    [
      "core → shared/application",
      "src/core/attachment/attachment.ts",
      'import type { UnitOfWork } from "@/shared/application";\nexport type U = UnitOfWork;\n',
    ],
  ])("%s", async (_label, filePath, code) => {
    const violations = await layerViolations(filePath, code);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("layer rules: allowed dependencies are not reported", () => {
  it.each([
    [
      "domain → zod and core",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { z } from "zod";\nimport { hz } from "@/core/validation";\nexport const schema = z.object({ frequencyHz: hz });\n',
    ],
    [
      "core → zod, other core modules and shared/types",
      "src/core/validation/schemas.ts",
      'import { z } from "zod";\nimport { parseLocator } from "@/core/locator";\nimport { ok, type Result } from "@/shared/types";\nexport const s = z.string();\nexport const p = parseLocator;\nexport const r: Result<number, never> = ok(1);\n',
    ],
    [
      "application → own domain",
      "src/modules/ham-logbook/application/create-qso.ts",
      'import { schema } from "../domain/qso";\nexport const parse = schema;\n',
    ],
    [
      "infrastructure → dexie",
      "src/infrastructure/db/app-database.ts",
      'import Dexie from "dexie";\nexport class AppDatabase extends Dexie {}\n',
    ],
    [
      "module infrastructure → dexie and own domain",
      "src/modules/ham-logbook/infrastructure/dexie-qso-repository.ts",
      'import type { Table } from "dexie";\nimport type { QsoLog } from "../domain/qso";\nexport type QsoTable = Table<QsoLog, string>;\n',
    ],
    [
      "presentation → vue, pinia and own application",
      "src/modules/ham-logbook/presentation/store.ts",
      'import { ref } from "vue";\nimport { defineStore } from "pinia";\nimport { createQso } from "../application/create-qso";\nexport const useStore = defineStore("qso", () => ({ busy: ref(false), createQso }));\n',
    ],
    [
      "presentation → public index of another module",
      "src/modules/swl-logbook/presentation/store.ts",
      'import { findScheduledAt } from "@/modules/frequency-explorer";\nexport const f = findScheduledAt;\n',
    ],
    [
      "module application → shared/application ports",
      "src/modules/ham-logbook/application/ports.ts",
      'import type { PersistenceError } from "@/shared/application";\nexport type E = PersistenceError;\n',
    ],
    [
      "module infrastructure → shared infrastructure and ports",
      "src/modules/ham-logbook/infrastructure/dexie-qso-log-repository.ts",
      'import { guard } from "@/infrastructure/db";\nimport { notFound } from "@/shared/application";\nexport const g = [guard, notFound];\n',
    ],
    [
      "shared infrastructure → public index of a module (entity types)",
      "src/infrastructure/db/app-database.ts",
      'import type { QsoLog } from "@/modules/ham-logbook";\nexport type Q = QsoLog;\n',
    ],
    [
      "composition root → module internals and infrastructure",
      "src/app/container.ts",
      'import { DexieQsoRepository } from "@/modules/ham-logbook/infrastructure/dexie-qso-repository";\nimport { db } from "@/infrastructure/db/app-database";\nexport const repo = new DexieQsoRepository(db);\n',
    ],
  ])("%s", async (_label, filePath, code) => {
    const violations = await layerViolations(filePath, code);
    expect(violations).toEqual([]);
  });
});

/**
 * NFR-I18N-01 / ADR-0008: UI text must come from the typed catalog. The check
 * covers template text and the user-facing attributes (title, aria-label,
 * placeholder, alt…) of every .vue file.
 */
describe("i18n rule: hardcoded UI text in templates", () => {
  async function bareStrings(template: string) {
    const code = `<script setup lang="ts">\nimport { useI18n } from "@/shared/i18n";\nconst { t } = useI18n();\n</script>\n\n<template>\n${template}\n</template>\n`;
    const [result] = await eslint.lintText(code, {
      filePath: "src/modules/ham-logbook/presentation/views/QsoListView.vue",
    });
    if (!result) throw new Error("No lint result");
    expect(result.messages.filter((m) => m.fatal)).toEqual([]);
    return result.messages.filter(
      (m) => m.ruleId === "vue/no-bare-strings-in-template",
    );
  }

  it.each([
    ["text content", "  <p>Nessun QSO registrato</p>"],
    ["aria-label", '  <button aria-label="Chiudi"></button>'],
    ["title", '  <span title="Frequenza"></span>'],
    ["placeholder", '  <input placeholder="Nominativo" />'],
  ])("reports %s", async (_label, template) => {
    expect((await bareStrings(template)).length).toBeGreaterThan(0);
  });

  it("accepts text from the catalog", async () => {
    const template = '  <p :title="t(\'nav.home\')">{{ t("nav.home") }}</p>';
    expect(await bareStrings(template)).toEqual([]);
  });
});

async function ruleViolations(filePath: string, code: string, ruleId: string) {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`No lint result for ${filePath}`);
  expect(result.messages.filter((m) => m.fatal)).toEqual([]);
  return result.messages.filter((m) => m.ruleId === ruleId);
}

/**
 * BL-M1-16: module boundaries cannot be bypassed with relative paths, and the
 * four cases required for M1 are rejected whatever the import form.
 */
describe("boundary rules: required negative cases", () => {
  const RELATIVE = "hrt/no-cross-boundary-relative-import";

  it.each([
    [
      "alias import of another module's internals",
      "src/modules/swl-logbook/application/link-schedule.ts",
      'import { x } from "@/modules/frequency-explorer/domain/schedule";\nexport const y = x;\n',
      "no-restricted-imports",
    ],
    [
      "relative import ../../../ into another module",
      "src/modules/swl-logbook/presentation/views/ReceptionView.vue",
      '<script setup lang="ts">\nimport { x } from "../../../frequency-explorer/domain/schedule";\nconst y = x;\n</script>\n\n<template>\n  <div :data-y="String(y)"></div>\n</template>\n',
      RELATIVE,
    ],
    [
      "relative import into another module's public index",
      "src/modules/swl-logbook/application/link-schedule.ts",
      'import { manifest } from "../../frequency-explorer";\nexport const m = manifest;\n',
      RELATIVE,
    ],
    [
      "relative re-export from another module",
      "src/modules/swl-logbook/index.ts",
      'export * from "../ham-logbook/domain/qso";\n',
      RELATIVE,
    ],
    [
      "dynamic relative import into another module",
      "src/modules/dashboard/index.ts",
      'export const load = () => import("../propagation/presentation/views/X.vue");\n',
      RELATIVE,
    ],
    [
      "relative import from a module into src/infrastructure",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { db } from "../../../infrastructure/db/app-database";\nexport const d = db;\n',
      RELATIVE,
    ],
    [
      "domain → infrastructure (alias)",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { db } from "@/infrastructure/db/app-database";\nexport const d = db;\n',
      "no-restricted-imports",
    ],
    [
      "domain → infrastructure (relative, same module)",
      "src/modules/ham-logbook/domain/qso.ts",
      'import { repo } from "../infrastructure/dexie-qso-repository";\nexport const r = repo;\n',
      "no-restricted-imports",
    ],
    [
      "presentation → Dexie",
      "src/modules/ham-logbook/presentation/store.ts",
      'import { liveQuery } from "dexie";\nexport const q = liveQuery;\n',
      "no-restricted-imports",
    ],
    [
      "relative import from src/shared into src/app",
      "src/shared/ui/components/AppThing.vue",
      '<script setup lang="ts">\nimport { moduleCatalog } from "../../../app/modules";\nconst c = moduleCatalog;\n</script>\n\n<template>\n  <div :data-c="String(c)"></div>\n</template>\n',
      RELATIVE,
    ],
  ])("%s", async (_label, filePath, code, ruleId) => {
    expect((await ruleViolations(filePath, code, ruleId)).length).toBe(1);
  });

  it.each([
    [
      "relative imports inside the same module, at any depth",
      "src/modules/ham-logbook/presentation/views/QsoListView.vue",
      '<script setup lang="ts">\nimport { schema } from "../../domain/qso";\nimport { useStore } from "../store";\nconst s = [schema, useStore];\n</script>\n\n<template>\n  <div :data-s="String(s)"></div>\n</template>\n',
    ],
    [
      "relative imports inside src/shared",
      "src/shared/modules/module-manifest.ts",
      'import type { IconName } from "../ui/icons";\nexport type I = IconName;\n',
    ],
    [
      "another module through its public API alias",
      "src/modules/swl-logbook/application/link-schedule.ts",
      'import { manifest } from "@/modules/frequency-explorer";\nexport const m = manifest;\n',
    ],
    [
      "a spec file importing test support outside src/",
      "src/app/router.spec.ts",
      'import { createTestApp } from "../../tests/support/mount-app";\nexport const c = createTestApp;\n',
    ],
  ])("allows %s", async (_label, filePath, code) => {
    expect(await ruleViolations(filePath, code, RELATIVE)).toEqual([]);
    expect(
      await ruleViolations(filePath, code, "no-restricted-imports"),
    ).toEqual([]);
  });
});

/**
 * NFR-I18N-01 in scripts: literal text on user-facing properties is reported;
 * technical strings (values, types, ids, CSS classes) are not.
 */
describe("i18n rule: hardcoded UI text in scripts", () => {
  const VIEW = "src/modules/ham-logbook/presentation/views/QsoListView.vue";
  const sfc = (script: string) =>
    `<script setup lang="ts">\nimport { useI18n } from "@/shared/i18n";\nconst { t } = useI18n();\n${script}\n</script>\n\n<template>\n  <div :data-x="String(x)"></div>\n</template>\n`;

  it.each([
    ["an option label", 'const x = [{ value: "cw", label: "Telegrafia" }];'],
    ["a title property", 'const x = { title: "Nuovo QSO" };'],
    ["document.title", 'document.title = "Logbook";\nconst x = t;'],
  ])("reports %s", async (_label, script) => {
    const violations = await ruleViolations(
      VIEW,
      sfc(script),
      "no-restricted-syntax",
    );
    expect(violations.length).toBe(1);
  });

  it("accepts catalog text and technical strings", async () => {
    const script = [
      'const x = [{ value: "cw", label: t("nav.home"), icon: "home" }];',
      'const classes = "flex min-h-touch";',
      'const type = "button";',
      "void [classes, type];",
    ].join("\n");
    expect(
      await ruleViolations(VIEW, sfc(script), "no-restricted-syntax"),
    ).toEqual([]);
  });

  it("also applies to presentation TypeScript files", async () => {
    const violations = await ruleViolations(
      "src/modules/dashboard/presentation/options.ts",
      'export const options = [{ value: "all", label: "Tutti" }];\n',
      "no-restricted-syntax",
    );
    expect(violations.length).toBe(1);
  });
});
