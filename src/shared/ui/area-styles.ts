import type { ModuleArea } from "../modules";
import type { IconName } from "./icons";

export interface AreaStyle {
  /** Text colour of the area (headings, icons). */
  readonly text: string;
  /** Accent border used on cards and section headings. */
  readonly border: string;
  readonly icon: IconName;
}

/**
 * Visual identity of the dashboard areas. Colour is always paired with a
 * text label and an icon (WCAG 1.4.1, information not conveyed by colour only).
 */
export const AREA_STYLES: Readonly<Record<ModuleArea, AreaStyle>> = {
  ham: { text: "text-ham", border: "border-ham", icon: "antenna" },
  swl: { text: "text-swl", border: "border-swl", icon: "headphones" },
  shared: { text: "text-shared", border: "border-shared", icon: "grid" },
};
