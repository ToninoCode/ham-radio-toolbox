import { it } from "./messages/it";
import type { CatalogShape } from "./types";

/** Reference catalog type: keys and placeholders are checked against it. */
export type ReferenceCatalog = typeof it;

/** Shape every locale catalog must satisfy (NFR-I18N-03). */
export type MessageCatalog = CatalogShape<ReferenceCatalog>;

/**
 * Supported locales. Adding English means adding `"en"` here and a
 * `messages/en.ts` typed as `MessageCatalog`; components do not change.
 */
export type Locale = "it";

export const DEFAULT_LOCALE: Locale = "it";

/** BCP 47 tag used for `Intl` formatting of each locale. */
export const INTL_LOCALES: Readonly<Record<Locale, string>> = {
  it: "it-IT",
};

export const CATALOGS: Readonly<Record<Locale, MessageCatalog>> = {
  it,
};
