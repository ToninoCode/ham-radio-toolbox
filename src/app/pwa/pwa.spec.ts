import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import PwaUpdatePrompt from "./PwaUpdatePrompt.vue";
import {
  UPDATE_CHECK_INTERVAL_MS,
  usePwaUpdate,
  type PwaUpdate,
} from "./use-pwa-update";

type RegisterOptions = Parameters<
  NonNullable<Parameters<typeof usePwaUpdate>[0]>
>[0];

/** Fake of `useRegisterSW` that exposes the options it was called with. */
function fakeRegister(updateServiceWorker = vi.fn(() => Promise.resolve())) {
  const state = {
    options: undefined as RegisterOptions,
    needRefresh: ref(false),
    offlineReady: ref(false),
    updateServiceWorker,
  };
  const register = (options?: RegisterOptions) => {
    state.options = options;
    return {
      needRefresh: state.needRefresh,
      offlineReady: state.offlineReady,
      updateServiceWorker,
    };
  };
  return { register, state };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("usePwaUpdate", () => {
  it("registers immediately and reports registration errors", () => {
    const { register, state } = fakeRegister();
    const pwa = usePwaUpdate(register);
    expect(state.options?.immediate).toBe(true);

    state.options?.onRegisterError?.(new Error("blocked"));
    expect(pwa.error.value).toBe("register");
    pwa.dismissError();
    expect(pwa.error.value).toBeNull();
  });

  it("applies the update only on request and reloads the page", async () => {
    const { register, state } = fakeRegister();
    const pwa = usePwaUpdate(register);
    state.needRefresh.value = true;
    expect(state.updateServiceWorker).not.toHaveBeenCalled();

    await pwa.update();
    expect(state.updateServiceWorker).toHaveBeenCalledWith(true);
    expect(pwa.updating.value).toBe(false);
  });

  it("reports a failed update", async () => {
    const { register } = fakeRegister(
      vi.fn(() => Promise.reject(new Error("x"))),
    );
    const pwa = usePwaUpdate(register);
    await pwa.update();
    expect(pwa.error.value).toBe("update");
  });

  it("postpones the update without applying it", () => {
    const { register, state } = fakeRegister();
    const pwa = usePwaUpdate(register);
    state.needRefresh.value = true;
    pwa.postpone();
    expect(pwa.needRefresh.value).toBe(false);
    expect(state.updateServiceWorker).not.toHaveBeenCalled();
  });

  it("checks for updates periodically, only when online", () => {
    vi.useFakeTimers();
    const { register, state } = fakeRegister();
    usePwaUpdate(register);
    const registration = {
      installing: null,
      update: vi.fn(() => Promise.resolve()),
    } as unknown as ServiceWorkerRegistration;
    state.options?.onRegisteredSW?.("/sw.js", registration);

    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);

    online.mockReturnValue(false);
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });
});

function fakePwa(): PwaUpdate {
  const needRefresh = ref(false);
  const offlineReady = ref(false);
  const error = ref<"register" | "update" | null>(null);
  return {
    needRefresh,
    offlineReady,
    updating: ref(false),
    error,
    update: vi.fn(() => Promise.resolve()),
    postpone: vi.fn(() => {
      needRefresh.value = false;
    }),
    dismissOfflineReady: vi.fn(() => {
      offlineReady.value = false;
    }),
    dismissError: vi.fn(() => {
      error.value = null;
    }),
  };
}

describe("PwaUpdatePrompt", () => {
  it("renders nothing visible while there is nothing to report", () => {
    const wrapper = mount(PwaUpdatePrompt, { props: { pwa: fakePwa() } });
    const region = wrapper.find('[data-testid="pwa-notifications"]');
    expect(region.attributes("aria-label")).toBe("Notifiche dell'app");
    expect(region.find("[aria-live=polite]").text()).toBe("");
  });

  it("offers update and postpone when a new version is waiting", async () => {
    const pwa = fakePwa();
    const wrapper = mount(PwaUpdatePrompt, { props: { pwa } });
    pwa.needRefresh.value = true;
    await nextTick();

    const notice = wrapper.find('[data-testid="pwa-update"]');
    expect(notice.text()).toContain("Nuova versione disponibile.");
    const [later, update] = notice.findAll("button");
    expect(later!.text()).toBe("Più tardi");
    expect(update!.text()).toBe("Aggiorna");

    await update!.trigger("click");
    expect(pwa.update).toHaveBeenCalledTimes(1);

    await later!.trigger("click");
    expect(pwa.postpone).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="pwa-update"]').exists()).toBe(false);
  });

  it("disables the buttons while updating", async () => {
    const pwa = fakePwa();
    const wrapper = mount(PwaUpdatePrompt, { props: { pwa } });
    pwa.needRefresh.value = true;
    pwa.updating.value = true;
    await nextTick();
    const buttons = wrapper.findAll('[data-testid="pwa-update"] button');
    expect(buttons.every((b) => b.attributes("disabled") !== undefined)).toBe(
      true,
    );
    expect(buttons[1]!.text()).toBe("Aggiornamento in corso…");
  });

  it("announces offline readiness and hides it after a while", async () => {
    vi.useFakeTimers();
    const pwa = fakePwa();
    const wrapper = mount(PwaUpdatePrompt, { props: { pwa } });
    pwa.offlineReady.value = true;
    await nextTick();
    expect(wrapper.find('[data-testid="pwa-offline-ready"]').text()).toContain(
      "App pronta per l'uso offline.",
    );

    vi.advanceTimersByTime(10_000);
    expect(pwa.dismissOfflineReady).toHaveBeenCalledTimes(1);
    await nextTick();
    expect(wrapper.find('[data-testid="pwa-offline-ready"]').exists()).toBe(
      false,
    );
  });

  it("shows registration and update errors as alerts", async () => {
    const pwa = fakePwa();
    const wrapper = mount(PwaUpdatePrompt, { props: { pwa } });
    pwa.error.value = "register";
    await nextTick();
    const alert = wrapper.find('[role="alert"]');
    expect(alert.text()).toContain("Modalità offline non disponibile");

    pwa.error.value = "update";
    await nextTick();
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "Aggiornamento non riuscito",
    );

    await wrapper.find('[role="alert"] button').trigger("click");
    expect(pwa.dismissError).toHaveBeenCalled();
  });
});
