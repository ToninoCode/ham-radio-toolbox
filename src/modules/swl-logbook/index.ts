import type { ModuleManifest } from "@/shared/modules";

// TODO(M4): implement the logbook UI and use cases; until then the route
// shows the "In sviluppo" view (FR-GEN-07). Persistence exists since M2.
export const manifest: ModuleManifest = {
  id: "swl-logbook",
  path: "/swl-logbook",
  area: "swl",
  workspaces: ["swl"],
  icon: "headphones",
  titleKey: "modules.swl-logbook.title",
  descriptionKey: "modules.swl-logbook.description",
  availability: { status: "in-development", milestone: "M4" },
};

// Public API (M2): persisted reception schemas and repository port.
export {
  SWL_CATEGORIES,
  swlCategorySchema,
  swlReceptionSchema,
} from "./domain/swl-reception";
export type {
  SwlCategory,
  SwlReception,
  SwlReceptionInput,
} from "./domain/swl-reception";
export {
  RECEPTION_DETAILS_DATA_SCHEMAS,
  receptionDetailsSchema,
} from "./domain/reception-details";
export type {
  ReceptionDetails,
  ReceptionDetailsData,
  ReceptionDetailsInput,
} from "./domain/reception-details";
export type {
  NewSwlReception,
  SwlReceptionAggregate,
  SwlReceptionChanges,
  SwlReceptionDraft,
  SwlReceptionPatch,
  SwlReceptionRepository,
} from "./application/ports";
