import { ref, shallowRef } from "vue";
import type { RestoreMode } from "@/shared/application";
import type {
  BackupError,
  RestoreAnalysis,
  RestoreOutcome,
  RestorePreview,
} from "../application/backup-ports";
import type { SettingsServices } from "./services";

/**
 * Steps of a restore (FR-SET-06, DATABASE.md § 9.2). Nothing is written
 * before `committing`; from `committing` on the operation is one IndexedDB
 * transaction that the app cannot interrupt.
 */
export type RestoreState =
  | { readonly step: "idle" }
  | { readonly step: "analyzing"; readonly fileName: string }
  | { readonly step: "analysis-failed"; readonly error: BackupError }
  /** Analysed, with errors: it cannot be restored. */
  | { readonly step: "invalid"; readonly analysis: RestoreAnalysis }
  | { readonly step: "analyzed"; readonly analysis: RestoreAnalysis }
  | { readonly step: "previewing"; readonly analysis: RestoreAnalysis }
  | { readonly step: "previewed"; readonly preview: RestorePreview }
  | { readonly step: "committing"; readonly preview: RestorePreview }
  | { readonly step: "done"; readonly outcome: RestoreOutcome }
  | {
      readonly step: "commit-failed";
      readonly error: BackupError;
      readonly analysis: RestoreAnalysis;
    }
  | { readonly step: "discarded" };

const UNEXPECTED: BackupError = { code: "backup.unexpected-error" };

/**
 * Restore driven by the Settings view. `onRestored` refreshes the state
 * shown by the app (preferences, profiles, dashboard) after a commit.
 */
export function useRestoreFlow(
  services: SettingsServices,
  onRestored: () => Promise<void>,
) {
  const state = shallowRef<RestoreState>({ step: "idle" });
  const mode = ref<RestoreMode>("replace");
  let controller: AbortController | undefined;

  async function analyze(file: File): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    state.value = { step: "analyzing", fileName: file.name };
    try {
      const service = await services.loadBackupService();
      const result = await service.analyzeBackup(
        { name: file.name, content: file },
        { signal },
      );
      if (signal.aborted) return;
      if (!result.ok) {
        state.value =
          result.error.code === "operation.aborted"
            ? { step: "discarded" }
            : { step: "analysis-failed", error: result.error };
        return;
      }
      state.value = result.value.content
        ? { step: "analyzed", analysis: result.value }
        : { step: "invalid", analysis: result.value };
    } catch {
      if (!signal.aborted) {
        state.value = { step: "analysis-failed", error: UNEXPECTED };
      }
    }
  }

  /** Stops an analysis in progress: nothing has been written. */
  function cancelAnalysis(): void {
    if (state.value.step !== "analyzing") return;
    controller?.abort();
    state.value = { step: "discarded" };
  }

  function analysisOf(current: RestoreState): RestoreAnalysis | undefined {
    switch (current.step) {
      case "invalid":
      case "analyzed":
      case "previewing":
      case "commit-failed":
        return current.analysis;
      case "previewed":
        return current.preview.analysis;
      default:
        return undefined;
    }
  }

  async function preview(): Promise<void> {
    const analysis = analysisOf(state.value);
    if (!analysis?.content) return;
    state.value = { step: "previewing", analysis };
    const service = await services.loadBackupService();
    const result = await service.previewRestore(analysis, mode.value);
    state.value = result.ok
      ? { step: "previewed", preview: result.value }
      : { step: "commit-failed", error: result.error, analysis };
  }

  /** A different mode invalidates the preview. */
  function setMode(value: RestoreMode): void {
    mode.value = value;
    const analysis = analysisOf(state.value);
    if (state.value.step === "previewed" && analysis) {
      state.value = { step: "analyzed", analysis };
    }
  }

  async function commit(): Promise<void> {
    if (state.value.step !== "previewed") return;
    const { preview: confirmed } = state.value;
    state.value = { step: "committing", preview: confirmed };
    const service = await services.loadBackupService();
    try {
      const result = await service.commitRestore(confirmed);
      if (result.ok) {
        await onRestored();
        state.value = { step: "done", outcome: result.value };
      } else {
        state.value = {
          step: "commit-failed",
          error: result.error,
          analysis: confirmed.analysis,
        };
      }
    } catch {
      state.value = {
        step: "commit-failed",
        error: UNEXPECTED,
        analysis: confirmed.analysis,
      };
    }
  }

  /** Gives up the restore; the cancellation is recorded in the job history. */
  async function discard(): Promise<void> {
    const analysis = analysisOf(state.value);
    state.value = { step: "discarded" };
    if (!analysis) return;
    const service = await services.loadBackupService();
    // A failure to record the cancellation does not change the outcome:
    // nothing was written either way.
    await service.cancelRestore(analysis).catch(() => undefined);
  }

  function reset(): void {
    controller?.abort();
    state.value = { step: "idle" };
  }

  return {
    state,
    mode,
    analyze,
    cancelAnalysis,
    preview,
    setMode,
    commit,
    discard,
    reset,
  };
}
