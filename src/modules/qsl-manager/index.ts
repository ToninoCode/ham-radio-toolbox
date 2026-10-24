import type { ModuleManifest } from "@/shared/modules";

// TODO(M10): implement the QSL Manager UI and use cases; until then the
// route shows the "In sviluppo" view (FR-GEN-07). Persistence exists since M2.
export const manifest: ModuleManifest = {
  id: "qsl-manager",
  path: "/qsl-manager",
  area: "ham",
  workspaces: ["ham", "swl"],
  icon: "card",
  titleKey: "modules.qsl-manager.title",
  descriptionKey: "modules.qsl-manager.description",
  availability: { status: "in-development", milestone: "M10" },
};

// Public API (M2): persisted QSL schema and repository port.
export {
  QSL_CHANNELS,
  QSL_STATUSES,
  QSL_SUBJECT_TYPES,
  qslRecordSchema,
} from "./domain/qsl-record";
export type {
  QslChannel,
  QslRecord,
  QslRecordInput,
  QslSubjectType,
} from "./domain/qsl-record";
export type {
  QslRecordDraft,
  QslRecordPatch,
  QslRecordRepository,
} from "./application/ports";
