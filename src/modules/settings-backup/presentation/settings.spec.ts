import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  createStoreTestApp,
  createTestContainer,
  fakeStorageInfo,
} from "../../../../tests/support/app-services";
import { mountWithApp } from "../../../../tests/support/mount-app";
import {
  expectOk,
  stationProfileDraft,
} from "../../../../tests/support/records";
import type { Result } from "@/shared/types";
import type {
  BackupError,
  BackupService,
  RestoreAnalysis,
  RestorePreview,
} from "../application/backup-ports";
import { useRestoreFlow } from "./restore-flow";
import { settingsServicesOf } from "@/app/container";
import SettingsView from "./views/SettingsView.vue";

async function mountSettings(container = createTestContainer()) {
  const mounted = await mountWithApp(SettingsView, {
    path: "/settings-backup",
    container,
    attachTo: document.body,
  });
  await vi.waitFor(async () => {
    await flushPromises();
    expect(
      mounted.wrapper.find('[data-testid="profiles-section"]').text(),
    ).not.toContain("Caricamento dei profili");
  });
  return mounted;
}

async function fill(wrapper: VueWrapper, name: string, value: string) {
  await wrapper
    .find(`[data-testid="profile-form"] input[name="${name}"]`)
    .setValue(value);
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('[data-testid="profile-form"]').trigger("submit");
  await flushPromises();
}

describe("Settings: station profiles", () => {
  it("starts empty and makes the first profile the default", async () => {
    const { wrapper, container } = await mountSettings();
    const section = () => wrapper.find('[data-testid="profiles-section"]');
    expect(section().find('[data-testid="empty-state"]').text()).toContain(
      "Nessun profilo stazione",
    );

    await section().find('[data-testid="profile-add"]').trigger("click");
    expect(wrapper.find('[data-testid="first-default"]').exists()).toBe(true);
    await fill(wrapper, "name", "Casa");
    await fill(wrapper, "callsign", "iz1abc");
    await fill(wrapper, "locator", "jn45dl");
    await submit(wrapper);

    await vi.waitFor(() =>
      expect(section().findAll('[data-testid="profile-item"]')).toHaveLength(1),
    );
    const item = section().find('[data-testid="profile-item"]');
    expect(item.text()).toContain("Casa");
    expect(item.text()).toContain("IZ1ABC · JN45dl");
    expect(item.find('[data-testid="profile-default"]').exists()).toBe(true);
    expect(section().find('[data-testid="profiles-message"]').text()).toContain(
      "Profilo «Casa» salvato.",
    );
    // The only profile cannot be deleted, and the view says why.
    expect(
      item.find('[data-testid="profile-remove"]').attributes("disabled"),
    ).toBeDefined();
    expect(section().text()).toContain("È l'unico profilo");
    const [stored] = expectOk(await container.services.stationProfiles.list());
    expect(stored).toMatchObject({
      name: "Casa",
      callsign: "IZ1ABC",
      isDefault: 1,
    });
    wrapper.unmount();
  });

  it("shows validation errors next to the fields and keeps the values", async () => {
    const { wrapper, container } = await mountSettings();
    await wrapper.find('[data-testid="profile-add"]').trigger("click");
    await fill(wrapper, "name", "   ");
    await fill(wrapper, "locator", "ZZ99");
    await fill(wrapper, "dxcc", "abc");
    await submit(wrapper);

    const form = wrapper.find('[data-testid="profile-form"]');
    // Numbers are checked first, without calling the repository.
    expect(form.find('input[name="dxcc"]').attributes("aria-invalid")).toBe(
      "true",
    );
    expect(form.text()).toContain("Inserisci un numero valido.");

    await fill(wrapper, "dxcc", "248");
    await submit(wrapper);
    await vi.waitFor(() =>
      expect(form.find('input[name="name"]').attributes("aria-invalid")).toBe(
        "true",
      ),
    );
    expect(form.text()).toContain("Campo obbligatorio.");
    expect(form.text()).toContain("Locator non valido");
    expect(form.text()).toContain("I dati inseriti restano nel modulo");
    expect(form.text()).not.toContain("invalid_format");
    expect(
      (form.find('input[name="locator"]').element as HTMLInputElement).value,
    ).toBe("ZZ99");
    expect(expectOk(await container.services.stationProfiles.list())).toEqual(
      [],
    );
    wrapper.unmount();
  });

  it("changes the default profile and deletes after confirmation", async () => {
    const container = createTestContainer();
    const { stationProfiles } = container.services;
    const home = expectOk(
      await stationProfiles.create(stationProfileDraft({ name: "Casa" })),
    );
    const swl = expectOk(
      await stationProfiles.create(
        stationProfileDraft({
          name: "Ascolto",
          kind: "swl",
          callsign: undefined,
        }),
      ),
    );
    const { wrapper } = await mountSettings(container);
    const item = (id: string) => wrapper.find(`[data-profile="${id}"]`);

    await item(swl.id)
      .find('[data-testid="profile-make-default"]')
      .trigger("click");
    await vi.waitFor(() =>
      expect(
        item(swl.id).find('[data-testid="profile-default"]').exists(),
      ).toBe(true),
    );
    expect(item(home.id).find('[data-testid="profile-default"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="profiles-message"]').text()).toContain(
      "«Ascolto» è ora il profilo predefinito.",
    );

    await item(swl.id).find('[data-testid="profile-remove"]').trigger("click");
    const confirm = wrapper.find('[data-testid="profile-remove-confirm"]');
    expect(wrapper.text()).toContain(
      "diventerà predefinito il profilo più vecchio",
    );
    await confirm.trigger("click");
    await vi.waitFor(() => expect(item(swl.id).exists()).toBe(false));
    expect(item(home.id).find('[data-testid="profile-default"]').exists()).toBe(
      true,
    );
    wrapper.unmount();
  });
});

describe("Settings: storage", () => {
  it("shows usage, quota and persistence, and requests persistence", async () => {
    const container = createTestContainer({
      storageInfo: fakeStorageInfo({
        estimate: { usageBytes: 900 * 1024 ** 2, quotaBytes: 1024 ** 3 },
        persisted: false,
        grant: false,
      }),
    });
    const { wrapper } = await mountSettings(container);
    const section = wrapper.find('[data-testid="storage-section"]');
    await vi.waitFor(() =>
      expect(section.find('[data-testid="storage-usage"]').text()).toContain(
        "900 MiB su 1 GiB",
      ),
    );
    expect(section.find('[data-testid="storage-database"]').text()).toContain(
      "Disponibile",
    );
    expect(section.text()).toContain("soltanto su questo dispositivo");
    expect(section.text()).toContain(
      "non garantisce che lo spazio sia davvero libero",
    );
    expect(section.find('[role="alert"]').text()).toContain("80 %");

    const request = section
      .findAll("button")
      .find((b) => b.text().includes("Richiedi archiviazione persistente"));
    await request?.trigger("click");
    await vi.waitFor(() =>
      expect(
        section.find('[data-testid="persistence-outcome"]').text(),
      ).toContain("non ha concesso"),
    );
    wrapper.unmount();
  });
});

describe("Settings: backup", () => {
  it("states that the checksum is not a digital signature", async () => {
    const { wrapper } = await mountSettings();
    const note = wrapper.find('[data-testid="backup-checksum-note"]').text();
    expect(note).toContain("SHA-256");
    expect(note).toContain("non è una firma digitale");
    wrapper.unmount();
  });
});

describe("restore flow", () => {
  const analysis = {
    fileName: "b.json",
    sizeBytes: 10,
    manifest: { counts: {} },
    content: { includesAttachments: false, tables: {} },
    errors: [],
  } as unknown as RestoreAnalysis;
  const preview = { mode: "replace", analysis } as unknown as RestorePreview;

  function fakeBackup(overrides: Partial<BackupService> = {}): BackupService {
    return {
      inspectBackup: vi.fn(),
      createBackup: vi.fn(),
      verifyBackup: vi.fn(),
      analyzeBackup: vi.fn(async () => ({ ok: true, value: analysis })),
      previewRestore: vi.fn(async () => ({ ok: true, value: preview })),
      commitRestore: vi.fn(async () => ({
        ok: true,
        value: { job: {}, effects: {}, counts: {} },
      })),
      cancelRestore: vi.fn(async () => ({ ok: true, value: {} })),
      ...overrides,
    } as unknown as BackupService;
  }

  function flowWith(
    backup: BackupService,
    onRestored = vi.fn(async () => undefined),
  ) {
    const { container } = createStoreTestApp();
    const services = {
      ...settingsServicesOf(container),
      loadBackupService: async () => backup,
    };
    return { flow: useRestoreFlow(services, onRestored), onRestored };
  }

  const file = new File(["{}"], "b.json", { type: "application/json" });

  it("goes from analysis to preview and commit, then refreshes the app", async () => {
    const backup = fakeBackup();
    const { flow, onRestored } = flowWith(backup);
    await flow.analyze(file);
    expect(flow.state.value.step).toBe("analyzed");
    await flow.preview();
    expect(flow.state.value.step).toBe("previewed");
    await flow.commit();
    expect(flow.state.value.step).toBe("done");
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("a new mode invalidates the preview; discarding records the cancellation", async () => {
    const backup = fakeBackup();
    const { flow } = flowWith(backup);
    await flow.analyze(file);
    await flow.preview();
    flow.setMode("merge");
    expect(flow.state.value.step).toBe("analyzed");
    await flow.preview();
    expect(backup.previewRestore).toHaveBeenLastCalledWith(analysis, "merge");
    await flow.discard();
    expect(flow.state.value.step).toBe("discarded");
    expect(backup.cancelRestore).toHaveBeenCalledWith(analysis);
    expect(backup.commitRestore).not.toHaveBeenCalled();
  });

  it("cancels an analysis in progress without writing", async () => {
    let signal: AbortSignal | undefined;
    const backup = fakeBackup({
      analyzeBackup: vi.fn(
        (_file, options) =>
          new Promise<Result<RestoreAnalysis, BackupError>>((resolve) => {
            signal = options?.signal;
            signal?.addEventListener("abort", () =>
              resolve({ ok: false, error: { code: "operation.aborted" } }),
            );
          }),
      ),
    });
    const { flow } = flowWith(backup);
    const running = flow.analyze(file);
    await flushPromises();
    expect(flow.state.value.step).toBe("analyzing");
    flow.cancelAnalysis();
    await running;
    expect(signal?.aborted).toBe(true);
    expect(flow.state.value.step).toBe("discarded");
    expect(backup.previewRestore).not.toHaveBeenCalled();
  });

  it("reports a failed or throwing commit without refreshing", async () => {
    const failing = fakeBackup({
      commitRestore: vi.fn(async () => ({
        ok: false as const,
        error: { code: "backup.preview-stale" as const },
      })),
    });
    const first = flowWith(failing);
    await first.flow.analyze(file);
    await first.flow.preview();
    await first.flow.commit();
    expect(first.flow.state.value).toMatchObject({
      step: "commit-failed",
      error: { code: "backup.preview-stale" },
    });
    expect(first.onRestored).not.toHaveBeenCalled();

    const throwing = fakeBackup({
      commitRestore: vi.fn(async () => {
        throw new Error("bug");
      }),
    });
    const second = flowWith(throwing);
    await second.flow.analyze(file);
    await second.flow.preview();
    await second.flow.commit();
    expect(second.flow.state.value).toMatchObject({
      step: "commit-failed",
      error: { code: "backup.unexpected-error" },
    });
  });

  it("an invalid backup cannot be previewed", async () => {
    const backup = fakeBackup({
      analyzeBackup: vi.fn(async () => ({
        ok: true as const,
        value: { ...analysis, content: undefined } as RestoreAnalysis,
      })),
    });
    const { flow } = flowWith(backup);
    await flow.analyze(file);
    expect(flow.state.value.step).toBe("invalid");
    await flow.preview();
    expect(backup.previewRestore).not.toHaveBeenCalled();
  });
});
