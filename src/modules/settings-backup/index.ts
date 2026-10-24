import type { ModuleManifest } from "@/shared/modules";

// TODO(M2): Block D — Settings view (storage, persistence, station profile
// data); until then the route shows the "In sviluppo" view (FR-GEN-07).
export const manifest: ModuleManifest = {
  id: "settings-backup",
  path: "/settings-backup",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "sliders",
  titleKey: "modules.settings-backup.title",
  descriptionKey: "modules.settings-backup.description",
  availability: { status: "in-development", milestone: "M2" },
};

// Public API (M2): station profiles, preferences and their repository ports.
export {
  POSITION_SOURCES,
  STATION_PROFILE_KINDS,
  stationProfileSchema,
} from "./domain/station-profile";
export type {
  StationProfile,
  StationProfileInput,
  StationProfileKind,
} from "./domain/station-profile";
export { defineSetting, settingRecordSchema } from "./domain/setting";
export type { SettingDefinition, SettingRecord } from "./domain/setting";
export type {
  SettingsRepository,
  StationProfileDraft,
  StationProfilePatch,
  StationProfileRepository,
} from "./application/ports";
