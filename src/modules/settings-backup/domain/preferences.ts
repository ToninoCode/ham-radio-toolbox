import { z } from "zod";
import { addDomainIssue, catalogKeySchema } from "@/core/validation";
import { defineSetting } from "./setting";

/*
 * Application preferences stored in `settings` (DATABASE.md § 3, FR-SET-02,
 * FR-DSH-03/06): key `app` (theme) and key `dashboard` (favourite modules in
 * pinning order). IndexedDB is the only source of truth: no copy in
 * localStorage.
 */

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const themePreferenceSchema = z.enum(THEME_PREFERENCES);

/** Value of the `app` key. */
export const appPreferencesSchema = z.strictObject({
  theme: themePreferenceSchema,
});

export type AppPreferences = z.infer<typeof appPreferencesSchema>;

/**
 * Upper bound of the favourites: the app has 14 modules; the margin
 * leaves room for modules added later without accepting arbitrary lists.
 */
export const MAX_FAVORITES = 32;

/**
 * Value of the `dashboard` key. Favourites are module ids (kebab-case keys)
 * without repetitions; ids of modules unknown to this version are kept in
 * storage and ignored by the dashboard.
 */
export const dashboardPreferencesSchema = z.strictObject({
  favorites: z
    .array(catalogKeySchema)
    .max(MAX_FAVORITES)
    .superRefine((favorites, ctx) => {
      favorites.forEach((favorite, index) => {
        if (favorites.indexOf(favorite) !== index) {
          addDomainIssue(ctx, [index], "dashboard.favorite-repeated");
        }
      });
    }),
});

export type DashboardPreferences = z.infer<typeof dashboardPreferencesSchema>;

export const APP_PREFERENCES = defineSetting<AppPreferences>(
  "app",
  appPreferencesSchema,
  {
    theme: "system",
  },
);

export const DASHBOARD_PREFERENCES = defineSetting<DashboardPreferences>(
  "dashboard",
  dashboardPreferencesSchema,
  { favorites: [] },
);
