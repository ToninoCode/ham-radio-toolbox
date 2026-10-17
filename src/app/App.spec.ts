import { describe, expect, it } from "vitest";
import { mountWithApp } from "../../tests/support/mount-app";
import App from "./App.vue";

describe("App", () => {
  it("mounts the application shell with its landmarks", async () => {
    const { wrapper } = await mountWithApp(App);

    expect(wrapper.find("header").exists()).toBe(true);
    expect(wrapper.find("main#main-content").exists()).toBe(true);
    expect(wrapper.findAll("nav").length).toBeGreaterThanOrEqual(2);
  });
});
