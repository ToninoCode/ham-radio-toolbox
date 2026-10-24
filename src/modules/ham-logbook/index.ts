import type { ModuleManifest } from "@/shared/modules";

// TODO(M3): implement the logbook UI and use cases; until then the route
// shows the "In sviluppo" view (FR-GEN-07). Persistence exists since M2.
export const manifest: ModuleManifest = {
  id: "ham-logbook",
  path: "/ham-logbook",
  area: "ham",
  workspaces: ["ham"],
  icon: "logbook",
  titleKey: "modules.ham-logbook.title",
  descriptionKey: "modules.ham-logbook.description",
  availability: { status: "in-development", milestone: "M3" },
};

// Public API (M2): persisted QSO schema and repository port.
export { CONTINENTS, QSO_ORIGINS, qsoLogSchema } from "./domain/qso-log";
export type { QsoLog, QsoLogInput, QsoOrigin } from "./domain/qso-log";
export type {
  QsoLogDraft,
  QsoLogPatch,
  QsoLogRepository,
} from "./application/ports";
