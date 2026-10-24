import { computed, ref, shallowRef } from "vue";
import type { FileSaveError } from "@/shared/application";
import type {
  BackupError,
  BackupFile,
  BackupInventory,
  BackupVerification,
} from "../application/backup-ports";
import type { SettingsServices } from "./services";

/**
 * Steps of an export. The file is offered only in `ready`, that is after
 * it has been generated and read back successfully.
 */
export type ExportState =
  | { readonly step: "idle" }
  | { readonly step: "creating" }
  | { readonly step: "verifying"; readonly file: BackupFile }
  | {
      readonly step: "ready";
      readonly file: BackupFile;
      readonly verification: BackupVerification;
    }
  | { readonly step: "cancelled" }
  | { readonly step: "failed"; readonly error: BackupError };

/** Export of a backup (FR-SET-05) driven by the Settings view. */
export function useBackupExport(services: SettingsServices) {
  const inventory = shallowRef<BackupInventory>();
  const inventoryError = shallowRef<BackupError>();
  const includeAttachments = ref(false);
  const state = shallowRef<ExportState>({ step: "idle" });
  const downloadError = shallowRef<FileSaveError>();
  const downloaded = ref(false);
  let controller: AbortController | undefined;

  const busy = computed(
    () => state.value.step === "creating" || state.value.step === "verifying",
  );

  /** With attachments the file would exceed the limit (lower bound). */
  const overLimit = computed(
    () =>
      includeAttachments.value &&
      inventory.value !== undefined &&
      inventory.value.attachmentBase64Bytes > inventory.value.limitBytes,
  );

  async function loadInventory(): Promise<void> {
    const service = await services.loadBackupService();
    const result = await service.inspectBackup();
    if (result.ok) {
      inventory.value = result.value;
      inventoryError.value = undefined;
    } else {
      inventoryError.value = result.error;
    }
  }

  async function create(): Promise<void> {
    if (busy.value) return;
    controller = new AbortController();
    const { signal } = controller;
    downloaded.value = false;
    downloadError.value = undefined;
    state.value = { step: "creating" };
    const service = await services.loadBackupService();
    const created = await service.createBackup({
      includeAttachments: includeAttachments.value,
      signal,
    });
    if (!created.ok) {
      state.value =
        created.error.code === "operation.aborted"
          ? { step: "cancelled" }
          : { step: "failed", error: created.error };
      return;
    }
    state.value = { step: "verifying", file: created.value };
    const verified = await service.verifyBackup(created.value, { signal });
    if (!verified.ok) {
      state.value =
        verified.error.code === "operation.aborted"
          ? { step: "cancelled" }
          : { step: "failed", error: verified.error };
      return;
    }
    state.value = {
      step: "ready",
      file: created.value,
      verification: verified.value,
    };
    void loadInventory();
  }

  function cancel(): void {
    controller?.abort();
  }

  function download(): void {
    if (state.value.step !== "ready") return;
    const saved = services.fileSaver.save(state.value.file);
    downloaded.value = saved.ok;
    downloadError.value = saved.ok ? undefined : saved.error;
  }

  function reset(): void {
    state.value = { step: "idle" };
    downloaded.value = false;
    downloadError.value = undefined;
  }

  return {
    inventory,
    inventoryError,
    includeAttachments,
    state,
    busy,
    overLimit,
    downloaded,
    downloadError,
    loadInventory,
    create,
    cancel,
    download,
    reset,
  };
}
