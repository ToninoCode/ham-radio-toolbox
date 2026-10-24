import { inject, type InjectionKey } from "vue";
import type { DataChangeNotifier, FileSaver } from "@/shared/application";
import type { BackupService } from "../application/backup-ports";
import type { PreferencesService } from "../application/preferences-service";
import type { StationProfileService } from "../application/station-profile-service";
import type { StorageService } from "../application/storage-service";

/**
 * Use cases needed by the settings-backup presentation (and by the stores
 * it exports), provided by the composition root (src/app/main.ts). Stores
 * and views never see repositories or Dexie (ARCHITECTURE.md § 5.3).
 */
export interface SettingsServices {
  readonly preferences: PreferencesService;
  readonly stationProfiles: StationProfileService;
  readonly storage: StorageService;
  /** Changes committed by other tabs. */
  readonly dataChanges: DataChangeNotifier;
  readonly fileSaver: FileSaver;
  /** Backup and restore, loaded on first use (separate chunk, ADR-0015). */
  loadBackupService(): Promise<BackupService>;
}

export const SETTINGS_SERVICES_KEY: InjectionKey<SettingsServices> =
  Symbol("settings-services");

/** Services provided to the app; works in components and setup stores. */
export function useSettingsServices(): SettingsServices {
  const services = inject(SETTINGS_SERVICES_KEY, undefined);
  if (!services) throw new Error("Settings services not provided");
  return services;
}
