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
