import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { buttonClasses } from "../button-styles";
import { ICONS } from "../icons";
import AppBadge from "./AppBadge.vue";
import AppButton from "./AppButton.vue";
import AppIcon from "./AppIcon.vue";
import AppIconButton from "./AppIconButton.vue";
import EmptyState from "./EmptyState.vue";
import PageHeader from "./PageHeader.vue";
import SegmentedControl from "./SegmentedControl.vue";

describe("AppIcon", () => {
  it("renders a decorative SVG with the paths of the icon", () => {
    const wrapper = mount(AppIcon, { props: { name: "home", size: 20 } });
    const svg = wrapper.find("svg");
    expect(svg.attributes("aria-hidden")).toBe("true");
    expect(svg.attributes("focusable")).toBe("false");
    expect(svg.attributes("width")).toBe("20");
    expect(wrapper.findAll("path")).toHaveLength(ICONS.home.paths.length);
  });

  it("fills filled icons and strokes the others", () => {
    expect(
      mount(AppIcon, { props: { name: "star-filled" } })
        .find("svg")
        .attributes("fill"),
    ).toBe("currentColor");
    expect(
      mount(AppIcon, { props: { name: "star" } })
        .find("svg")
        .attributes("fill"),
    ).toBe("none");
  });
});

describe("AppButton", () => {
  it("is a non-submitting button by default with a 44 px touch target", () => {
    const wrapper = mount(AppButton, { slots: { default: "Salva" } });
    const button = wrapper.find("button");
    expect(button.attributes("type")).toBe("button");
    expect(button.classes()).toContain("min-h-touch");
    expect(button.text()).toBe("Salva");
  });

  it("applies the variant classes, the icon and the disabled state", () => {
    const wrapper = mount(AppButton, {
      props: { variant: "primary", icon: "star", disabled: true, block: true },
      slots: { default: "OK" },
    });
    const button = wrapper.find("button");
    expect(button.classes()).toContain("bg-accent");
    expect(button.classes()).toContain("w-full");
    expect(button.attributes("disabled")).toBeDefined();
    expect(wrapper.find('svg[data-icon="star"]').exists()).toBe(true);
  });

  it("emits click", async () => {
    const wrapper = mount(AppButton, { slots: { default: "Vai" } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("shares its classes with links styled as buttons", () => {
    expect(buttonClasses("ghost")).toContain("min-h-touch");
    expect(buttonClasses("ghost", true)).toContain("w-full");
  });
});

describe("AppIconButton", () => {
  it("uses the mandatory label as accessible name and tooltip", () => {
    const wrapper = mount(AppIconButton, {
      props: { icon: "close", label: "Chiudi il menu" },
    });
    const button = wrapper.find("button");
    expect(button.attributes("aria-label")).toBe("Chiudi il menu");
    expect(button.attributes("title")).toBe("Chiudi il menu");
    expect(button.attributes("aria-pressed")).toBeUndefined();
    expect(button.classes()).toContain("size-touch");
  });

  it("exposes the pressed state when used as a toggle", () => {
    const wrapper = mount(AppIconButton, {
      props: { icon: "star", label: "Preferito", pressed: true },
    });
    expect(wrapper.find("button").attributes("aria-pressed")).toBe("true");
  });
});

describe("AppBadge", () => {
  it("renders its text with the requested tone", () => {
    const wrapper = mount(AppBadge, {
      props: { tone: "warning" },
      slots: { default: "In sviluppo" },
    });
    expect(wrapper.text()).toBe("In sviluppo");
    expect(wrapper.attributes("data-tone")).toBe("warning");
    expect(wrapper.classes()).toContain("text-warning");
  });

  it("defaults to the neutral tone", () => {
    expect(mount(AppBadge).attributes("data-tone")).toBe("neutral");
  });
});

describe("EmptyState", () => {
  it("shows the title and the optional explanation", () => {
    const wrapper = mount(EmptyState, {
      props: { title: "Nessuna fonte importata." },
      slots: { default: "Dettagli" },
    });
    expect(wrapper.text()).toContain("Nessuna fonte importata.");
    expect(wrapper.text()).toContain("Dettagli");
  });
});

describe("PageHeader", () => {
  it("renders the page title as the only h1", () => {
    const wrapper = mount(PageHeader, {
      props: { title: "Dashboard" },
      slots: { default: "Intro" },
    });
    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.find("h1").text()).toBe("Dashboard");
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "system", label: "Sistema", icon: "monitor" },
    { value: "light", label: "Chiaro", icon: "sun" },
    { value: "dark", label: "Scuro", icon: "moon" },
  ] as const;

  function mountControl(iconOnly = false) {
    const selected = ref<"system" | "light" | "dark">("system");
    const Host = defineComponent(
      () => () =>
        h(SegmentedControl<"system" | "light" | "dark">, {
          legend: "Tema",
          options,
          iconOnly,
          modelValue: selected.value,
          "onUpdate:modelValue": (value: "system" | "light" | "dark") => {
            selected.value = value;
          },
        }),
    );
    return { wrapper: mount(Host), selected };
  }

  it("is a labelled group of native radio buttons", () => {
    const { wrapper } = mountControl();
    expect(wrapper.find("fieldset legend").text()).toBe("Tema");
    const radios = wrapper.findAll('input[type="radio"]');
    expect(radios).toHaveLength(3);
    const names = new Set(radios.map((r) => r.attributes("name")));
    expect(names.size).toBe(1);
    expect((radios[0]!.element as HTMLInputElement).checked).toBe(true);
  });

  it("updates the model when an option is chosen", async () => {
    const { wrapper, selected } = mountControl();
    await wrapper.findAll('input[type="radio"]')[2]!.setValue(true);
    expect(selected.value).toBe("dark");
  });

  it("keeps a text label for screen readers in icon-only mode", () => {
    const { wrapper } = mountControl(true);
    const labels = wrapper.findAll("label");
    expect(labels[1]!.attributes("title")).toBe("Chiaro");
    expect(labels[1]!.find("span.sr-only").text()).toBe("Chiaro");
  });
});
