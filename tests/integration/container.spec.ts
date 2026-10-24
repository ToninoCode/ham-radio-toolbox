import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";
import {
  APP_CONTAINER_KEY,
  createContainer,
  useContainer,
  type AppContainer,
} from "@/app/container";
import { expectOk, stationProfileDraft } from "../support/records";

/*
 * Composition root (ARCHITECTURE.md § 5.3): the container wires every port
 * to its adapter and is provided to the Vue app (jsdom environment).
 */

function testContainer(): AppContainer {
  return createContainer({
    database: {
      name: `hrt-container-${crypto.randomUUID()}`,
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    },
  });
}

/** Component that reads the container, as stores and views will. */
let injected: AppContainer | undefined;
const Probe = defineComponent({
  setup() {
    injected = useContainer();
    return () => h("div");
  },
});

describe("createContainer", () => {
  it("wires repositories, unit of work and system ports", async () => {
    const container = testContainer();
    expect(Object.keys(container.repositories).sort()).toEqual([
      "attachments",
      "dataSources",
      "importJobs",
      "qslRecords",
      "qsoLogs",
      "settings",
      "stationProfiles",
      "swlReceptions",
    ]);
    expectOk(await container.connect());
    const profile = expectOk(
      await container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    // Real system clock and id generator by default.
    expect(profile.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(profile.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(container.clock.now() >= profile.createdAt).toBe(true);
    container.dispose();
  });

  it("is injected into components with useContainer()", () => {
    const container = testContainer();
    const app = createApp(Probe);
    app.provide(APP_CONTAINER_KEY, container);
    app.mount(document.createElement("div"));
    expect(injected).toBe(container);
    app.unmount();
  });

  it("fails loudly when the container is not provided", () => {
    const app = createApp(Probe);
    app.config.warnHandler = () => undefined;
    expect(() => app.mount(document.createElement("div"))).toThrow(
      "App container not provided",
    );
  });
});
