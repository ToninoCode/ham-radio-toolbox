import type { ModuleManifest } from "@/shared/modules";

// TODO(M7): implement the module; until then the route shows the
// "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "signal-explorer",
  path: "/signal-explorer",
  area: "swl",
  workspaces: ["swl"],
  icon: "waveform",
  titleKey: "modules.signal-explorer.title",
  descriptionKey: "modules.signal-explorer.description",
  availability: { status: "in-development", milestone: "M7" },
};
