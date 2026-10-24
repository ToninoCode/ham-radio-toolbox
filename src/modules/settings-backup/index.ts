import type { ModuleManifest } from "@/shared/modules";

// Settings view (M2, Block D): station profiles, preferences, storage,
// backup and restore. The backup code stays in its own lazy chunk.
export const manifest: ModuleManifest = {
  id: "settings-backup",
  path: "/settings-backup",
  area: "shared",
  workspaces: ["ham", "swl"],
  icon: "sliders",
  titleKey: "modules.settings-backup.title",
  descriptionKey: "modules.settings-backup.description",
  availability: { status: "available" },
  view: () => import("./presentation/views/SettingsView.vue"),
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
export {
  APP_PREFERENCES,
  DASHBOARD_PREFERENCES,
  MAX_FAVORITES,
  THEME_PREFERENCES,
  appPreferencesSchema,
  dashboardPreferencesSchema,
  themePreferenceSchema,
} from "./domain/preferences";
export type {
  AppPreferences,
  DashboardPreferences,
  ThemePreference,
} from "./domain/preferences";
export type { SettingDefinition, SettingRecord } from "./domain/setting";
export type {
  SettingsRepository,
  StationProfileDraft,
  StationProfilePatch,
  StationProfileRepository,
} from "./application/ports";

// Use cases available at startup (Block D), wired by src/app/container.ts.
export { createPreferencesService } from "./application/preferences-service";
export type {
  LoadedPreferences,
  PreferenceKey,
  Preferences,
  PreferencesService,
  PreferencesServiceDeps,
} from "./application/preferences-service";
export { createStationProfileService } from "./application/station-profile-service";
export type {
  StationProfileService,
  StationProfileServiceDeps,
} from "./application/station-profile-service";
export {
  QUOTA_WARNING_RATIO,
  createStorageService,
} from "./application/storage-service";
export type {
  PersistenceRequestOutcome,
  PersistenceState,
  StorageService,
  StorageServiceDeps,
  StorageStatus,
  StorageUsage,
} from "./application/storage-service";

// Presentation contract (Block D): the preferences store is shared by the
// app shell (theme) and the dashboard (favourites); the services are
// provided by the composition root with SETTINGS_SERVICES_KEY.
export { usePreferencesStore } from "./presentation/preferences-store";
export type { PreferencesStatus } from "./presentation/preferences-store";
export { useStorageStatusStore } from "./presentation/storage-status-store";
export {
  SETTINGS_SERVICES_KEY,
  useSettingsServices,
} from "./presentation/services";
export type { SettingsServices } from "./presentation/services";

// Backup and restore (M2, Block C): contracts only. The implementation is
// loaded lazily through AppContainer.loadBackupService() (ADR-0015).
export type {
  BackupContent,
  BackupError,
  BackupFile,
  BackupFileError,
  BackupInventory,
  BackupService,
  BackupVerification,
  InvalidStoredRecord,
  RestoreAnalysis,
  RestoreConflict,
  RestoreOutcome,
  RestorePlan,
  RestorePreview,
  TableEffects,
} from "./application/backup-ports";
export type { BackupIntegrity, BackupManifest } from "./domain/backup-manifest";
