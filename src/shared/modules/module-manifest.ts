import type { Component } from "vue";
import type { PlainMessageKey } from "../i18n";
import type { IconName } from "../ui/icons";

/** The 14 modules of PROJECT.md § 5 (MOD-01…MOD-14). */
export const MODULE_IDS = [
  "dashboard",
  "ham-logbook",
  "swl-logbook",
  "frequency-explorer",
  "signal-explorer",
  "satellite-explorer",
  "resource-manager",
  "dx-cluster",
  "qsl-manager",
  "aprs-explorer",
  "repeater-explorer",
  "rf-calculators",
  "propagation",
  "settings-backup",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

/** Dashboard grouping: HAM, SWL or tools shared by both. */
export type ModuleArea = "ham" | "swl" | "shared";

export const MODULE_AREAS: readonly ModuleArea[] = ["ham", "swl", "shared"];

/** Workspaces of FR-DSH-02. A module may be relevant to both. */
export type Workspace = "ham" | "swl";

export type Milestone = `M${number}`;

export type ModuleAvailability =
  | { readonly status: "available" }
  | { readonly status: "in-development"; readonly milestone: Milestone };

/**
 * Public description of a feature module, exported by its `index.ts`
 * (ARCHITECTURE.md § 6). The composition root builds routes from it.
 */
export interface ModuleManifest {
  readonly id: ModuleId;
  /** Root route of the module (history mode, ADR-0011). */
  readonly path: `/${string}`;
  readonly area: ModuleArea;
  readonly workspaces: readonly Workspace[];
  readonly icon: IconName;
  readonly titleKey: PlainMessageKey;
  readonly descriptionKey: PlainMessageKey;
  readonly availability: ModuleAvailability;
  /** Lazy view; required when the module is available. */
  readonly view?: () => Promise<Component | { default: Component }>;
}
