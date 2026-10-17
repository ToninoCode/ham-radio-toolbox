import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import App from "./App.vue";

describe("App", () => {
  it("mounts and renders the main landmark", () => {
    const wrapper = mount(App);

    expect(wrapper.find("main#main-content").exists()).toBe(true);
  });
});
