import type { Page } from "@playwright/test";

/** Root paths of the 14 modules (src/modules/<id>/index.ts). */
export const MODULE_PATHS: Readonly<Record<string, string>> = {
  dashboard: "/",
  "ham-logbook": "/ham-logbook",
  "swl-logbook": "/swl-logbook",
  "frequency-explorer": "/frequency-explorer",
  "signal-explorer": "/signal-explorer",
  "satellite-explorer": "/satellite-explorer",
  "resource-manager": "/resource-manager",
  "dx-cluster": "/dx-cluster",
  "qsl-manager": "/qsl-manager",
  "aprs-explorer": "/aprs-explorer",
  "repeater-explorer": "/repeater-explorer",
  "rf-calculators": "/rf-calculators",
  propagation: "/propagation",
  "settings-backup": "/settings-backup",
};

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  phoneLandscape: { width: 844, height: 390 },
  tabletPortrait: { width: 712, height: 1138 },
  tabletLandscape: { width: 1138, height: 712 },
  desktop: { width: 1440, height: 900 },
} as const;

/** Collects page errors and console errors for the whole test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}
