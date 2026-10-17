import { manifest as aprsExplorer } from "@/modules/aprs-explorer";
import { manifest as dashboard } from "@/modules/dashboard";
import { manifest as dxCluster } from "@/modules/dx-cluster";
import { manifest as frequencyExplorer } from "@/modules/frequency-explorer";
import { manifest as hamLogbook } from "@/modules/ham-logbook";
import { manifest as propagation } from "@/modules/propagation";
import { manifest as qslManager } from "@/modules/qsl-manager";
import { manifest as repeaterExplorer } from "@/modules/repeater-explorer";
import { manifest as resourceManager } from "@/modules/resource-manager";
import { manifest as rfCalculators } from "@/modules/rf-calculators";
import { manifest as satelliteExplorer } from "@/modules/satellite-explorer";
import { manifest as settingsBackup } from "@/modules/settings-backup";
import { manifest as signalExplorer } from "@/modules/signal-explorer";
import { manifest as swlLogbook } from "@/modules/swl-logbook";
import { createModuleCatalog, type ModuleManifest } from "@/shared/modules";

/** Declaration order = order in navigation and in each dashboard area. */
export const MODULE_MANIFESTS: readonly ModuleManifest[] = [
  dashboard,
  hamLogbook,
  qslManager,
  dxCluster,
  aprsExplorer,
  repeaterExplorer,
  swlLogbook,
  frequencyExplorer,
  signalExplorer,
  satelliteExplorer,
  propagation,
  rfCalculators,
  resourceManager,
  settingsBackup,
];

export const moduleCatalog = createModuleCatalog(MODULE_MANIFESTS);
