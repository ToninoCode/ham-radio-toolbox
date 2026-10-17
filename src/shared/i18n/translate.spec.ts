import { describe, expect, it as test, vi } from "vitest";
import { MODULE_IDS } from "../modules/module-manifest";
import type { MessageCatalog } from "./catalogs";
import { formatUtcDate, formatUtcTime, toIsoUtcSeconds } from "./format";
import { it as italian } from "./messages/it";
import { createTranslator } from "./translate";
import { t } from "./use-i18n";

function leaves(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(
    ([key, value]) => leaves(value, path ? `${path}.${key}` : key),
  );
}

describe("t()", () => {
  test("returns a plain message", () => {
    expect(t("nav.home")).toBe("Dashboard");
  });

  test("interpolates named placeholders", () => {
    expect(t("dashboard.openModule", { module: "Logbook HAM" })).toBe(
      "Apri Logbook HAM",
    );
  });

  test("selects the Italian plural form from count and formats the number", () => {
    expect(t("dashboard.moduleCount", { count: 1 })).toBe("1 modulo");
    expect(t("dashboard.moduleCount", { count: 0 })).toBe("0 moduli");
    expect(t("dashboard.moduleCount", { count: 13 })).toBe("13 moduli");
    // it-IT groups digits only from five-digit numbers (CLDR minimumGroupingDigits 2).
    expect(t("dashboard.moduleCount", { count: 1500 })).toBe("1500 moduli");
    expect(t("dashboard.moduleCount", { count: 15000 })).toBe("15.000 moduli");
  });

  test("returns the key and warns when a message is missing at runtime", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const translate = createTranslator(
      { app: {} } as unknown as MessageCatalog,
      "it-IT",
    );
    expect(translate("app.name")).toBe("app.name");
    expect(warn).toHaveBeenCalledWith("[i18n] Missing message: app.name");
  });

  test("keys and parameters are checked by the compiler", () => {
    // Never executed: the assertions are the @ts-expect-error directives,
    // verified by `npm run typecheck` (ADR-0008).
    const typeOnly = () => {
      // @ts-expect-error unknown key
      t("nav.unknown");
      // @ts-expect-error missing parameters
      t("dashboard.openModule");
      // @ts-expect-error wrong parameter name
      t("dashboard.openModule", { name: "x" });
      // @ts-expect-error plural messages need a numeric count
      t("dashboard.moduleCount", { count: "3" });
    };
    expect(typeOnly).toBeTypeOf("function");
  });
});

describe("Italian catalog", () => {
  const entries = leaves(italian);

  test("has no empty or padded messages", () => {
    for (const [path, message] of entries) {
      expect(message.trim(), path).not.toBe("");
      expect(message, path).toBe(message.trim());
    }
  });

  test("uses only well-formed {name} placeholders", () => {
    for (const [path, message] of entries) {
      const withoutPlaceholders = message.replace(/\{\w+\}/g, "");
      expect(withoutPlaceholders, path).not.toMatch(/[{}]/);
    }
  });

  test("plural messages use the count placeholder in every form", () => {
    const { one, other } = italian.dashboard.moduleCount;
    expect(one).toContain("{count}");
    expect(other).toContain("{count}");
  });

  test("has a title and a description for each of the 14 modules", () => {
    expect(Object.keys(italian.modules).sort()).toEqual([...MODULE_IDS].sort());
    for (const id of MODULE_IDS) {
      expect(italian.modules[id].title).not.toBe("");
      expect(italian.modules[id].description).not.toBe("");
    }
  });
});

describe("UTC formatters", () => {
  // 2026-10-17T13:21:05Z is a Saturday.
  const instant = new Date("2026-10-17T13:21:05Z");

  test("formats the time of day in UTC on a 24-hour clock", () => {
    expect(formatUtcTime(instant)).toBe("13:21:05");
    expect(formatUtcTime(new Date("2026-10-17T00:00:00Z"))).toBe("00:00:00");
  });

  test("formats the calendar date in UTC, independent of the local zone", () => {
    expect(formatUtcDate(instant)).toBe("sabato 17 ottobre 2026");
    // 23:30 UTC is already the next day east of Greenwich: still the 17th.
    expect(formatUtcDate(new Date("2026-10-17T23:30:00Z"))).toBe(
      "sabato 17 ottobre 2026",
    );
  });

  test("produces an ISO 8601 UTC timestamp without milliseconds", () => {
    expect(toIsoUtcSeconds(new Date("2026-10-17T13:21:05.987Z"))).toBe(
      "2026-10-17T13:21:05Z",
    );
  });
});
