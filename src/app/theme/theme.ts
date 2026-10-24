import type { ThemePreference } from "@/modules/settings-backup";

export type { ThemePreference };
export type ResolvedTheme = "light" | "dark";

/** Persisted values (settings-backup, key `app`). */
export { THEME_PREFERENCES } from "@/modules/settings-backup";

/** Must match `--hrt-canvas` in shared/ui/styles/main.css. */
export const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: "#f1f5f9",
  dark: "#0b1120",
};

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Applies the theme to <html> and to the browser UI (`theme-color`). */
export function applyTheme(doc: Document, theme: ResolvedTheme): void {
  const root = doc.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  doc
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
}
